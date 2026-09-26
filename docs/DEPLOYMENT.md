# Vercel Preview

Этот проект использует Next.js App Router и один серверный маршрут `/api/chat`. Для Q07 нужен Vercel Preview, чтобы проверить поток и отмену на целевом хостинге. Production-домен пока не нужен.

## Что уже настроено

- Корень репозитория — корень Next.js-проекта; Vercel должен обнаружить Next.js автоматически.
- `npm run build` запускает production-сборку.
- `vercel.json` включает `supportsCancellation` для `app/api/chat/route.ts`; маршрут задаёт `maxDuration: 120`.
- `.gitignore` исключает `.vercel/` и `.env.local`.
- В checkout пока нет связи с Vercel project; деплой не запускался.

## Первичная настройка в Vercel

1. Импортировать GitHub-репозиторий `stupidkubik/ai-chat-test` или выбрать уже созданный Vercel project для него. Оставить Root Directory равным корню репозитория и production branch равной `main`.
2. Использовать стандартные настройки Next.js. Если задавать команды явно: Install Command `npm ci`, Build Command `npm run build`.
3. Добавить `OPENROUTER_API_KEY` в **Preview Environment** как секретную переменную. Значение вводить напрямую в Vercel; не помещать его в Git, README, команды или этот документ.
4. Не задавать для Preview `OPENROUTER_MOCK`, `OPENROUTER_MOCK_URL` и `OPENROUTER_MOCK_SCENARIO`. Mock предназначен для локальной разработки и в production-режиме игнорируется.
5. После подключения проекта отправить проверенную ветку `codex/q07-qa` в GitHub или открыть её PR. Git-интеграция создаст Preview Deployment; после добавления или изменения env-переменной понадобится новый deployment.

Переменные Preview и Production настраиваются отдельно. Для Q07 не нужно добавлять ключ в Production. Если позже будет выбран публичный Production-деплой, сначала проверить условия аккаунта, затем отдельно задать `OPENROUTER_API_KEY` для Production.

## Проверка Preview в Q07

1. Открыть Preview URL в браузере на десктопе и мобильной ширине; проверить загрузку страницы и отсутствие ошибок в browser console.
2. Отправить короткое сообщение. В Network убедиться, что запрос идёт на `/api/chat`, ответ приходит потоком и в запросах/ответах браузера нет API-ключа.
3. Остановить генерацию после появления части ответа. Частичный текст должен сохраниться, поток — завершиться, а следующее сообщение — отправиться успешно. Повторить Stop до первого чанка.
4. Подтвердить отмену в Network и по поведению UI: запрос завершается после Stop, частичный ответ остаётся, следующее сообщение работает. В Vercel Function logs проверить ошибки и время выполнения; не ожидать отдельного события об отмене. Не сохранять в отчёт ключ, заголовок Authorization или текст пользовательских сообщений.
5. Управляемые 429, timeout и mid-stream disconnect проверять локально на mock. Не включать mock в Vercel Preview.
6. Записать commit, Preview URL, браузер/viewport и фактический результат в `docs/QA.md`; сохранять только скриншоты без личных данных и секретов.

Для настройки Git-интеграции см. [Vercel Git deployments](https://vercel.com/docs/deployments/git). Разница между Preview и Production и область действия переменных описаны в [Vercel Environments](https://vercel.com/docs/deployments/environments) и [Environment Variables](https://vercel.com/docs/environment-variables).
