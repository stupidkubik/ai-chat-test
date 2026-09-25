export type ServerSentEvent = {
  event: string;
  data: string;
};

export function parseSseEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent>;
