# Ход работы

Обновлять после каждого агентского этапа в его назначенной ветке. Агент ставит «на проверке» и добавляет доказательства; «принято» ставит координатор после проверки PR по критериям [EXECUTION_PLAN.md](../EXECUTION_PLAN.md). Следующая ветка получает обновлённый `main` только после merge предыдущего PR. URL и статус merge фиксировать в таблице. Не стирать обнаруженные блокеры без записи решения.

Допустимые состояния: `не начато`, `в работе`, `на проверке`, `на доработке`, `принято`, `блокировано`.

| ID | Статус | Ответственный | Ветка | Коммит / артефакты | Проверки и доказательства | PR → `main` / merge | Блокер / решение |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D01 | принято | Дизайн-агент → координатор | `codex/d01-design` | `docs/ui/UI_SPEC.md`, `UX_REVIEW.md`, `BRIEF_CHECK.md`, `preview.html`, `desktop.png`, `mobile.png`, `empty-mobile.png`, `short-mobile.png` | Сверка с `TASK.md`; Chromium 1440×900, 390×844, 390×320, 390×400, 844×390 и 200×400: форма в viewport, нет горизонтального скролла; пустой экран проверен при 390×320; семантический список; Impeccable detect: 0 находок | [PR #1](https://github.com/stupidkubik/ai-chat-test/pull/1) слит в `main` (`32a64b4`) | Дизайн и прототип завершены; функции и безопасность проверяются на следующих этапах |
| S02 | принято | Агент каркаса → координатор | `codex/s02-scaffold` | `2475bd4`; `package.json`, lockfile, `app/`, конфигурация TypeScript/ESLint, README-черновик | `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` — успешно; Chromium: `/` открывается, заглушка видна, ошибок консоли нет; `.env.local` игнорируется Git | [PR #2](https://github.com/stupidkubik/ai-chat-test/pull/2) слит в `main` (`e935682`) | Реальные сообщения и API относятся к U04–C06 |
| T03 | принято | Агент тестового окружения → координатор | `codex/t03-test-harness` | `0577c18`; `tests/mock-openrouter.mjs`, тесты, `docs/TESTING.md`, npm-команды | `npm test`: 4 проверки прошли без ключа; `npm run lint` и `npm run build` — успешно; CLI mock + `curl`: 200, три SSE-фрагмента и `[DONE]` | [PR #3](https://github.com/stupidkubik/ai-chat-test/pull/3) слит в `main` (`fc51b19`) | Локальная история `origin/main` подтверждает merge; GitHub API временно недоступен |
| U04 | принято | UI-агент → координатор | `codex/u04-ui` | `app/chat-experience.tsx`, `app/chat-types.ts`, `app/page.tsx`, `app/globals.css`, `next.config.ts`; `docs/ui/u04-desktop.png`, `docs/ui/u04-mobile.png`, `design-qa.md` | `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check` — успешно; браузер: 1440×900, 390×844 и 390×320; состояния, focusable-история с клавиатурной прокруткой, Tab-порядок и production gating проверены; `/` статически пререндерен; визуальная сверка D01 прошла | [PR #4](https://github.com/stupidkubik/ai-chat-test/pull/4) слит в `main` (`2005eef`) | U04 принят; API и поток относятся к A05/C06 |
| A05 | принято | API-агент → координатор | `codex/a05-api` | `ce38889`, `3d564fa`, P2-фикс `667bbef`; `app/api/chat/route.ts`, `handler.mjs`, `vercel.json`, `tests/chat-api.test.mjs`, `.env.example`, `docs/TESTING.md` | `npm run test` — 17 проверок успешно; `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check` — успешно; локальный `/api/chat` вернул ожидаемый 400; live OpenRouter: 200, потоковый текст и `[DONE]`; 12 клиентских файлов проверены, ключ не найден. GitHub checks не настроены | [PR #5](https://github.com/stupidkubik/ai-chat-test/pull/5) слит в `main` (`5460678`) | Отмену на Vercel повторить после деплоя |
| C06 | принято; замечания ревью исправлены в follow-up | Клиентский поток → координатор | `codex/c06-streaming`, `codex/c06-review-fixes` | `9835d8c`, `d43360d`, `9732956`; клиентский SSE-парсер, контекст запросов, статусы остановки/ошибок и тесты | `npm run test` — 24/24; `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check` — успешно. Chromium/mock подтвердил сохранение меток у двух последовательных частичных ошибок; тест подтвердил отмену при ошибке парсера | [PR #6](https://github.com/stupidkubik/ai-chat-test/pull/6) слит в `main` (`bcb9823`); [PR #7](https://github.com/stupidkubik/ai-chat-test/pull/7) слит в `main` (`6a2e33e`); CI-проверки для ветки не настроены | Только локальный mock; отмену на Vercel проверить в Q07 |
| Q07 | принято | Координатор | `codex/q07-qa` | `8f3d91c`; `docs/DEPLOYMENT.md`, `docs/QA.md`, `output/playwright/`; Preview и Production `READY` для `2126d63` | В авторизованном Chrome Production: SSE, история, Stop после чанка, Esc до чанка, новый запрос, клавиатура и мобильная ширина прошли. Локальный mock: 429, обрывы и таймаут; тесты 24/24, lint/typecheck/build успешно. Подробная матрица в `docs/QA.md` | [PR #8](https://github.com/stupidkubik/ai-chat-test/pull/8) слит в `main` (`3ebb877`) | Переданный URL — Preview без ключа: `/api/chat` возвращает 500. Production работает, но оба deployment защищены Vercel Login. Для публичной демонстрации нужен отдельный выбор области доступа; для работающего Preview — отдельный секрет и новый deployment. |
| R08 | принято | Агент документации → координатор | `codex/r08-docs` | `1e72cf7`; `README.md`, `LICENSE`, сверка DESIGN, DEPLOYMENT, PROGRESS и WORKLOG | `npm ci`; `npm test` — 24/24; lint, typecheck, build, `git diff --check` — успешно. Код и зависимости не менялись; секреты в документах не найдены | [PR #9](https://github.com/stupidkubik/ai-chat-test/pull/9) слит в `main` (`39f9899`) | Основной сайт повторно проверен без входа на P09; отдельный Preview остаётся без ключа. |
| P09 | на проверке | Координатор | `codex/p09-release` | Заключительная сверка и обновление `README.md`, `docs/QA.md`, `docs/DEPLOYMENT.md`, `docs/PROGRESS.md`, `WORKLOG.md` | Локальный живой SSE: 200, 152 события и `[DONE]`; публичный Chromium: ответ, Esc после чанка, мобильная ширина, консоль и отсутствие ключа в браузерном запросе. `npm test` — 24/24, lint/typecheck/build/`git diff --check` прошли; подробности в `docs/QA.md` | PR готовится | Повторный запрос после большого частичного ответа не завершился за 30 с; Q07 ранее подтвердил следующий запрос. Стабильность публичного адреса и условия аккаунта проверить перед отправкой работодателю. |

## Нерешённые внешние зависимости

| Зависимость | Нужна к | Текущее состояние |
| --- | --- | --- |
| OpenRouter API key для Preview | Если нужен отдельный Preview | `vercel env ls` показал только Production. Переданный Preview URL отвечает `configuration_error`; значение секрета не считывалось. |
| Доступный бесплатный model ID | A05 и P09 | Выбран официальный router `openrouter/free`; 25.09.2026 live streaming завершился `[DONE]`. Проверить повторно после деплоя, так как конкретная модель-исполнитель меняется. |
| Vercel project и допустимость тарифа | P09 | `ai-chat-test` создан в команде Hobby; GitHub-интеграция создала Preview для PR #8. Основной Production-адрес открылся без входа в P09; перед передачей работодателю повторить проверку доступа и условий аккаунта. |

GitHub-доступ восстановлен 25.09.2026. Публичный [stupidkubik/ai-chat-test](https://github.com/stupidkubik/ai-chat-test) подключён как `origin`; `main` является веткой по умолчанию. D01–R08 приняты и слиты, включая дополнительный PR #7. Первый Preview создан вручную, позднее GitHub-интеграция создала Preview для PR #8.

## Журнал контрольных точек

Добавлять запись только после фактической проверки:

```text
Дата — ID — принято / на доработку / блокировано
Проверено: ...
Ссылки: <коммит, PR, скриншот, QA>
Решение и следующий шаг: ...
```

2026-09-25 — A05 — на проверке, доработано по P2-комментарию ревью
Проверено: 17 тестов, lint, typecheck, production build и `git diff --check`; локальный маршрут, live SSE через `openrouter/free`, отсутствие ключа в клиентской сборке. Добавлен регрессионный тест для upstream HTTP 408 и 504.
Ссылки: `ce38889`, `3d564fa`, [PR #5](https://github.com/stupidkubik/ai-chat-test/pull/5).
Решение и следующий шаг: upstream HTTP 408/504 нормализуются в HTTP 504 с кодом `timeout`; после деплоя отдельно проверить отмену Vercel.

2026-09-25 — A05 — принято; PR #5 слит в `main` (`5460678`)
Проверено: merge отражён в `origin/main`; C06 обновлён fast-forward от этого коммита.
Ссылки: [PR #5](https://github.com/stupidkubik/ai-chat-test/pull/5), `5460678`.
Решение и следующий шаг: продолжить по плану C06.

2026-09-25 — C06 — принято и слито в `main` (`bcb9823`)
Проверено: 21 тест, lint, typecheck, production build, `git diff --check`; браузерный поток через local mock: Stop после первого чанка сохраняет его и игнорирует поздние чанки, следующий запрос работает, Esc до первого чанка останавливает ожидание. Живой OpenRouter не использовался.
Ссылки: `9835d8c`, [PR #6](https://github.com/stupidkubik/ai-chat-test/pull/6), `app/chat-stream.mjs`, `tests/chat-stream.test.mjs`.
Решение и следующий шаг: слить PR #6 merge commit и начать Q07 после обновления его ветки от `origin/main`.

2026-09-25 — C06 — обработаны три inline-комментария Codex Review; follow-up PR #7 открыт
Проверено: `npm run test` — 24/24; lint, typecheck, production build, `git diff --check`; Chromium с локальным mock сохранил метки ошибок у двух последовательных частичных ответов; unit-тест проверил отмену открытого потока при ошибке парсера.
Ссылки: `d43360d`, `9732956`, [PR #6](https://github.com/stupidkubik/ai-chat-test/pull/6), [PR #7](https://github.com/stupidkubik/ai-chat-test/pull/7).
Решение и следующий шаг: все замечания бота подтверждены и исправлены; PR #7 оставить открытым для ревью. CI-проверки не настроены.

2026-09-25 — C06 — follow-up PR #7 слит в `main` (`6a2e33e`)
Проверено: merge commit PR #7 зафиксирован в `origin/main`; C06 review fixes стали частью основной ветки.
Ссылки: [PR #7](https://github.com/stupidkubik/ai-chat-test/pull/7), `6a2e33e`.
Решение и следующий шаг: перед Q07 обновить его ветку от `origin/main`; проверить отмену на Vercel Preview.

2026-09-26 — Q07 — подготовка Vercel Preview
Проверено: `codex/q07-qa` перебазирована на `origin/main` (`6a2e33e`); Vercel-конфигурация уже включает поддержку отмены; локальной `.vercel/`-связи нет.
Артефакт: `docs/DEPLOYMENT.md`.
Решение и следующий шаг: подключить репозиторий в Vercel и настроить владельцем секрет `OPENROUTER_API_KEY` для Preview; затем выполнить Preview QA. Production не запускался.

2026-09-26 — Q07 — Vercel Preview
Проверено: создан проект `ai-chat-test` в команде Hobby, установлен framework preset Next.js и привязан локальный checkout. Deployment `CreptkauiU8SY3S6bptSZuKZGuoU` для `codex/q07-qa` / `2126d63` имеет статус `READY`; CLI вывел Preview URL https://ai-chat-test-c5hgvgcn0-evgeniis-projects-0daccd9a.vercel.app. Успешная сборка прошла на Vercel. Главная страница открылась в браузере с авторизацией Vercel. GitHub-интеграция не подключена, `OPENROUTER_API_KEY` не передавался.
Ограничения: неавторизованный Playwright перенаправлен на Vercel Login, поэтому ошибки console самого приложения не собраны. Первый CLI-запуск с `--target=preview` создал deployment с `target=production` и `state=ERROR` при preset `Other`; успешного Production deployment нет. Повторный запуск без `--target` создал Preview со статусом `READY`.
Решение и следующий шаг: владелец добавляет `OPENROUTER_API_KEY` только в Preview environment; затем повторный Preview-деплой и проверка живого SSE/Stop/console. GitHub-интеграцию подключать отдельно после согласования безопасного поведения production branch.

2026-09-26 — Q07 — владелец проверил чат
Проверено: владелец сообщил, что добавил `OPENROUTER_API_KEY` в переменные Vercel и чат работает. По Vercel API текущий deployment `7TZsHwZNuAsN6ZuoWLF16SHKkfXH` имеет `target=production`, статус `READY`, commit `2126d63` и production aliases. Область переменной отдельно не подтверждена; значение секрета не считывалось. Независимая проверка console, SSE и Stop не выполнялась.
Ссылки: [текущий deployment](https://vercel.com/evgeniis-projects-0daccd9a/ai-chat-test/7TZsHwZNuAsN6ZuoWLF16SHKkfXH), https://ai-chat-test-qtkzgxfbh-evgeniis-projects-0daccd9a.vercel.app.
Решение и следующий шаг: Q07 остаётся в работе до отдельной проверки Preview, включая console и отмену; Production deployment не изменять.

2026-09-26 — Q07 — на проверке после браузерной QA
Проверено: переданная ссылка через `vercel inspect` определена как Preview; `vercel env ls` показал секрет только в Production, а Preview `/api/chat` вернул 500 `configuration_error`. На фактическом Production независимо проверены поток, история, Stop и Esc, следующий запрос, длинный ответ, 390 px и чистая консоль при загрузке. Локальный mock подтвердил 429, сетевой обрыв, разрыв после первого чанка и таймаут; `npm test` — 24/24, lint/typecheck/build успешны.
Ссылки: [матрица Q07](QA.md), [PR #8](https://github.com/stupidkubik/ai-chat-test/pull/8), [Production](https://ai-chat-test-qtkzgxfbh-evgeniis-projects-0daccd9a.vercel.app/), [Preview](https://ai-chat-test-c5hgvgcn0-evgeniis-projects-0daccd9a.vercel.app/).
Решение и следующий шаг: живой QA по решению владельца проведён на Production. Оба адреса требуют Vercel Login без авторизованной сессии; изменение защиты или области секрета в этом проходе не выполнялось. Перед внешней сдачей решить вопрос публичного доступа, а Preview настраивать отдельно только если он нужен.

2026-09-26 — Q07 — принято
Проверено: [PR #8](https://github.com/stupidkubik/ai-chat-test/pull/8) слит merge-коммитом `3ebb877`; `codex/r08-docs` обновлена от `origin/main`. Vercel check у PR #8 сообщил Ready для автоматического Preview; живые сценарии на нём не проверялись.
Решение и следующий шаг: матрица Q07 принята с открытым вопросом публичного доступа; R08 ведёт документацию, P09 проведёт заключительную проверку.

2026-09-26 — R08 — на проверке
Проверено: `npm ci` восстановил зависимости из lockfile; `npm test` — 24/24, lint, typecheck, production build и `git diff --check` прошли. Проверены состав diff и package.json: только документы и MIT-лицензия, новых зависимостей нет. `.env.local` не отслеживается Git; поиск токенов в изменённых документах не выявил секрета.
Ссылки: [README](../README.md), [MIT](../LICENSE), [матрица Q07](QA.md).
Решение и следующий шаг: README объясняет запуск, архитектуру, решение по фокусу, ограничения и конкретные ошибки ИИ. Исторический DESIGN отделён от фактического состояния, Vercel-документ уточнён после подключения GitHub. Открыть PR R08 и провести ревью.

2026-09-26 — R08 — принято
Проверено: [PR #9](https://github.com/stupidkubik/ai-chat-test/pull/9) содержал шесть ожидаемых файлов, локальные проверки и Vercel checks прошли; PR слит merge-коммитом `39f9899`. Ветка P09 обновлена от `origin/main`.
Решение и следующий шаг: провести заключительный живой сценарий и проверить публичный адрес перед PR P09.

2026-09-26 — P09 — на проверке
Проверено: публичный GitHub-репозиторий; локальный живой поток через `/api/chat`, отмена после чанка; публичный основной адрес в изолированном Chromium, мобильная ширина 390 px, Esc после чанка, сохранение фрагмента, 0 ошибок консоли, запрос из браузера без ключа. `npm test` — 24/24; lint, typecheck, production build, `git diff --check` — успешно.
Ссылки: [публичный чат](https://ai-chat-test-lake.vercel.app/), [матрица и ограничения](QA.md).
Решение и следующий шаг: открыть PR P09. Отдельный Preview остаётся без ключа; успех следующего запроса после большого частичного ответа в P09 повторно не получен. Отправку ссылки работодателю выполняет владелец проекта.
