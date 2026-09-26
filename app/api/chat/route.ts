export const runtime = "nodejs";
// Hobby maximum with Fluid compute; a live answer is otherwise limited only by upstream inactivity.
export const maxDuration = 300;

import { POST as handleChatPost } from "./handler.mjs";

export function POST(request: Request) {
  return handleChatPost(request);
}
