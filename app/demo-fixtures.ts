import type { ChatMessage, DemoState } from "./chat-types";

// Imported only by the server page in development, so these texts never reach the production bundle.
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

export const demoMessages: Record<DemoState, ChatMessage[]> = {
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
