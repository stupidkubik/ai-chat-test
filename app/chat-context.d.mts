export type RequestMessage = {
  role: "user" | "assistant";
  content: string;
};

type HistoryMessage = {
  role: "user" | "assistant";
  text: string;
};

export const MAX_MESSAGE_CHARACTERS: number;

export function buildRequestMessages(
  history: HistoryMessage[],
  currentText: string,
): RequestMessage[];
