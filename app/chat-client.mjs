import { isChatErrorCode } from "./chat-errors.mjs";
import { consumeSseEvents, SseParseError } from "./chat-stream.mjs";

// Longer than the server's 45 s upstream idle limit, so the server reports a stall first
// and this timer only catches a connection that went silent between browser and server.
const CLIENT_IDLE_TIMEOUT_MS = 60_000;

export class ChatRequestError extends Error {
  /** @param {unknown} code */
  constructor(code) {
    const safeCode = isChatErrorCode(code) ? code : "provider_error";
    super(safeCode);
    this.name = "ChatRequestError";
    this.code = safeCode;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorCodeFrom(value) {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  return typeof value.error.code === "string" ? value.error.code : null;
}

function errorCodeForStatus(status) {
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 504) return "timeout";
  if (status === 400) return "invalid_request";
  return "provider_error";
}

/** @param {Response} response */
async function responseErrorCode(response) {
  try {
    return errorCodeFrom(await response.json()) ?? errorCodeForStatus(response.status);
  } catch {
    return errorCodeForStatus(response.status);
  }
}

/** @param {import("./chat-stream.mjs").ServerSentEvent} event */
function deltaFromEvent(event) {
  if (event.event === "error") {
    let code = "provider_error";
    try {
      code = errorCodeFrom(JSON.parse(event.data)) ?? code;
    } catch {
      // An unknown error event still ends in a safe, human-readable message.
    }
    throw new ChatRequestError(code);
  }

  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch {
    throw new ChatRequestError("provider_error");
  }

  const payloadError = errorCodeFrom(payload);
  if (payloadError) throw new ChatRequestError(payloadError);
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return "";

  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.delta)) return "";
  const delta = choice.delta.content;
  return typeof delta === "string" ? delta : "";
}

/**
 * Sends one chat request and streams answer fragments to onDelta. Resolves after [DONE].
 * Every failure is thrown as a ChatRequestError with a code from the shared dictionary;
 * when the caller aborts the controller itself, no more fragments are delivered.
 *
 * @param {{
 *   messages: Array<{ role: "user" | "assistant", content: string }>,
 *   controller: AbortController,
 *   onDelta: (delta: string) => void,
 *   fetchImpl?: typeof fetch,
 *   idleTimeoutMs?: number,
 * }} options
 */
export async function streamChat({
  messages,
  controller,
  onDelta,
  fetchImpl = fetch,
  idleTimeoutMs = CLIENT_IDLE_TIMEOUT_MS,
}) {
  let timedOut = false;
  let idleTimer;
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, idleTimeoutMs);
  };

  resetIdleTimer();
  try {
    const response = await fetchImpl("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) throw new ChatRequestError(await responseErrorCode(response));
    if (!response.body) throw new ChatRequestError("network_error");

    let receivedDone = false;
    await consumeSseEvents(response.body, controller, (event) => {
      if (event.data === "[DONE]") {
        receivedDone = true;
        return false;
      }
      if (!event.data && event.event !== "error") return;

      const delta = deltaFromEvent(event);
      if (delta && !controller.signal.aborted) onDelta(delta);
    }, { onChunk: resetIdleTimer });

    if (!receivedDone && !controller.signal.aborted) throw new ChatRequestError("network_error");
  } catch (error) {
    // Stop any response work still in flight before reporting the failure.
    controller.abort();
    if (timedOut) throw new ChatRequestError("timeout");
    if (error instanceof ChatRequestError) throw error;
    if (error instanceof SseParseError) throw new ChatRequestError("provider_error");
    throw new ChatRequestError("network_error");
  } finally {
    clearTimeout(idleTimer);
  }
}
