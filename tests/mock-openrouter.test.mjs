import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createMockServer } from "./mock-openrouter.mjs";

const path = "/api/v1/chat/completions";
const payload = JSON.stringify({ model: "test:free", stream: true, messages: [{ role: "user", content: "Hi" }] });

async function withServer(run, options = {}) {
  const server = createMockServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}${path}`;
  try {
    await run(url);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function send(url, scenario, signal) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mock-scenario": scenario },
    body: payload,
    signal,
  });
}

test("success streams three deltas and finishes with [DONE]", async () => {
  await withServer(async (url) => {
    const response = await send(url, "success");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    const events = (await response.text()).trim().split("\n\n");
    assert.equal(events.length, 4);
    assert.deepEqual(events.slice(0, 3).map((event) => JSON.parse(event.slice(6)).choices[0].delta.content), ["Привет", ", это ", "тест."]);
    assert.equal(events[3], "data: [DONE]");
  });
});

test("rate limit is HTTP 429 with JSON; network and midstream failures end abruptly", async () => {
  await withServer(async (url) => {
    const limited = await send(url, "rate-limit");
    assert.equal(limited.status, 429);
    assert.match((await limited.json()).error.message, /rate limit/);

    await assert.rejects(send(url, "network-failure"));
    const partial = await send(url, "midstream-disconnect");
    assert.equal(partial.status, 200);
    await assert.rejects(partial.text());
  });
});

test("slow and timeout modes delay the first bytes by configurable amounts", async () => {
  await withServer(async (url) => {
    for (const [scenario, minimum] of [["slow", 50], ["timeout", 90]]) {
      const started = performance.now();
      const response = await send(url, scenario);
      assert.equal(response.status, 200);
      assert.ok(performance.now() - started >= minimum, `${scenario} returned too early`);
      assert.match(await response.text(), /data: \[DONE\]/);
    }
  }, { slowMs: 80, timeoutMs: 120 });
});

test("abort-observed sees client cancellation", async () => {
  let observed;
  const cancelled = new Promise((resolve) => { observed = resolve; });
  await withServer(async (url) => {
    const controller = new AbortController();
    const response = await send(url, "abort-observed", controller.signal);
    const reader = response.body.getReader();
    await reader.read();
    controller.abort();
    await Promise.race([
      cancelled,
      new Promise((_, reject) => setTimeout(() => reject(new Error("abort not observed")), 1_000)),
    ]);
  }, { onClientAbort: () => observed() });
});
