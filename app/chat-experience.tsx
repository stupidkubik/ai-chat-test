"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export type DemoState = "empty" | "message" | "streaming" | "stopped" | "error";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ChatExperienceProps = {
  initialState: DemoState;
  showDemoControls: boolean;
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
  {
    id: "question-2",
    role: "user",
    text: "А что лучше повторить про useEffect?",
  },
  {
    id: "answer-2",
    role: "assistant",
    text: "Разберите, когда эффект действительно нужен, как работает массив зависимостей и зачем возвращать функцию очистки. Хороший пример — подписка на событие: при изменении зависимости старая подписка должна быть снята.",
  },
];

const shortConversation: ChatMessage[] = [conversation[2], conversation[3]];

const demoOptions: { state: DemoState; label: string }[] = [
  { state: "empty", label: "Пустой чат" },
  { state: "message", label: "Сообщение" },
  { state: "streaming", label: "Поток" },
  { state: "stopped", label: "Остановлено" },
  { state: "error", label: "Ошибка" },
];

function getMessages(state: DemoState, submittedMessage: string): ChatMessage[] {
  if (state === "empty") return [];

  if (state === "message") {
    return [
      {
        id: "user-message",
        role: "user",
        text: submittedMessage || "Как устроены Server Components в Next.js?",
      },
    ];
  }

  if (state === "streaming") return conversation;

  if (state === "stopped") {
    return [
      shortConversation[0],
      {
        ...shortConversation[1],
        text: "Разберите, когда эффект действительно нужен, как работает массив зависимостей и зачем возвращать функцию очистки.",
      },
    ];
  }

  return [
    shortConversation[0],
    {
      ...shortConversation[1],
      text: "Разберите, когда эффект действительно нужен, как работает массив зависимостей и зачем возвращать функцию очистки. Хороший пример — подписка на событие: при изменении зависимости старая подписка",
    },
  ];
}

export default function ChatExperience({
  initialState,
  showDemoControls,
}: ChatExperienceProps) {
  const [state, setState] = useState<DemoState>(initialState);
  const [draft, setDraft] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");
  const threadRef = useRef<HTMLOListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messages = getMessages(state, submittedMessage);
  const hasMessages = messages.length > 0;
  const isGenerating = state === "streaming";
  const hasError = state === "error";

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [state]);

  function selectDemoState(nextState: DemoState) {
    setState(nextState);
    setDraft("");
    setSubmittedMessage("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();

    if (!message || isGenerating) return;

    setSubmittedMessage(message);
    setState("message");
    setDraft("");
    textareaRef.current?.focus();
  }

  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand" aria-label="Диалог">
          <span className="brandmark" aria-hidden="true">д</span>
          <span>диалог</span>
        </div>
      </header>

      {showDemoControls && (
        <aside className="demo-tools" aria-label="Локальные примеры состояний">
          <span className="demo-tools-label">Примеры состояний</span>
          <div className="demo-options" role="group" aria-label="Выберите состояние чата">
            {demoOptions.map((option) => (
              <button
                aria-pressed={state === option.state}
                className="demo-option"
                key={option.state}
                onClick={() => selectDemoState(option.state)}
                type="button"
              >
                {option.label}
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
            ref={threadRef}
            tabIndex={-1}
          >
            {messages.map((message, index) => {
              const isCurrentAnswer = message.role === "assistant" && index === messages.length - 1;

              return (
                <li className={`message ${message.role}`} key={message.id}>
                  <div className="speaker">{message.role === "user" ? "Вы" : "Ассистент"}</div>
                  <div className="message-body">
                    <p>{message.text}</p>
                    {isCurrentAnswer && isGenerating && (
                      <p className="message-status" role="status" aria-live="polite">
                        <span className="status-dot" aria-hidden="true" />
                        Ассистент отвечает
                      </p>
                    )}
                    {isCurrentAnswer && state === "stopped" && (
                      <p className="message-status stopped-status" role="status" aria-live="polite">
                        Ответ остановлен
                      </p>
                    )}
                    {isCurrentAnswer && hasError && (
                      <p className="message-status error-status" role="alert">
                        Соединение прервалось. Проверьте сеть и отправьте сообщение ещё раз.
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
              onChange={(event) => setDraft(event.target.value)}
              placeholder={hasMessages ? "Можно написать следующий вопрос…" : "Напишите вопрос…"}
              ref={textareaRef}
              value={draft}
            />

            <div className="actions">
              <span className="hint" id="composer-hint">
                {isGenerating ? "Отправка после ответа" : "Enter — отправить · Shift+Enter — новая строка"}
              </span>
              <div className="buttons">
                {isGenerating && (
                  <button
                    aria-label="Остановить ответ, клавиша Esc"
                    className="button stop"
                    onClick={() => {
                      setState("stopped");
                      textareaRef.current?.focus();
                    }}
                    title="Остановить ответ (Esc)"
                    type="button"
                  >
                    Стоп
                  </button>
                )}
                <button
                  className="button send"
                  disabled={!draft.trim() || isGenerating}
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
