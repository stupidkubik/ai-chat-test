import assert from "node:assert/strict";
import test from "node:test";
import { ChatRequestError, streamChat } from "../app/chat-client.mjs";

const encoder = new TextEncoder();
const messages = [{ role: "user", content: "Привет" }];
const delta = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

function sseResponse(body, init = {}) {
  return new Response(body, { headers: { "content-type": "text/event-stream" }, ...init });
}

/** A body the test pushes into by hand, so it can act between two chunks. */
function manualStream(signal) {
  let controller;
  const body = new ReadableStream({ start(streamController) { controller = streamController; } });
  signal.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")), { once: true });
  return { body, push: (text) => controller.enqueue(encoder.encode(text)) };
}

async function rejectsWithCode(promise, code) {
  await assert.rejects(promise, (error) => error instanceof ChatRequestError && error.code === code);
}

test("streams fragments in order and resolves on DONE", async () => {
  const received = [];
  let sentBody;
  await streamChat({
    messages,
    controller: new AbortController(),
    onDelta: (text) => received.push(text),
    fetchImpl: async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return sseResponse(`: keepalive\n\n${delta("При")}${delta("вет")}data: [DONE]\n\n`);
    },
  });

  assert.deepEqual(received, ["При", "вет"]);
  assert.deepEqual(sentBody, { messages });
});

test("after Stop no late fragments are delivered and the partial text stays with the caller", async () => {
  const controller = new AbortController();
  const received = [];
  let stream;
  let firstDelta;
  const gotFirst = new Promise((resolve) => { firstDelta = resolve; });

  const request = streamChat({
    messages,
    controller,
    onDelta: (text) => {
      received.push(text);
      firstDelta();
    },
    fetchImpl: async (_url, { signal }) => {
      stream = manualStream(signal);
      return sseResponse(stream.body);
    },
  });

  await new Promise((resolve) => setImmediate(resolve));
  stream.push(delta("Часть"));
  await gotFirst;
  controller.abort();
  // The stream is already errored by the abort, so this late chunk cannot be read.
  assert.throws(() => stream.push(delta(" лишнее")));

  await request.catch(() => {});
  assert.deepEqual(received, ["Часть"]);
});

test("Stop drops a fragment that already arrived in the same network chunk", async () => {
  const controller = new AbortController();
  const received = [];
  await streamChat({
    messages,
    controller,
    onDelta: (text) => {
      received.push(text);
      controller.abort();
    },
    fetchImpl: async () => sseResponse(`${delta("Первый")}${delta("Второй")}data: [DONE]\n\n`),
  }).catch(() => {});

  assert.deepEqual(received, ["Первый"]);
});

test("maps HTTP error responses to shared codes", async () => {
  const cases = [
    [new Response(JSON.stringify({ error: { code: "forbidden" } }), { status: 403 }), "forbidden"],
    [new Response(JSON.stringify({ error: { code: "local_rate_limited" } }), { status: 429 }), "local_rate_limited"],
    [new Response("not json", { status: 429 }), "rate_limited"],
    [new Response("", { status: 504 }), "timeout"],
    [new Response(JSON.stringify({ error: { code: "made_up" } }), { status: 500 }), "provider_error"],
  ];

  for (const [response, code] of cases) {
    await rejectsWithCode(streamChat({
      messages,
      controller: new AbortController(),
      onDelta: () => {},
      fetchImpl: async () => response,
    }), code);
  }
});

test("an SSE error event ends the request with its code, keeping earlier fragments", async () => {
  const received = [];
  await rejectsWithCode(streamChat({
    messages,
    controller: new AbortController(),
    onDelta: (text) => received.push(text),
    fetchImpl: async () => sseResponse(`${delta("Начало")}event: error\ndata: {"error":{"code":"timeout"}}\n\n`),
  }), "timeout");

  assert.deepEqual(received, ["Начало"]);
});

test("a stream that closes without DONE is a network error", async () => {
  await rejectsWithCode(streamChat({
    messages,
    controller: new AbortController(),
    onDelta: () => {},
    fetchImpl: async () => sseResponse(delta("Оборвано")),
  }), "network_error");
});

test("a failed fetch is a network error", async () => {
  await rejectsWithCode(streamChat({
    messages,
    controller: new AbortController(),
    onDelta: () => {},
    fetchImpl: async () => { throw new TypeError("Failed to fetch"); },
  }), "network_error");
});

test("the idle timeout resets on every chunk and fires on silence", async () => {
  const controller = new AbortController();
  let stream;
  const request = streamChat({
    messages,
    controller,
    onDelta: () => {},
    idleTimeoutMs: 40,
    fetchImpl: async (_url, { signal }) => {
      stream = manualStream(signal);
      return sseResponse(stream.body);
    },
  });

  // Three chunks 25 ms apart outlive one idle period without tripping it.
  for (let index = 0; index < 3; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    stream.push(": keepalive\n\n");
  }
  assert.equal(controller.signal.aborted, false);

  await rejectsWithCode(request, "timeout");
  assert.equal(controller.signal.aborted, true);
});
