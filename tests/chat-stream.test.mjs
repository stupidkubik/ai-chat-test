import assert from "node:assert/strict";
import test from "node:test";
import { consumeSseEvents, parseSseEvents, SseParseError } from "../app/chat-stream.mjs";

function createStream(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function collectEvents(stream) {
  const events = [];
  for await (const event of parseSseEvents(stream)) events.push(event);
  return events;
}

test("parses events across network chunks, including a split UTF-8 character", async () => {
  const encoder = new TextEncoder();
  const text = ': keep-alive\r\nevent: message\r\ndata: {"choices":[{"delta":{"content":"Привет"}}]}\r\n\r\nevent: error\ndata: {"error":{"code":"network_error"}}\n\n';
  const bytes = encoder.encode(text);
  const splitInsideCyrillic = encoder.encode(text.slice(0, text.indexOf("Привет"))).length + 1;
  const chunks = [
    bytes.slice(0, splitInsideCyrillic),
    bytes.slice(splitInsideCyrillic, splitInsideCyrillic + 9),
    bytes.slice(splitInsideCyrillic + 9),
  ];

  assert.deepEqual(await collectEvents(createStream(chunks)), [
    {
      event: "message",
      data: '{"choices":[{"delta":{"content":"Привет"}}]}',
    },
    { event: "error", data: '{"error":{"code":"network_error"}}' },
  ]);
});

test("joins multiple data lines and dispatches the final event at end of stream", async () => {
  const encoder = new TextEncoder();
  const stream = createStream([
    encoder.encode("event: note\ndata: first\ndata: second"),
  ]);

  assert.deepEqual(await collectEvents(stream), [
    { event: "note", data: "first\nsecond" },
  ]);
});

test("rejects an oversized event instead of buffering it without a limit", async () => {
  const stream = createStream([new TextEncoder().encode(`data: ${"x".repeat(1_048_577)}`)]);

  await assert.rejects(collectEvents(stream), SseParseError);
});

test("aborts an open request when SSE parsing fails", async () => {
  const controller = new AbortController();
  let abortObserved = false;
  const stream = new ReadableStream({
    start(streamController) {
      streamController.enqueue(new TextEncoder().encode(`data: ${"x".repeat(1_048_577)}`));
      controller.signal.addEventListener("abort", () => {
        abortObserved = true;
        streamController.error(new DOMException("Request aborted", "AbortError"));
      }, { once: true });
    },
  });

  await assert.rejects(consumeSseEvents(stream, controller, () => undefined), SseParseError);
  assert.equal(controller.signal.aborted, true);
  assert.equal(abortObserved, true);
});
