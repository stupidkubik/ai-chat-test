# Диалог

Одностраничный чат с моделью OpenRouter. Сейчас в репозитории находится запускаемый каркас Next.js; интерфейс и обмен сообщениями добавляются следующими этапами.

## Локальный запуск

Нужен Node.js 20.9 или новее; проверено с версией из `.nvmrc` (24.18.0).

```bash
nvm use
npm ci
npm run dev
```

Откройте <http://localhost:3000>. Для проверки каркаса ключ API не нужен. Позже для живого чата потребуется создать `.env.local` по образцу `.env.example` и указать собственный `OPENROUTER_API_KEY`. Не добавляйте этот файл в Git.

Проверки: `npm run lint`, `npm run typecheck`, `npm run build`.

Бриф: [TASK.md](TASK.md). Архитектура: [DESIGN.md](DESIGN.md). Текущий ход работы: [docs/PROGRESS.md](docs/PROGRESS.md).
