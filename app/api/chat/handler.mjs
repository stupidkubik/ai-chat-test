const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MOCK_URL = "http://127.0.0.1:8787/api/v1/chat/completions";
const MODEL = "openrouter/free";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARACTERS = 4_000;
const MAX_TOTAL_CHARACTERS = 20_000;
const MAX_REQUEST_BYTES = 128 * 1024;
const MAX_SSE_EVENT_CHARACTERS = 1024 * 1024;
const UPSTREAM_IDLE_TIMEOUT_MS = 45_000;
const UPSTREAM_TOTAL_TIMEOUT_MS = 90_000;

const MOCK_SCENARIOS = new Set([
  "success",
  "rate-limit",
  "network-failure",
  "midstream-disconnect",
  "slow",
  "timeout",
  "abort-observed",
]);

const APP_ERRORS = {
  rate_limited: "Бесплатная модель сейчас перегружена. Попробуйте позже.",
  timeout: "Ответ не пришёл вовремя. Попробуйте ещё раз.",
  network_error: "Соединение прервалось. Проверьте сеть и попробуйте ещё раз.",
  provider_error: "Сервис временно недоступен.",
};

function jsonError(status, code, message) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, messages: Array<{ role: "user" | "assistant", content: string }> } | { ok: false }}
 */
export function validateChatInput(value) {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !("messages" in value)) {
    return { ok: false };
  }

  const messages = value.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    return { ok: false };
  }

  let totalCharacters = 0;
  const normalizedMessages = [];

  for (const message of messages) {
    if (
      !isRecord(message) ||
      Object.keys(message).length !== 2 ||
      !("role" in message) ||
      !("content" in message) ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      message.content.trim().length === 0 ||
      message.content.length > MAX_MESSAGE_CHARACTERS
    ) {
      return { ok: false };
    }

    totalCharacters += message.content.length;
    if (totalCharacters > MAX_TOTAL_CHARACTERS) return { ok: false };

    normalizedMessages.push({ role: message.role, content: message.content });
  }

  if (normalizedMessages[0].role !== "user" || normalizedMessages.at(-1)?.role !== "user") {
    return { ok: false };
  }

  return { ok: true, messages: normalizedMessages };
}

/** @param {Record<string, string | undefined>} env */
export function resolveProviderConfig(env) {
  const useMock = env.NODE_ENV !== "production" && env.OPENROUTER_MOCK === "1";

  if (useMock) {
    let endpoint;
    try {
      endpoint = new URL(env.OPENROUTER_MOCK_URL || DEFAULT_MOCK_URL);
    } catch {
      return { ok: false, reason: "invalid_mock_config" };
    }

    if (
      endpoint.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(endpoint.hostname) ||
      endpoint.username !== "" ||
      endpoint.password !== "" ||
      endpoint.search !== "" ||
      endpoint.hash !== ""
    ) {
      return { ok: false, reason: "invalid_mock_config" };
    }

    const scenario = env.OPENROUTER_MOCK_SCENARIO?.trim();
    if (scenario && !MOCK_SCENARIOS.has(scenario)) {
      return { ok: false, reason: "invalid_mock_config" };
    }

    return {
      ok: true,
      endpoint: endpoint.toString(),
      model: MODEL,
      headers: scenario ? { "x-mock-scenario": scenario } : {},
    };
  }

  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "missing_api_key" };

  return {
    ok: true,
    endpoint: OPENROUTER_URL,
    model: MODEL,
    apiKey,
    headers: {},
  };
}

/**
 * Starts both upstream deadlines before fetch, so a stall before headers is covered too.
 * @param {AbortController} controller
 * @param {{ idleMs?: number, totalMs?: number }} options
 */
