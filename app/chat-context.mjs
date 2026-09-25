const MAX_MESSAGES = 20;
export const MAX_MESSAGE_CHARACTERS = 4_000;
const MAX_TOTAL_CHARACTERS = 20_000;

/** @typedef {{ role: "user" | "assistant", content: string }} RequestMessage */
/** @typedef {{ role: "user" | "assistant", text: string }} HistoryMessage */

/**
 * Build a bounded API context while removing every user turn with no answer.
 * Partial answers remain in context so a stopped response can still be continued.
 *
 * @param {HistoryMessage[]} history
 * @param {string} currentText
 * @returns {RequestMessage[]}
 */
export function buildRequestMessages(history, currentText) {
  const previous = [];

  for (const message of history) {
    if (message.role === "assistant" && !message.text.trim()) {
      // Omit the unanswered pair from the request only; the UI keeps the transcript unchanged.
      if (previous.at(-1)?.role === "user") previous.pop();
      continue;
    }

    previous.push(message);
  }

  const candidates = previous
    .filter((message) => message.text.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.text }));
  candidates.push({
    role: "user",
    content: currentText.trim().slice(0, MAX_MESSAGE_CHARACTERS),
  });

  const selected = [];
  let totalCharacters = 0;

  for (const message of candidates.slice(-MAX_MESSAGES).reverse()) {
    const availableCharacters = MAX_TOTAL_CHARACTERS - totalCharacters;
    if (availableCharacters <= 0) break;

    let content = message.content;
    if (content.length > MAX_MESSAGE_CHARACTERS) {
      content = message.role === "assistant"
        ? content.slice(-MAX_MESSAGE_CHARACTERS)
        : content.slice(0, MAX_MESSAGE_CHARACTERS);
    }
    if (content.length > availableCharacters) {
      content = message.role === "assistant"
        ? content.slice(-availableCharacters)
        : content.slice(0, availableCharacters);
    }
    if (!content.trim()) continue;

    selected.push({ role: message.role, content });
    totalCharacters += content.length;
  }

  selected.reverse();
  while (selected[0]?.role === "assistant") selected.shift();
  return selected;
}
