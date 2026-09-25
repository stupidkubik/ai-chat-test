export const DEMO_STATES = ["empty", "message", "streaming", "stopped", "error"] as const;
export type DemoState = (typeof DEMO_STATES)[number];

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};
