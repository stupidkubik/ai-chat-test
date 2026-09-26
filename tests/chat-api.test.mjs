import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import {
  createRateLimiter,
  handleChatRequest,
  resolveProviderConfig,
} from "../app/api/chat/handler.mjs";
import { createMockServer } from "./mock-openrouter.mjs";

const validMessages = [{ role: "user", content: "Привет" }];
const testEnvironment = (endpoint, scenario) => ({
  NODE_ENV: "test",
  OPENROUTER_MOCK: "1",
  OPENROUTER_MOCK_URL: endpoint,
  ...(scenario ? { OPENROUTER_MOCK_SCENARIO: scenario } : {}),
});

function makeRequest(messages = validMessages, { signal, headers = {}, body } = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", ...headers },
    body: body ?? JSON.stringify({ messages }),
    signal,
  });
}

async function startMock(t, options = {}) {
  const server = createMockServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  }));
  return `http://127.0.0.1:${address.port}/api/v1/chat/completions`;
}

test("proxies the fixed free model as an SSE stream through the local mock", async (t) => {
  const endpoint = await startMock(t);
  let sentBody;
  let sentHeaders;
  const response = await handleChatRequest(
    makeRequest(validMessages, { headers: { "x-mock-scenario": "rate-limit" } }),
    {
      env: testEnvironment(endpoint),
      fetchImpl: (url, init) => {
        sentBody = JSON.parse(init.body);
        sentHeaders = new Headers(init.headers);
        return fetch(url, init);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  assert.match(response.headers.get("cache-control"), /no-transform/);
  assert.deepEqual(sentBody, { model: "openrouter/free", stream: true, messages: validMessages });
  assert.equal(sentHeaders.has("authorization"), false);
  assert.equal(sentHeaders.get("x-mock-scenario"), null);

  const stream = await response.text();
  assert.match(stream, /Привет/);
  assert.match(stream, /это/);
  assert.match(stream, /тест\./);
  assert.match(stream, /data: \[DONE\]/);
  assert.doesNotMatch(stream, /Free model rate limit/);
});

test("accepts a final DONE event without a trailing blank line", async () => {
  const response = await handleChatRequest(makeRequest(), {
    env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
    fetchImpl: async () => new Response(
      'data: {"choices":[{"delta":{"content":"Да"}}]}\n\ndata: [DONE]',
      { headers: { "content-type": "text/event-stream" } },
    ),
  });

  assert.equal(response.status, 200);
  assert.equal(
    await response.text(),
    'data: {"choices":[{"delta":{"content":"Да"}}]}\n\ndata: [DONE]\n\n',
  );
});

test("maps an upstream 429 to a safe JSON error", async (t) => {
  const endpoint = await startMock(t, { scenario: "rate-limit" });
  const response = await handleChatRequest(makeRequest(), {
    env: testEnvironment(endpoint),
  });

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    error: {
      code: "rate_limited",
      message: "Бесплатная модель сейчас перегружена. Подождите и попробуйте ещё раз.",
    },
  });
});

test("maps upstream HTTP timeouts to a safe 504 JSON error", async () => {
  for (const upstreamStatus of [408, 504]) {
    const response = await handleChatRequest(makeRequest(), {
      env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
      fetchImpl: async () => new Response("provider-private-detail", { status: upstreamStatus }),
    });

    assert.equal(response.status, 504, `upstream ${upstreamStatus}`);
    assert.deepEqual(await response.json(), {
      error: {
        code: "timeout",
        message: "Ответ не пришёл вовремя. Попробуйте ещё раз.",
      },
    });
  }
});

test("reports a midstream disconnect after preserving the received event", async (t) => {
  const endpoint = await startMock(t, { scenario: "midstream-disconnect" });
  const response = await handleChatRequest(makeRequest(), {
    env: testEnvironment(endpoint),
  });

  assert.equal(response.status, 200);
  const stream = await response.text();
  assert.match(stream, /Привет/);
  assert.match(stream, /event: error/);
  assert.match(stream, /"code":"network_error"/);
  assert.doesNotMatch(stream, /data: \[DONE\]/);
});

test("normalizes a provider SSE error without exposing its raw message", async () => {
  const response = await handleChatRequest(makeRequest(), {
    env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
    fetchImpl: async () => new Response(
      'data: {"error":{"code":429,"message":"provider-private-detail"}}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    ),
  });
  const stream = await response.text();

  assert.equal(response.status, 200);
  assert.match(stream, /event: error/);
  assert.match(stream, /"code":"rate_limited"/);
  assert.doesNotMatch(stream, /provider-private-detail/);
});

test("maps an upstream connection failure to a safe 502", async (t) => {
  const endpoint = await startMock(t, { scenario: "network-failure" });
  const response = await handleChatRequest(makeRequest(), {
    env: testEnvironment(endpoint),
  });

  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "network_error");
});

test("rejects invalid input before contacting the provider", async () => {
  const invalidBodies = [
    JSON.stringify({ messages: [{ role: "system", content: "x" }] }),
    JSON.stringify({ messages: [{ role: "user", content: "  " }] }),
    JSON.stringify({ messages: [{ role: "user", content: "x", name: "extra" }] }),
    JSON.stringify({ messages: validMessages, stream: true }),
    JSON.stringify({ messages: [{ role: "user", content: "x".repeat(4_001) }] }),
    JSON.stringify({ messages: Array.from({ length: 21 }, () => validMessages[0]) }),
    JSON.stringify({ messages: Array.from({ length: 6 }, () => ({ role: "user", content: "x".repeat(3_500) })) }),
    JSON.stringify({ messages: [{ role: "assistant", content: "x" }] }),
    JSON.stringify({ messages: [{ role: "user", content: "x" }, { role: "assistant", content: "y" }] }),
  ];
  let fetchCalls = 0;

  for (const body of invalidBodies) {
    const response = await handleChatRequest(makeRequest(undefined, { body }), {
      env: { NODE_ENV: "test", OPENROUTER_API_KEY: "not-used" },
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("Provider must not be called for invalid input");
      },
    });
    assert.equal(response.status, 400);
  }

  assert.equal(fetchCalls, 0);
});

