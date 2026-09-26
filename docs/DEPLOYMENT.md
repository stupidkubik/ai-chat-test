# Vercel Preview

Для Q07 используется отдельный Vercel Preview. Production-деплой не является частью этого этапа.

## Текущее состояние

- Vercel project: `ai-chat-test` в команде `Evgenii's projects` (Hobby), Project ID `prj_pRYBfZnNt5BHouYGaw7WTSb7tjT9`.
- Framework preset установлен в `Next.js`, Root Directory — корень проекта, Node.js — `24.x`.
- Последний успешный Preview создан из `codex/q07-qa`, commit `2126d63`: [открыть приложение](https://ai-chat-test-c5hgvgcn0-evgeniis-projects-0daccd9a.vercel.app), [открыть deployment в Vercel](https://vercel.com/evgeniis-projects-0daccd9a/ai-chat-test/CreptkauiU8SY3S6bptSZuKZGuoU). Статус API — `READY`; CLI пометил адрес как Preview.
- Сборка на Vercel прошла: Next.js `16.3.6`, `npm run build`; маршрут `/api/chat` собран как динамический.
- Приложение открылось в авторизованной сессии Vercel. В браузере без входа Preview перенаправляет на Vercel Login.
- Git-интеграция с GitHub пока не подключена: текущий Preview загружен CLI из локальной рабочей копии. Новые push в GitHub пока не создают автоматические Preview.
- `OPENROUTER_API_KEY` в Vercel Preview не добавлен. Страница загружается, но живой запрос, SSE и отмена на Vercel ещё не проверены.

## Следующие шаги для Q07

1. В Vercel Project → Settings → Environment Variables добавить `OPENROUTER_API_KEY` только в Preview как Sensitive. Вводить значение непосредственно в Vercel; не сохранять его в Git, команды или этот документ.
2. После добавления ключа создать новый Preview-деплой. Для ручной загрузки из локальной привязанной копии использовать `npx vercel deploy --yes --scope evgeniis-projects-0daccd9a` без `--prod`; Vercel CLI выдаёт Preview по умолчанию.
3. При необходимости настроить Git-интеграцию так, чтобы push в `codex/q07-qa` создавал Preview. Перед подключением проверить настройки Production branch: импорт репозитория с `main` может создать Production-деплой.
4. Открыть Preview в браузере, авторизованном в Vercel, и проверить ошибки в console. Затем отправить короткий запрос и подтвердить поток `/api/chat`, отсутствие ключа в клиентских запросах и отмену после Stop.
5. В Function Logs проверить ошибки и время выполнения. Не сохранять в отчёт API-ключ, заголовок Authorization или текст пользовательских сообщений.
6. Записать commit, URL, браузер/viewport и результаты в `docs/QA.md`. Управляемые 429, timeout и mid-stream disconnect проверять локально на mock; не включать mock в Preview.

Переменные Preview и Production независимы. Для Q07 не добавлять ключ в Production. Production и домены обсуждать отдельно после завершения QA.

`app/api/chat/route.ts` задаёт `runtime = "nodejs"` и `maxDuration = 120`; `vercel.json` включает `supportsCancellation` для chat route. `.gitignore` исключает `.vercel/` и `.env.local`.
