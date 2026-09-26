/**
 * One dictionary for the server response and the client message, so a code
 * always reads the same no matter which side detected the failure.
 */
export const CHAT_ERRORS = {
  forbidden: "Запрос отклонён. Откройте чат по основному адресу и попробуйте снова.",
  local_rate_limited: "Слишком много сообщений подряд. Подождите минуту и попробуйте снова.",
  rate_limited: "Бесплатная модель сейчас перегружена. Подождите и попробуйте ещё раз.",
  timeout: "Ответ не пришёл вовремя. Попробуйте ещё раз.",
  network_error: "Соединение прервалось. Проверьте сеть и попробуйте ещё раз.",
  invalid_request: "Проверьте текст запроса и попробуйте ещё раз.",
  configuration_error: "Сервис временно недоступен. Попробуйте позже.",
  provider_error: "Сервис временно недоступен. Попробуйте позже.",
};

/** @param {unknown} code */
export function isChatErrorCode(code) {
  return typeof code === "string" && Object.hasOwn(CHAT_ERRORS, code);
}

/** @param {unknown} code */
export function messageForErrorCode(code) {
  return isChatErrorCode(code) ? CHAT_ERRORS[code] : CHAT_ERRORS.provider_error;
}