test("production ignores mock routing and requires a real server key", async () => {
  const response = await handleChatRequest(makeRequest(), {
    env: {
      NODE_ENV: "production",
      OPENROUTER_MOCK: "1",
      OPENROUTER_MOCK_URL: "http://127.0.0.1:8787/api/v1/chat/completions",
    },
    fetchImpl: async () => {
      throw new Error("Production must not contact the mock");
    },
  });

  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, "configuration_error");
});

test("does not return an upstream authentication body or key to the browser", async () => {
  const testKey = "test-only-secret-key";
  const response = await handleChatRequest(makeRequest(), {
    env: { NODE_ENV: "production", OPENROUTER_API_KEY: testKey },
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${testKey}`);
      return new Response(JSON.stringify({ error: { message: testKey } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const body = await response.text();

  assert.equal(response.status, 502);
  assert.doesNotMatch(body, /test-only-secret-key/);
  assert.doesNotMatch(body, /Bearer/);
});

test("only loopback mock endpoints and known server scenarios are accepted", () => {
  assert.equal(resolveProviderConfig({
    NODE_ENV: "test",
    OPENROUTER_MOCK: "1",
    OPENROUTER_MOCK_URL: "http://127.0.0.1.evil.example/api/v1/chat/completions",
  }).ok, false);
  assert.equal(resolveProviderConfig({
    NODE_ENV: "test",
    OPENROUTER_MOCK: "1",
    OPENROUTER_MOCK_SCENARIO: "chosen-by-browser",
  }).ok, false);

  const productionConfig = resolveProviderConfig({
    NODE_ENV: "production",
    OPENROUTER_MOCK: "1",
    OPENROUTER_MOCK_URL: "http://127.0.0.1:8787/api/v1/chat/completions",
    OPENROUTER_API_KEY: "secret-for-this-assertion",
  });
  assert.equal(productionConfig.ok, true);
  assert.equal(productionConfig.endpoint, "https://openrouter.ai/api/v1/chat/completions");
  assert.deepEqual(productionConfig.headers, {});
});

test("returns an HTTP timeout before upstream headers arrive", async () => {
  const response = await handleChatRequest(makeRequest(), {
    env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
    idleTimeoutMs: 10,
    firstDataTimeoutMs: 100,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });

  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "timeout");
});

test("emits a timeout event when the upstream stalls after SSE starts", async () => {
  const response = await handleChatRequest(makeRequest(), {
    env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
    idleTimeoutMs: 15,
    firstDataTimeoutMs: 100,
    fetchImpl: async (_url, { signal }) => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(": upstream is working\n\n"));
          signal.addEventListener("abort", () => controller.error(new Error("aborted")), { once: true });
        },
      });
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    },
  });

  const stream = await response.text();
  assert.match(stream, /: upstream is working/);
  assert.match(stream, /event: error/);
  assert.match(stream, /"code":"timeout"/);
});

test("aborting the incoming request closes the upstream mock connection", async (t) => {
  let resolveAbort;
  const observedAbort = new Promise((resolve) => { resolveAbort = resolve; });
  const endpoint = await startMock(t, {
    scenario: "abort-observed",
    onClientAbort: resolveAbort,
  });
  const requestController = new AbortController();
  const response = await handleChatRequest(makeRequest(validMessages, {
    signal: requestController.signal,
  }), {
    env: testEnvironment(endpoint, "abort-observed"),
  });
  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  assert.equal(firstChunk.done, false);

  requestController.abort();
  const didReachMock = await Promise.race([
    observedAbort.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 1_000)),
  ]);
  await reader.cancel().catch(() => {});

  assert.equal(didReachMock, true);
});

test("rejects requests without a same-origin signal before reading the body", async () => {
  const foreignRequests = [
    makeRequest(validMessages, { headers: { origin: "" } }),
    makeRequest(validMessages, { headers: { origin: "https://evil.example" } }),
    makeRequest(validMessages, { headers: { "sec-fetch-site": "cross-site" } }),
  ];
  let fetchCalls = 0;

  for (const request of foreignRequests) {
    const response = await handleChatRequest(request, {
      env: { NODE_ENV: "test", OPENROUTER_API_KEY: "not-used" },
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("Provider must not be called for a foreign origin");
      },
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "forbidden");
  }

  assert.equal(fetchCalls, 0);
});

test("accepts a browser same-origin request behind a proxy host", async () => {
  const response = await handleChatRequest(makeRequest(validMessages, {
    headers: { origin: "https://chat.example", "x-forwarded-host": "chat.example" },
  }), {
    env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
    fetchImpl: async () => new Response("data: [DONE]\n\n", {
      headers: { "content-type": "text/event-stream" },
    }),
  });

  assert.equal(response.status, 200);
});

test("limits requests per client IP within the window", async () => {
  let currentTime = 0;
  const rateLimiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => currentTime });
  const send = (ip) => handleChatRequest(makeRequest(validMessages, {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  }), {
    env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
    rateLimiter,
    fetchImpl: async () => new Response("data: [DONE]\n\n", {
      headers: { "content-type": "text/event-stream" },
    }),
  });

  assert.equal((await send("203.0.113.1")).status, 200);
  currentTime = 1_000;
  assert.equal((await send("203.0.113.1")).status, 200);

  const limited = await send("203.0.113.1");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "59");
  assert.equal((await limited.json()).error.code, "local_rate_limited");

  assert.equal((await send("203.0.113.2")).status, 200, "another IP keeps its own quota");

  currentTime = 60_001;
  assert.equal((await send("203.0.113.1")).status, 200, "the window slides forward");
});

function slowStream(events, delayMs) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const event of events) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
}

test("a live stream longer than the first-data deadline is not cut off", async () => {
  const chunks = Array.from({ length: 8 }, (_, index) => (
    `data: ${JSON.stringify({ choices: [{ delta: { content: `часть ${index} ` } }] })}\n\n`
  ));
  const response = await handleChatRequest(makeRequest(), {
    env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
    idleTimeoutMs: 100,
    firstDataTimeoutMs: 60,
    fetchImpl: async () => new Response(slowStream([...chunks, "data: [DONE]\n\n"], 25), {
      headers: { "content-type": "text/event-stream" },
    }),
  });

  const stream = await response.text();
  assert.match(stream, /часть 7/);
  assert.match(stream, /data: \[DONE\]/);
  assert.doesNotMatch(stream, /event: error/);
});

test("keepalive comments alone do not satisfy the first-data deadline", async () => {
  const response = await handleChatRequest(makeRequest(), {
    env: { NODE_ENV: "test", OPENROUTER_MOCK: "1" },
    idleTimeoutMs: 100,
    firstDataTimeoutMs: 60,
    fetchImpl: async (_url, { signal }) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          const timer = setInterval(() => controller.enqueue(encoder.encode(": OPENROUTER PROCESSING\n\n")), 20);
          signal.addEventListener("abort", () => {
            clearInterval(timer);
            controller.error(new Error("aborted"));
          }, { once: true });
        },
      });
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    },
  });

  const stream = await response.text();
  assert.match(stream, /OPENROUTER PROCESSING/);
  assert.match(stream, /"code":"timeout"/);
});
