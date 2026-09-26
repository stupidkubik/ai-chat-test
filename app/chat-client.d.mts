import type { ChatErrorCode } from "./chat-errors.mjs";
import type { RequestMessage } from "./chat-context.mjs";

export class ChatRequestError extends Error {
  constructor(code: unknown);
  code: ChatErrorCode;
}

export function streamChat(options: {
  messages: RequestMessage[];
  controller: AbortController;
  onDelta: (delta: string) => void;
  fetchImpl?: typeof fetch;
  idleTimeoutMs?: number;
}): Promise<void>;
