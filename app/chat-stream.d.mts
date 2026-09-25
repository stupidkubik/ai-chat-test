export type ServerSentEvent = {
  event: string;
  data: string;
};

export class SseParseError extends Error {
  constructor();
}

export function parseSseEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent>;

export function consumeSseEvents(
  stream: ReadableStream<Uint8Array>,
  controller: AbortController,
  onEvent: (event: ServerSentEvent) => boolean | void,
): Promise<void>;
