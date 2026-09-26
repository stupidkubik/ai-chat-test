export type ChatErrorCode =
  | "forbidden"
  | "local_rate_limited"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "invalid_request"
  | "configuration_error"
  | "provider_error";

export const CHAT_ERRORS: Record<ChatErrorCode, string>;

export function isChatErrorCode(code: unknown): code is ChatErrorCode;

export function messageForErrorCode(code: unknown): string;
