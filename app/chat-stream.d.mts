export type ServerSentEvent = {
  event: string;
  data: string;
};

export class SseParseError extends Error {
  constructor();
}

export type SseReadOptions = {
  onChunk?: () => void;
};

export function parseSseEvents(
  stream: ReadableStream<Uint8Array>,
  options?: SseReadOptions,
): AsyncGenerator<ServerSentEvent>;

export function consumeSseEvents(
  stream: ReadableStream<Uint8Array>,
  controller: AbortController,
  onEvent: (event: ServerSentEvent) => boolean | void,
  options?: SseReadOptions,
): Promise<void>;
