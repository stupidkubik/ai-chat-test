# Vercel Preview and current deployment

Для Q07 используется отдельный Vercel Preview. Production-деплой не является частью этого этапа.

## Текущее состояние

- Vercel project: `ai-chat-test` в команде `Evgenii's projects` (Hobby), Project ID `prj_pRYBfZnNt5BHouYGaw7WTSb7tjT9`.
- Framework preset установлен в `Next.js`, Root Directory — корень проекта, Node.js — `24.x`.
- Успешный Preview создан из `codex/q07-qa`, commit `2126d63`: [открыть приложение](https://ai-chat-test-c5hgvgcn0-evgeniis-projects-0daccd9a.vercel.app), [открыть deployment в Vercel](https://vercel.com/evgeniis-projects-0daccd9a/ai-chat-test/CreptkauiU8SY3S6bptSZuKZGuoU). Статус API — `READY`; CLI пометил адрес как Preview.
- Сборка на Vercel прошла: Next.js `16.3.6`, `npm run build`; маршрут `/api/chat` собран как динамический.
- Приложение открылось в авторизованной сессии Vercel. В браузере без входа Preview перенаправляет на Vercel Login.
- Git-интеграция с GitHub пока не подключена: текущий Preview загружен CLI из локальной рабочей копии. Новые push в GitHub пока не создают автоматические Preview.
- Владелец проекта сообщил, что добавил `OPENROUTER_API_KEY` в переменные Vercel и проверил чат: он работает. Область переменной (Preview или Production) независимо не подтверждена; значение секрета не считывалось.
- Текущий deployment `7TZsHwZNuAsN6ZuoWLF16SHKkfXH` имеет статус `READY`, `target=production`, commit `2126d63` и URL `https://ai-chat-test-qtkzgxfbh-evgeniis-projects-0daccd9a.vercel.app`. Vercel назначил ему production aliases `ai-chat-test-lake.vercel.app` и `ai-chat-test-evgeniis-projects-0daccd9a.vercel.app`. Это Production deployment, не Preview; чат на нём проверен владельцем. Независимая проверка console, SSE и Stop ещё не выполнена.

## Следующие шаги для Q07

1. Проверить в Vercel, к каким окружениям привязан `OPENROUTER_API_KEY`; если Q07 должен оставаться изолированным, задать его для Preview отдельно. Не сохранять значение секрета в Git, команды или документы.
2. Создать Preview-деплой после настройки Preview-переменной. Для ручной загрузки из локальной привязанной копии использовать `npx vercel deploy --yes --scope evgeniis-projects-0daccd9a` без `--prod`; Vercel CLI выдаёт Preview по умолчанию.
3. При необходимости настроить Git-интеграцию так, чтобы push в `codex/q07-qa` создавал Preview. Перед подключением проверить настройки Production branch: импорт репозитория с `main` может создать Production-деплой.
4. Открыть Preview в браузере, авторизованном в Vercel, и проверить ошибки в console. Затем отправить короткий запрос и подтвердить поток `/api/chat`, отсутствие ключа в клиентских запросах и отмену после Stop.
5. В Function Logs проверить ошибки и время выполнения. Не сохранять в отчёт API-ключ, заголовок Authorization или текст пользовательских сообщений.
6. Записать commit, URL, браузер/viewport и результаты в `docs/QA.md`. Управляемые 429, timeout и mid-stream disconnect проверять локально на mock; не включать mock в Preview.

Переменные Preview и Production независимы. Q07 предназначен для проверки Preview; текущий Production deployment оставлен без изменений. Перед дальнейшим тестированием уточнить область переменной, чтобы Preview работал на своём окружении.

`app/api/chat/route.ts` задаёт `runtime = "nodejs"` и `maxDuration = 120`; `vercel.json` включает `supportsCancellation` для chat route. `.gitignore` исключает `.vercel/` и `.env.local`.
