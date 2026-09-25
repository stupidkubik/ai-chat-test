"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { parseSseEvents } from "./chat-stream.mjs";
import { DEMO_STATES, type ChatMessage, type DemoState } from "./chat-types";

type ChatExperienceProps = {
  initialState: DemoState;
  showDemoControls: boolean;
};

type RequestMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARACTERS = 4_000;
const MAX_TOTAL_CHARACTERS = 20_000;
const CLIENT_TIMEOUT_MS = 100_000;

const demoLabels: Record<DemoState, string> = {
  empty: "Пустой чат",
  message: "Сообщение",
  streaming: "Поток",
  stopped: "Остановлено",
  error: "Ошибка",
};

const followUpQuestion: ChatMessage = {
  id: "question-2",
  role: "user",
  text: "А что лучше повторить про useEffect?",
};

const followUpAnswer: ChatMessage = {
  id: "answer-2",
  role: "assistant",
  text: "Разберите, когда эффект действительно нужен, как работает массив зависимостей и зачем возвращать функцию очистки. Хороший пример — подписка на событие: при изменении зависимости старая подписка должна быть снята.",
};

const conversation: ChatMessage[] = [
  {
    id: "question-1",
    role: "user",
    text: "Как подготовиться к собеседованию по React?",
  },
  {
    id: "answer-1",
    role: "assistant",
    text: "Повторите компоненты, состояние и эффекты. Затем соберите небольшой экран и объясните свои решения вслух.",
  },
  followUpQuestion,
  { ...followUpAnswer, status: "streaming" },
];

const demoMessages: Record<DemoState, ChatMessage[]> = {
  empty: [],
  message: [
    {
      id: "demo-question",
      role: "user",
      text: "Как устроены Server Components в Next.js?",
    },
  ],
  streaming: conversation,
  stopped: [
    followUpQuestion,
    {
      ...followUpAnswer,
      text: "Разберите, когда эффект действительно нужен, как работает массив зависимостей и зачем возвращать функцию очистки.",
      status: "stopped",
      statusMessage: "Ответ остановлен",
    },
  ],
  error: [
    followUpQuestion,
    {
      ...followUpAnswer,
      text: "Разберите, когда эффект действительно нужен, как работает массив зависимостей и зачем возвращать функцию очистки. Хороший пример — подписка на событие: при изменении зависимости старая подписка",
      status: "error",
      statusMessage: "Соединение прервалось. Проверьте сеть и отправьте сообщение ещё раз.",
    },
  ],
};

const errorMessages: Record<string, string> = {
  rate_limited: "Лимит запросов к бесплатной модели достигнут. Подождите и попробуйте ещё раз.",
  timeout: "Ответ занял слишком много времени. Попробуйте ещё раз.",
  network_error: "Соединение прервалось. Проверьте сеть и отправьте сообщение ещё раз.",
  invalid_request: "Проверьте вопрос и попробуйте ещё раз.",
  configuration_error: "Сервис временно недоступен. Попробуйте позже.",
  provider_error: "Сервис временно недоступен. Попробуйте позже.",
};

class ChatRequestError extends Error {
  code: string;

  constructor(code: string) {
    const safeCode = Object.hasOwn(errorMessages, code) ? code : "provider_error";
    super(messageForErrorCode(safeCode));
    this.code = safeCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorCodeFrom(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  return typeof value.error.code === "string" ? value.error.code : null;
}

function errorCodeForStatus(status: number): string {
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 504) return "timeout";
  if (status === 400) return "invalid_request";
  return "provider_error";
}

function messageForErrorCode(code: string): string {
  return Object.hasOwn(errorMessages, code)
    ? errorMessages[code]
    : errorMessages.provider_error;
}

async function responseErrorCode(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    return errorCodeFrom(payload) ?? errorCodeForStatus(response.status);
  } catch {
    return errorCodeForStatus(response.status);
  }
}

function buildRequestMessages(history: ChatMessage[], currentText: string): RequestMessage[] {
  const previous = [...history];

  // A failed request with no answer should stay visible, but it is not useful model context.
  if (previous.at(-1)?.role === "assistant" && !previous.at(-1)?.text.trim()) {
    previous.pop();
    if (previous.at(-1)?.role === "user") previous.pop();
  }

  const candidates: RequestMessage[] = previous
    .filter((message) => message.text.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.text }));
  candidates.push({
    role: "user",
    content: currentText.trim().slice(0, MAX_MESSAGE_CHARACTERS),
  });

  const selected: RequestMessage[] = [];
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

