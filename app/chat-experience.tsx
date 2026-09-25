"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEMO_STATES, type ChatMessage, type DemoState } from "./chat-types";

type ChatExperienceProps = {
  initialState: DemoState;
  showDemoControls: boolean;
};

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
  followUpAnswer,
];

const demoMessages: Record<DemoState, ChatMessage[]> = {
  empty: [],
  message: [],
  streaming: conversation,
  stopped: [
    followUpQuestion,
    {
      ...followUpAnswer,
      text: "Разберите, когда эффект действительно нужен, как работает массив зависимостей и зачем возвращать функцию очистки.",
    },
  ],
  error: [
    followUpQuestion,
    {
      ...followUpAnswer,
      text: "Разберите, когда эффект действительно нужен, как работает массив зависимостей и зачем возвращать функцию очистки. Хороший пример — подписка на событие: при изменении зависимости старая подписка",
    },
  ],
};

function getMessages(state: DemoState, submittedMessage: string): ChatMessage[] {
  if (state !== "message") return demoMessages[state];

  return [
    {
      id: "user-message",
      role: "user",
      text: submittedMessage || "Как устроены Server Components в Next.js?",
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
  const latestMessage = messages[messages.length - 1];
  const hasMessages = messages.length > 0;
  const isGenerating = state === "streaming";
  const hasError = state === "error";

  useEffect(() => {
    // Demo states replace the transcript, so show the latest message in each example.
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

    // U04 previews the text locally; C06 will own conversation history and API behavior.
    setSubmittedMessage(message);
    setState("message");
    setDraft("");
    textareaRef.current?.focus();
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
            {DEMO_STATES.map((demoState) => (
              <button
                aria-pressed={state === demoState}
                className="demo-option"
                key={demoState}
                onClick={() => selectDemoState(demoState)}
                type="button"
              >
                {demoLabels[demoState]}
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
            tabIndex={0}
          >
            {messages.map((message) => {
              const isCurrentAnswer = message === latestMessage && message.role === "assistant";

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