export function createTimeoutGuard(controller, options = {}) {
  const idleMs = options.idleMs ?? UPSTREAM_IDLE_TIMEOUT_MS;
  const totalMs = options.totalMs ?? UPSTREAM_TOTAL_TIMEOUT_MS;
  let idleTimer;
  let totalTimer;
  let timeoutReason = null;
  let stopped = false;

  function abortForTimeout(reason) {
    if (stopped || controller.signal.aborted) return;
    timeoutReason = reason;
    controller.abort();
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (!stopped && !controller.signal.aborted) {
      idleTimer = setTimeout(() => abortForTimeout("idle"), idleMs);
    }
  }

  return {
    start() {
      totalTimer = setTimeout(() => abortForTimeout("total"), totalMs);
      resetIdleTimer();
    },
    activity() {
      resetIdleTimer();
    },
    stop() {
      stopped = true;
      clearTimeout(idleTimer);
      clearTimeout(totalTimer);
    },
    get timeoutReason() {
      return timeoutReason;
    },
  };
}

function timeoutError() {
  return { code: "timeout", message: APP_ERRORS.timeout };
}

function networkError() {
  return { code: "network_error", message: APP_ERRORS.network_error };
}

function providerError() {
  return { code: "provider_error", message: APP_ERRORS.provider_error };
}

function rateLimitError() {
  return { code: "rate_limited", message: APP_ERRORS.rate_limited };
}

function providerErrorFromPayload(payload) {
  const errorDetails = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const providerCode = Number(errorDetails?.code ?? errorDetails?.status);

  if (providerCode === 429) return rateLimitError();
  if (providerCode === 408 || providerCode === 504) return timeoutError();
  return providerError();
}

function formatSseError(error) {
  return `event: error\ndata: ${JSON.stringify({ error })}\n\n`;
}

async function cancelResponseBody(body) {
  try {
    await body?.cancel();
  } catch {
    // The provider may have already closed or errored its response body.
  }
}

function inspectSseEvent(rawEvent) {
  const content = rawEvent.replace(/(?:\r\n|\r|\n){2}$/, "");
  let eventName = "message";
  const dataLines = [];

  for (const line of content.split(/\r\n|\r|\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") eventName = value;
    if (field === "data") dataLines.push(value);
  }

  const data = dataLines.join("\n");
  if (data === "[DONE]") return { done: true };

  if (data) {
    try {
      const payload = JSON.parse(data);
      if (eventName === "error" || (isRecord(payload) && "error" in payload)) {
        return { error: providerErrorFromPayload(payload) };
      }
    } catch {
      if (eventName === "error") return { error: providerError() };
    }
  } else if (eventName === "error") {
    return { error: providerError() };
  }

  return { done: false };
}

function createRelayedBody(upstreamBody, { abortController, timeoutGuard, request, cleanup }) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const separatorPattern = /(?:\r\n|\r|\n){2}/;
  let pending = "";
  let upstreamEnded = false;
  let sawDone = false;
  let closed = false;

  async function cancelUpstream(reason) {
    if (!abortController.signal.aborted) abortController.abort(reason);
    try {
      await reader.cancel(reason);
    } catch {
      // The upstream can already be closed after an error or timeout.
    }
  }

  function close(controller) {
    if (closed) return;
    closed = true;
    cleanup();
    controller.close();
  }

  // The pull-driven relay queues at most one completed SSE event, keeping the rest of the answer streamed.
  return new ReadableStream({
    async pull(controller) {
      if (closed) return;

      while (!closed) {
        const separator = separatorPattern.exec(pending);
        if (separator) {
          if (separator.index > MAX_SSE_EVENT_CHARACTERS) {
            controller.enqueue(encoder.encode(formatSseError(providerError())));
            await cancelUpstream("upstream event too large");
            close(controller);
            return;
          }

          const end = separator.index + separator[0].length;
          const rawEvent = pending.slice(0, end);
          pending = pending.slice(end);
          const inspected = inspectSseEvent(rawEvent);

          if (inspected.error) {
            controller.enqueue(encoder.encode(formatSseError(inspected.error)));
            await cancelUpstream("provider stream error");
            close(controller);
            return;
          }

          controller.enqueue(encoder.encode(rawEvent));
          if (inspected.done) {
            sawDone = true;
            await cancelUpstream("stream complete");
            close(controller);
          }
          return;
        }

        if (pending.length > MAX_SSE_EVENT_CHARACTERS) {
          controller.enqueue(encoder.encode(formatSseError(providerError())));
          await cancelUpstream("upstream event too large");
          close(controller);
          return;
        }

        if (upstreamEnded) {
          if (!sawDone) controller.enqueue(encoder.encode(formatSseError(networkError())));
          close(controller);
          return;
        }

        try {
          const { done, value } = await reader.read();
          if (done) {
            pending += decoder.decode();
            upstreamEnded = true;
            continue;
          }

          if (value && value.byteLength > 0) {
            timeoutGuard.activity();
            pending += decoder.decode(value, { stream: true });
          }
        } catch {
          if (request.signal.aborted && !timeoutGuard.timeoutReason) {
            close(controller);
            return;
          }

          const error = timeoutGuard.timeoutReason ? timeoutError() : networkError();
          controller.enqueue(encoder.encode(formatSseError(error)));
          close(controller);
          return;
        }
      }
    },
    async cancel(reason) {
      if (closed) return;
      closed = true;
      cleanup();
      await cancelUpstream(reason);
    },
  });
}

