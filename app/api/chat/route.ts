export const runtime = "nodejs";
export const maxDuration = 120;

import { handleChatRequest } from "./handler.mjs";

export function POST(request: Request) {
  return handleChatRequest(request);
}
