"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatRequestError, streamChat } from "./chat-client.mjs";
import { buildRequestMessages } from "./chat-context.mjs";
import { messageForErrorCode } from "./chat-errors.mjs";
import type { ChatMessage } from "./chat-types";

function createMessageId(): string {
  return globalThis.crypto.randomUUID();
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);

  const updateMessage = useCallback((id: string, update: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => current.map((message) => (message.id === id ? update(message) : message)));
  }, []);

  const startRequest = useCallback(async (userText: string, history: ChatMessage[]) => {
    if (activeControllerRef.current) return;

    const userId = createMessageId();
    const assistantId = createMessageId();
    const controller = new AbortController();

    activeControllerRef.current = controller;
    setActiveAssistantId(assistantId);
    setMessages([
      ...history,
      { id: userId, role: "user", text: userText },
      { id: assistantId, role: "assistant", text: "", status: "streaming" },
    ]);

    try {
      await streamChat({
        messages: buildRequestMessages(history, userText),
        controller,
        onDelta: (delta) => {
          if (activeControllerRef.current !== controller) return;
          updateMessage(assistantId, (message) => ({ ...message, text: message.text + delta }));
        },
      });
      if (activeControllerRef.current !== controller) return;
      updateMessage(assistantId, ({ id, role, text }) => ({ id, role, text }));
    } catch (error) {
      // Stop already marked the answer; a late failure of that request must not overwrite it.
      if (activeControllerRef.current !== controller) return;
      const code = error instanceof ChatRequestError ? error.code : "network_error";
      updateMessage(assistantId, (message) => ({
        ...message,
        status: "error",
        statusMessage: messageForErrorCode(code),
      }));
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
        setActiveAssistantId(null);
      }
    }
  }, [updateMessage]);

  const send = useCallback((text: string) => {
    const userText = text.trim();
    if (!userText) return;
    void startRequest(userText, messages);
  }, [messages, startRequest]);

  /** Sends the failed question again with the same history that preceded it. */
  const retry = useCallback((assistantId: string) => {
    const index = messages.findIndex((message) => message.id === assistantId);
    const question = messages[index - 1];
    if (index < 1 || question.role !== "user") return;
    void startRequest(question.text, messages.slice(0, index - 1));
  }, [messages, startRequest]);

  const stop = useCallback(() => {
    const controller = activeControllerRef.current;
    const assistantId = activeAssistantId;
    if (!controller || !assistantId) return;

    // Clear the ref first so a read already queued by fetch cannot append after Stop.
    activeControllerRef.current = null;
    controller.abort();
    setActiveAssistantId(null);
    updateMessage(assistantId, (message) => ({
      ...message,
      status: "stopped",
      statusMessage: message.text ? "Ответ остановлен" : "Ответ остановлен до начала",
    }));
  }, [activeAssistantId, updateMessage]);

  const reset = useCallback(() => {
    if (activeControllerRef.current) return;
    setMessages([]);
  }, []);

  useEffect(() => () => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
  }, []);

  return {
    messages,
    isGenerating: activeAssistantId !== null,
    send,
    retry,
    stop,
    reset,
  };
}