async function readJsonRequest(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) return null;

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_REQUEST_BYTES) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

/**
 * @param {Request} request
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof fetch,
 *   idleTimeoutMs?: number,
 *   totalTimeoutMs?: number,
 * }} options
 */
export async function handleChatRequest(request, options = {}) {
  const input = await readJsonRequest(request);
  const validation = validateChatInput(input);
  if (!validation.ok) {
    return jsonError(400, "invalid_request", "Проверьте текст запроса и попробуйте ещё раз.");
  }

  const env = options.env ?? process.env;
  const config = resolveProviderConfig(env);
  if (!config.ok) {
    return jsonError(500, "configuration_error", "Сервис временно недоступен.");
  }

  if (request.signal.aborted) return new Response(null, { status: 499 });

  const abortController = new AbortController();
  const timeoutGuard = createTimeoutGuard(abortController, {
    idleMs: options.idleTimeoutMs,
    totalMs: options.totalTimeoutMs,
  });
  const onClientAbort = () => {
    timeoutGuard.stop();
    if (!abortController.signal.aborted) abortController.abort(request.signal.reason);
  };
  const cleanup = () => {
    timeoutGuard.stop();
    request.signal.removeEventListener("abort", onClientAbort);
  };

  request.signal.addEventListener("abort", onClientAbort, { once: true });
  // Vercel signals a disconnected browser through request.signal; this controller also covers server timeouts.
  timeoutGuard.start();

  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...config.headers,
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  let upstreamResponse;
  try {
    upstreamResponse = await (options.fetchImpl ?? fetch)(config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: config.model, stream: true, messages: validation.messages }),
      signal: abortController.signal,
      cache: "no-store",
    });
  } catch {
    const timeout = timeoutGuard.timeoutReason;
    cleanup();
    if (request.signal.aborted && !timeout) return new Response(null, { status: 499 });
    if (timeout) return jsonError(504, "timeout", APP_ERRORS.timeout);
    return jsonError(502, "network_error", APP_ERRORS.network_error);
  }

  if (timeoutGuard.timeoutReason) {
    await cancelResponseBody(upstreamResponse.body);
    cleanup();
    return jsonError(504, "timeout", APP_ERRORS.timeout);
  }

  if (!upstreamResponse.ok) {
    await cancelResponseBody(upstreamResponse.body);
    cleanup();
    if (upstreamResponse.status === 429) {
      return jsonError(429, "rate_limited", APP_ERRORS.rate_limited);
    }
    return jsonError(502, "provider_error", APP_ERRORS.provider_error);
  }

  const responseContentType = upstreamResponse.headers.get("content-type")?.toLowerCase() ?? "";
  if (!responseContentType.includes("text/event-stream") || !upstreamResponse.body) {
    await cancelResponseBody(upstreamResponse.body);
    cleanup();
    return jsonError(502, "provider_error", APP_ERRORS.provider_error);
  }

  const body = createRelayedBody(upstreamResponse.body, {
    abortController,
    timeoutGuard,
    request,
    cleanup,
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** @param {Request} request */
export function POST(request) {
  return handleChatRequest(request);
}
