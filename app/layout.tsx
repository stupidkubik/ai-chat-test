import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Диалог — чат с ИИ",
  description: "Простой чат с языковой моделью через OpenRouter",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
