import http from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const endpoint = "/api/v1/chat/completions";
const scenarios = new Set([
  "success", "rate-limit", "network-failure", "midstream-disconnect",
  "slow", "timeout", "abort-observed",
]);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function delta(content) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\n`;
}

function startSse(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
}

async function readRequest(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 65_536) throw new Error("request too large");
  }
  const parsed = JSON.parse(body);
  if (!Array.isArray(parsed.messages) || parsed.stream !== true) {
    throw new Error("expected messages and stream: true");
  }
}

export function createMockServer({ scenario = "success", slowMs = 600, timeoutMs = 2_000, onClientAbort = () => {} } = {}) {
  return http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== endpoint) {
      response.writeHead(404).end();
      return;
    }

    try {
      await readRequest(request);
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Invalid mock request" } }));
      return;
    }

    const selected = request.headers["x-mock-scenario"] ?? scenario;
    if (typeof selected !== "string" || !scenarios.has(selected)) {
      response.writeHead(400).end("Unknown mock scenario");
      return;
    }

    if (selected === "rate-limit") {
      response.writeHead(429, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Free model rate limit" } }));
      return;
    }
    if (selected === "network-failure") {
      request.socket.destroy();
      return;
    }
    if (selected === "slow") await pause(slowMs);
    if (selected === "timeout") await pause(timeoutMs);
    if (response.destroyed) return;

    startSse(response);
    if (selected === "abort-observed") {
      response.on("close", () => {
        if (!response.writableEnded) onClientAbort();
      });
      response.write(": waiting for client cancellation\n\n");
      return;
    }

    const first = delta("Привет");
    // Deliberately split one SSE event; consumers must not assume one read is one event.
    response.write(first.slice(0, 13));
    await pause(10);
    if (response.destroyed) return;
    response.write(first.slice(13));

    if (selected === "midstream-disconnect") {
      await pause(20);
      response.destroy();
      return;
    }

    await pause(20);
    if (response.destroyed) return;
    response.write(delta(", это "));
    await pause(20);
    if (response.destroyed) return;
    response.write(delta("тест."));
    response.end("data: [DONE]\n\n");
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.MOCK_PORT ?? 8787);
  const scenario = process.env.MOCK_SCENARIO ?? "success";
  const server = createMockServer({
    scenario,
    slowMs: Number(process.env.MOCK_SLOW_MS ?? 600),
    timeoutMs: Number(process.env.MOCK_TIMEOUT_MS ?? 2_000),
    onClientAbort: () => process.stdout.write("Client connection closed after abort\n"),
  });
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`Mock OpenRouter listening on http://127.0.0.1:${port}${endpoint} (${scenario})\n`);
  });
}
