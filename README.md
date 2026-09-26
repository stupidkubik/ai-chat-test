# Диалог

Одностраничный чат с OpenRouter на Next.js, React и TypeScript. Ответ модели приходит потоком через серверный `/api/chat`; ключ хранится только на сервере. Интерфейс поддерживает остановку генерации, частичные ответы и понятные состояния ошибок. История хранится в памяти вкладки.

## Локальный запуск

Нужен Node.js 20.9 или новее; проверено с версией из `.nvmrc` (24.18.0).

```bash
nvm use
npm ci
npm run dev
```

Откройте <http://localhost:3000>. Для живого чата создайте `.env.local` по образцу `.env.example` и укажите собственный `OPENROUTER_API_KEY`. Сервер отправляет потоковый запрос на OpenRouter через `/api/chat`, используя бесплатный router `openrouter/free`; ключ остаётся на сервере. Не добавляйте `.env.local` в Git.

Для работы без ключа можно запустить локальный mock из `docs/TESTING.md` и включить `OPENROUTER_MOCK=1` в серверном окружении разработки. Mock-переменные действуют только вне production; браузер не выбирает mock endpoint или сценарий.

Проверки: `npm run lint`, `npm run typecheck`, `npm run build`.

Подготовка Vercel Preview и сценарий проверки потока/остановки описаны в [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Production-публикация остаётся отдельным шагом после Preview QA.

Бриф: [TASK.md](TASK.md). Архитектура: [DESIGN.md](DESIGN.md). Текущий ход работы: [docs/PROGRESS.md](docs/PROGRESS.md).
