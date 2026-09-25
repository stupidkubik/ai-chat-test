const MAX_EVENT_CHARACTERS = 1_048_576;
const EVENT_SEPARATOR = /(?:\r\n|\r|\n){2}/;

/**
 * @typedef {{ event: string, data: string }} ServerSentEvent
 */

/** @param {string} rawEvent */
function parseEvent(rawEvent) {
  let event = "message";
  const dataLines = [];

  for (const line of rawEvent.split(/\r\n|\r|\n/)) {
    if (!line || line.startsWith(":")) continue;

    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0 && event === "message") return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * Decode SSE by event boundaries, not by network chunks. A single UTF-8 character
 * or event can arrive in several reads, so both the decoder and text buffer persist.
 *
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {AsyncGenerator<ServerSentEvent>}
 */
export async function* parseSseEvents(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });

      let separator = EVENT_SEPARATOR.exec(pending);
      while (separator) {
        if (separator.index > MAX_EVENT_CHARACTERS) {
          throw new Error("SSE event exceeded the client limit");
        }

        const rawEvent = pending.slice(0, separator.index);
        pending = pending.slice(separator.index + separator[0].length);
        const event = parseEvent(rawEvent);
        if (event) yield event;
        separator = EVENT_SEPARATOR.exec(pending);
      }

      if (done) {
        if (pending.length > MAX_EVENT_CHARACTERS) {
          throw new Error("SSE event exceeded the client limit");
        }

        const finalEvent = parseEvent(pending);
        if (finalEvent) yield finalEvent;
        return;
      }

      if (pending.length > MAX_EVENT_CHARACTERS) {
        throw new Error("SSE event exceeded the client limit");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
