# Vercel: состояние после Q07

Первоначальный план Q07 предусматривал Preview. 26.09.2026 владелец выбрал готовый Production-деплой для полного тестирования. Фактические результаты записаны в [QA.md](QA.md).

В P09 основной адрес [ai-chat-test-lake.vercel.app](https://ai-chat-test-lake.vercel.app/) открылся в изолированном Chromium без Vercel Login; живой запрос и остановка ответа с мобильной ширины прошли. Это новая проверка после исторических наблюдений Q07 ниже.

## Подтверждённое состояние на 26.09.2026

- Vercel project: `ai-chat-test` в команде `Evgenii's projects` (Hobby), Project ID `prj_pRYBfZnNt5BHouYGaw7WTSb7tjT9`.
- Framework preset установлен в `Next.js`, Root Directory — корень проекта, Node.js — `24.x`.
- Успешный Preview создан из `codex/q07-qa`, commit `2126d63`: [открыть приложение](https://ai-chat-test-c5hgvgcn0-evgeniis-projects-0daccd9a.vercel.app), [открыть deployment в Vercel](https://vercel.com/evgeniis-projects-0daccd9a/ai-chat-test/CreptkauiU8SY3S6bptSZuKZGuoU). Статус API — `READY`; CLI пометил адрес как Preview.
- Сборка на Vercel прошла: Next.js `16.3.6`, `npm run build`; маршрут `/api/chat` собран как динамический.
- Приложение открылось в авторизованной сессии Vercel. В браузере без входа Preview перенаправляет на Vercel Login.
- Первый Preview загружен CLI из локальной рабочей копии. Позднее GitHub-интеграция заработала: [PR #8](https://github.com/stupidkubik/ai-chat-test/pull/8) получил автоматический Vercel Preview со статусом Ready. Работу чата на этом новом Preview отдельно не проверяли; ключ для Preview в Q07 отсутствовал.
- `vercel env ls` показывает `OPENROUTER_API_KEY` только для Production; значение секрета не считывалось. Preview `/api/chat` подтверждённо возвращает HTTP 500 `configuration_error`.
- Проверенный Production deployment `7TZsHwZNuAsN6ZuoWLF16SHKkfXH` имел статус `READY`, `target=production`, commit `2126d63` и URL `https://ai-chat-test-qtkzgxfbh-evgeniis-projects-0daccd9a.vercel.app`. Vercel назначил ему production aliases `ai-chat-test-lake.vercel.app` и `ai-chat-test-evgeniis-projects-0daccd9a.vercel.app`. Живой поток, Stop, Esc, история, длинный ответ и мобильная компоновка проверены независимо. Изолированный браузер перенаправлялся на Vercel Login также для Production.

## Оставшиеся действия по желанию

1. Если нужен работающий Preview, задать `OPENROUTER_API_KEY` для Preview отдельно и создать новый Preview deployment. Не сохранять значение секрета в Git, команды или документы. Текущий Preview URL после изменения переменной сам по себе не обновится.
2. Создать Preview-деплой после настройки Preview-переменной. Для ручной загрузки из локальной привязанной копии использовать `npx vercel deploy --yes --scope evgeniis-projects-0daccd9a` без `--prod`; Vercel CLI выдаёт Preview по умолчанию.
3. Перед передачей работодателю повторить открытие публичного адреса без Vercel Login и проверить применимость условий аккаунта. На P09 адрес был доступен из изолированного Chromium.
4. После нового Preview-деплоя открыть его в браузере, авторизованном в Vercel, и повторить короткий живой запрос, поток `/api/chat` и Stop.
5. В Function Logs проверить ошибки и время выполнения. Не сохранять в отчёт API-ключ, заголовок Authorization или текст пользовательских сообщений.
6. Результаты уже проведённого Production QA записаны в `docs/QA.md`. Управляемые 429, timeout и mid-stream disconnect проверены локально на mock; mock не включён в deployment.

Переменные Preview и Production независимы. При тестировании не менялись deployment, области секрета и защита доступа.

`app/api/chat/route.ts` задаёт `runtime = "nodejs"` и `maxDuration = 120`; `vercel.json` включает `supportsCancellation` для chat route. `.gitignore` исключает `.vercel/` и `.env.local`.
