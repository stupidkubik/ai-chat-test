"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_MESSAGE_CHARACTERS } from "./chat-context.mjs";
import { DEMO_STATES, type ChatMessage, type DemoState } from "./chat-types";
import { MessageMarkdown } from "./message-markdown";
import { useChat } from "./use-chat";

type ChatExperienceProps = {
  /** Development-only preview of fixed UI states; absent in production. */
  demo?: {
    initialState: DemoState;
    messages: Record<DemoState, ChatMessage[]>;
  };
};

const demoLabels: Record<DemoState, string> = {
  empty: "Пустой чат",
  message: "Сообщение",
  streaming: "Поток",
  stopped: "Остановлено",
  error: "Ошибка",
};

const examplePrompts = [
  "Объясни, чем useMemo отличается от useCallback",
  "Составь план подготовки к собеседованию по React",
  "Как отменить fetch-запрос в браузере?",
  "Придумай три имени для кофейни у метро",
];

export default function ChatExperience({ demo }: ChatExperienceProps) {
  const chat = useChat();
  const [demoState, setDemoState] = useState<DemoState | null>(demo?.initialState ?? null);
  const [draft, setDraft] = useState("");
  const shouldStickToBottomRef = useRef(true);
  const threadRef = useRef<HTMLOListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isGenerating, stop } = chat;
  const isStreamingPreview = demoState === "streaming";
  const showStopButton = isGenerating || isStreamingPreview;
  const displayedMessages = demo && demoState !== null ? demo.messages[demoState] : chat.messages;
  const latestMessage = displayedMessages[displayedMessages.length - 1];
  const hasMessages = displayedMessages.length > 0;

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;

    if (demoState !== null || shouldStickToBottomRef.current) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [demoState, chat.messages]);

  useEffect(() => {
    if (!isGenerating) return;

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      stop();
      textareaRef.current?.focus();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isGenerating, stop]);

  function leaveDemo() {
    setDemoState(null);
    shouldStickToBottomRef.current = true;
    textareaRef.current?.focus();
  }

  function selectDemoState(nextState: DemoState) {
    if (isGenerating) return;
    chat.reset();
    setDraft("");
    shouldStickToBottomRef.current = true;
    setDemoState(nextState);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || showStopButton) return;
    chat.send(message);
    setDraft("");
    leaveDemo();
  }

  function pickExamplePrompt(prompt: string) {
    setDraft(prompt);
    // Put the caret at the end so the prompt can be edited before sending.
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(prompt.length, prompt.length);
    });
  }

  function handleRetry(assistantId: string) {
    chat.retry(assistantId);
    leaveDemo();
  }

  function handleStopClick() {
    if (isGenerating) {
      stop();
    } else if (isStreamingPreview) {
      setDemoState("stopped");
    }
    textareaRef.current?.focus();
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

      {demo && (
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
            <p>
              Ответ появляется по мере генерации. Остановить его можно кнопкой «Стоп» или клавишей Esc.
              История живёт до обновления страницы.
            </p>
            <ul className="examples" aria-label="Примеры вопросов">
              {examplePrompts.map((prompt) => (
                <li key={prompt}>
                  <button className="example" onClick={() => pickExamplePrompt(prompt)} type="button">
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
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
                    {message.text && (
                      message.role === "assistant"
                        ? <MessageMarkdown text={message.text} />
                        : <p>{message.text}</p>
                    )}
                    {isLatestAnswer && message.status === "streaming" && (
                      <p className="message-status" role="status" aria-live="polite">
                        <span className="status-dot" aria-hidden="true" />
                        {message.text ? "Ассистент отвечает" : "Ассистент готовит ответ"}
                      </p>
                    )}
                    {message.status === "stopped" && (
                      <p className="message-status stopped-status" role="status" aria-live="polite">
                        {message.statusMessage ?? "Ответ остановлен"}
                      </p>
                    )}
                    {message.status === "error" && (
                      <div className="message-error">
                        <p className="message-status error-status" role="alert">
                          {message.statusMessage ?? "Ответ не завершён. Попробуйте ещё раз."}
                        </p>
                        {isLatestAnswer && (
                          <button
                            className="button retry"
                            disabled={showStopButton || demoState !== null}
                            onClick={() => handleRetry(message.id)}
                            type="button"
                          >
                            Повторить
                          </button>
                        )}
                      </div>
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