function createMessageId(): string {
  return globalThis.crypto.randomUUID();
}

export default function ChatExperience({
  initialState,
  showDemoControls,
}: ChatExperienceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [demoState, setDemoState] = useState<DemoState | null>(
    showDemoControls ? initialState : null,
  );
  const [draft, setDraft] = useState("");
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const threadRef = useRef<HTMLOListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGenerating = activeAssistantId !== null;
  const isStreamingPreview = demoState === "streaming";
  const showStopButton = isGenerating || isStreamingPreview;
  const displayedMessages = demoState === null ? messages : demoMessages[demoState];
  const latestMessage = displayedMessages[displayedMessages.length - 1];
  const hasMessages = displayedMessages.length > 0;

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;

    if (demoState !== null || shouldStickToBottomRef.current) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [demoState, messages]);

  const stopGeneration = useCallback(() => {
    const controller = activeControllerRef.current;
    const assistantId = activeAssistantId;
    if (!controller || !assistantId) return;

    // Clear the ref first so a read already queued by fetch cannot append after Stop.
    activeControllerRef.current = null;
    controller.abort();
    setActiveAssistantId(null);
    setMessages((current) => current.map((message) => (
      message.id === assistantId
        ? {
            ...message,
            status: "stopped",
            statusMessage: message.text ? "Ответ остановлен" : "Ответ остановлен до начала",
          }
        : message
    )));
    textareaRef.current?.focus();
  }, [activeAssistantId]);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || !activeControllerRef.current) return;
      event.preventDefault();
      stopGeneration();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [stopGeneration]);

  useEffect(() => () => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
  }, []);

  function selectDemoState(nextState: DemoState) {
    if (activeControllerRef.current) return;
    setMessages([]);
    setDraft("");
    shouldStickToBottomRef.current = true;
    setDemoState(nextState);
  }

  async function sendMessage(text: string, history: ChatMessage[]) {
    if (activeControllerRef.current) return;

    const userText = text.trim();
    if (!userText) return;

    const requestMessages = buildRequestMessages(history, userText);
    const userId = createMessageId();
    const assistantId = createMessageId();
    const controller = new AbortController();
    let clientTimedOut = false;

    activeControllerRef.current = controller;
    setActiveAssistantId(assistantId);
    setDemoState(null);
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", text: userText },
      { id: assistantId, role: "assistant", text: "", status: "streaming" },
    ]);
    setDraft("");
    shouldStickToBottomRef.current = true;
    textareaRef.current?.focus();

    const clientTimeout = window.setTimeout(() => {
      if (activeControllerRef.current !== controller) return;
      clientTimedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (activeControllerRef.current !== controller) return;
      if (!response.ok) {
        throw new ChatRequestError(await responseErrorCode(response));
      }
      if (!response.body) throw new ChatRequestError("network_error");

      let receivedDone = false;

      for await (const event of parseSseEvents(response.body)) {
        if (activeControllerRef.current !== controller || controller.signal.aborted) return;

        if (event.event === "error") {
          let code = "provider_error";
          try {
            code = errorCodeFrom(JSON.parse(event.data)) ?? code;
          } catch {
            // An unknown error event still ends in a safe, human-readable message.
          }
          throw new ChatRequestError(code);
        }

        if (event.data === "[DONE]") {
          receivedDone = true;
          break;
        }
        if (!event.data) continue;

        let payload: unknown;
        try {
          payload = JSON.parse(event.data);
        } catch {
          throw new ChatRequestError("provider_error");
        }

        const payloadError = errorCodeFrom(payload);
        if (payloadError) throw new ChatRequestError(payloadError);
        if (!isRecord(payload) || !Array.isArray(payload.choices)) continue;

        const choice = payload.choices[0];
        if (!isRecord(choice) || !isRecord(choice.delta)) continue;
        const delta = choice.delta.content;
        if (typeof delta !== "string" || delta.length === 0) continue;

        setMessages((current) => current.map((message) => (
          message.id === assistantId
            ? { ...message, text: message.text + delta }
            : message
        )));
      }

      if (!receivedDone) throw new ChatRequestError("network_error");

      setMessages((current) => current.map((message) => {
        if (message.id !== assistantId) return message;
        return { id: message.id, role: message.role, text: message.text };
      }));
    } catch (error) {
      if (activeControllerRef.current !== controller) return;
      if (controller.signal.aborted && !clientTimedOut) return;

      const code = clientTimedOut
        ? "timeout"
        : error instanceof ChatRequestError
          ? error.code
          : "network_error";
      setMessages((current) => current.map((message) => (
        message.id === assistantId
          ? { ...message, status: "error", statusMessage: messageForErrorCode(code) }
          : message
      )));
    } finally {
      window.clearTimeout(clientTimeout);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
        setActiveAssistantId(null);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isGenerating || isStreamingPreview || activeControllerRef.current) return;
    void sendMessage(message, messages);
  }

  function handleStopClick() {
    if (isGenerating) {
      stopGeneration();
    } else if (isStreamingPreview) {
      setDemoState("stopped");
      textareaRef.current?.focus();
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function updateScrollPosition() {
    const thread = threadRef.current;
    if (!thread) return;

    const distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 80;
  }

  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          <span className="brandmark" aria-hidden="true">д</span>
          <span>диалог</span>
        </div>
      </header>

      {showDemoControls && (
        <aside className="demo-tools" aria-label="Локальные примеры состояний">
          <span className="demo-tools-label">Примеры состояний</span>
          <div className="demo-options" role="group" aria-label="Выберите состояние чата">
            {DEMO_STATES.map((demoStateOption) => (
              <button
                aria-pressed={demoState === demoStateOption}
                className="demo-option"
                disabled={isGenerating}
                key={demoStateOption}
                onClick={() => selectDemoState(demoStateOption)}
                type="button"
              >
                {demoLabels[demoStateOption]}
              </button>
            ))}
          </div>
        </aside>
      )}

      <main className="workspace">
        <h1 className="sr-only">Диалог с ИИ</h1>

        {!hasMessages && (
          <section className="empty-state" aria-labelledby="empty-title">
            <h2 id="empty-title">Начните разговор</h2>
            <p>Задайте вопрос — ответ появится по мере генерации.</p>
          </section>
        )}

        {hasMessages && (
          <ol
            aria-label="История разговора"
            className="thread"
            onScroll={updateScrollPosition}
            ref={threadRef}
            tabIndex={0}
          >
            {displayedMessages.map((message) => {
              const isLatestAnswer = message.id === latestMessage?.id && message.role === "assistant";

              return (
                <li className={`message ${message.role}`} key={message.id}>
                  <div className="speaker">{message.role === "user" ? "Вы" : "Ассистент"}</div>
                  <div className="message-body">
                    {message.text && <p>{message.text}</p>}
                    {isLatestAnswer && message.status === "streaming" && (
                      <p className="message-status" role="status" aria-live="polite">
                        <span className="status-dot" aria-hidden="true" />
                        {message.text ? "Ассистент отвечает" : "Ассистент готовит ответ"}
                      </p>
                    )}
                    {isLatestAnswer && message.status === "stopped" && (
                      <p className="message-status stopped-status" role="status" aria-live="polite">
                        {message.statusMessage}
                      </p>
                    )}
                    {isLatestAnswer && message.status === "error" && (
                      <p className="message-status error-status" role="alert">
                        {message.statusMessage}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="composer-wrap">
          <form className="composer" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="question">
              {hasMessages ? "Следующий вопрос" : "Ваше сообщение"}
            </label>
            <textarea
              aria-describedby="composer-hint"
              id="question"
              maxLength={MAX_MESSAGE_CHARACTERS}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={hasMessages ? "Можно написать следующий вопрос…" : "Напишите вопрос…"}
              ref={textareaRef}
              value={draft}
            />

            <div className="actions">
              <span className="hint" id="composer-hint">
                {showStopButton ? "Отправка после ответа" : "Enter — отправить · Shift+Enter — новая строка"}
              </span>
              <div className="buttons">
                {showStopButton && (
                  <button
                    aria-label="Остановить ответ, клавиша Esc"
                    className="button stop"
                    onClick={handleStopClick}
                    title="Остановить ответ (Esc)"
                    type="button"
                  >
                    Стоп
                  </button>
                )}
                <button
                  className="button send"
                  disabled={!draft.trim() || showStopButton}
                  type="submit"
                >
                  Отправить
                </button>
              </div>
            </div>
          </form>
          <p className="footnote">Не вводите личные данные. История исчезнет после обновления страницы.</p>
        </div>
      </main>
    </div>
  );
}
