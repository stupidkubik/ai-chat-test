import assert from "node:assert/strict";
import test from "node:test";
import { buildRequestMessages } from "../app/chat-context.mjs";

test("removes every unanswered user turn from context", () => {
  const history = [
    { role: "user", text: "первый вопрос без ответа" },
    { role: "assistant", text: "", status: "error" },
    { role: "user", text: "второй вопрос без ответа" },
    { role: "assistant", text: "  ", status: "stopped" },
    { role: "user", text: "вопрос с ответом" },
    { role: "assistant", text: "ответ" },
  ];

  assert.deepEqual(buildRequestMessages(history, "новый вопрос"), [
    { role: "user", content: "вопрос с ответом" },
    { role: "assistant", content: "ответ" },
    { role: "user", content: "новый вопрос" },
  ]);
});

test("keeps partial stopped or failed answers as context", () => {
  const history = [
    { role: "user", text: "вопрос" },
    { role: "assistant", text: "частичный ответ", status: "stopped" },
  ];

  assert.deepEqual(buildRequestMessages(history, "продолжи"), [
    { role: "user", content: "вопрос" },
    { role: "assistant", content: "частичный ответ" },
    { role: "user", content: "продолжи" },
  ]);
});
