# Ход работы

Обновлять после каждого агентского этапа в его назначенной ветке. Агент ставит «на проверке» и добавляет доказательства; «принято» ставит координатор после проверки PR по критериям [EXECUTION_PLAN.md](../EXECUTION_PLAN.md). Следующая ветка получает обновлённый `main` только после merge предыдущего PR. URL и статус merge фиксировать в таблице. Не стирать обнаруженные блокеры без записи решения.

Допустимые состояния: `не начато`, `в работе`, `на проверке`, `на доработке`, `принято`, `блокировано`.

| ID | Статус | Ответственный | Ветка | Коммит / артефакты | Проверки и доказательства | PR → `main` / merge | Блокер / решение |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D01 | принято | Дизайн-агент → координатор | `codex/d01-design` | `docs/ui/UI_SPEC.md`, `UX_REVIEW.md`, `BRIEF_CHECK.md`, `preview.html`, `desktop.png`, `mobile.png`, `empty-mobile.png`, `short-mobile.png` | Сверка с `TASK.md`; Chromium 1440×900, 390×844, 390×320, 390×400, 844×390 и 200×400: форма в viewport, нет горизонтального скролла; пустой экран проверен при 390×320; семантический список; Impeccable detect: 0 находок | [PR #1](https://github.com/stupidkubik/ai-chat-test/pull/1) слит в `main` (`32a64b4`) | Дизайн и прототип завершены; функции и безопасность проверяются на следующих этапах |
| S02 | принято | Агент каркаса → координатор | `codex/s02-scaffold` | `2475bd4`; `package.json`, lockfile, `app/`, конфигурация TypeScript/ESLint, README-черновик | `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` — успешно; Chromium: `/` открывается, заглушка видна, ошибок консоли нет; `.env.local` игнорируется Git | [PR #2](https://github.com/stupidkubik/ai-chat-test/pull/2) слит в `main` (`e935682`) | Реальные сообщения и API относятся к U04–C06 |
| T03 | принято | Агент тестового окружения → координатор | `codex/t03-test-harness` | `0577c18`; `tests/mock-openrouter.mjs`, тесты, `docs/TESTING.md`, npm-команды | `npm test`: 4 проверки прошли без ключа; `npm run lint` и `npm run build` — успешно; CLI mock + `curl`: 200, три SSE-фрагмента и `[DONE]` | [PR #3](https://github.com/stupidkubik/ai-chat-test/pull/3) слит в `main` (`fc51b19`) | Локальная история `origin/main` подтверждает merge; GitHub API временно недоступен |
| U04 | принято | UI-агент → координатор | `codex/u04-ui` | `app/chat-experience.tsx`, `app/chat-types.ts`, `app/page.tsx`, `app/globals.css`, `next.config.ts`; `docs/ui/u04-desktop.png`, `docs/ui/u04-mobile.png`, `design-qa.md` | `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check` — успешно; браузер: 1440×900, 390×844 и 390×320; состояния, focusable-история с клавиатурной прокруткой, Tab-порядок и production gating проверены; `/` статически пререндерен; визуальная сверка D01 прошла | [PR #4](https://github.com/stupidkubik/ai-chat-test/pull/4) слит в `main` (`2005eef`) | U04 принят; API и поток относятся к A05/C06 |
| A05 | на проверке | API-агент → координатор | `codex/a05-api` | `ce38889`, `3d564fa`; `app/api/chat/route.ts`, `handler.mjs`, `vercel.json`, `tests/chat-api.test.mjs`, `.env.example`, `docs/TESTING.md` | `npm run test` — 16 проверок успешно; `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check` — успешно; локальный `/api/chat` вернул ожидаемый 400; live OpenRouter: 200, потоковый текст и `[DONE]`; 12 клиентских файлов проверены, ключ не найден. GitHub checks не настроены | [PR #5](https://github.com/stupidkubik/ai-chat-test/pull/5), открыт и ожидает ревью | Отмену на Vercel повторить после деплоя |
| C06 | не начато | Агент клиентского потока → координатор | `codex/c06-streaming` | — | — | — | — |
| Q07 | не начато | QA-агент → координатор | `codex/q07-qa` | — | — | — | — |
| R08 | не начато | Агент документации → координатор | `codex/r08-docs` | — | — | — | — |
| P09 | не начато | Координатор | `codex/p09-release` | — | — | — | — |

## Нерешённые внешние зависимости

| Зависимость | Нужна к | Текущее состояние |
| --- | --- | --- |
| OpenRouter API key | Живой тест перед P09; при деплое — настройка хостинга | Один минимальный запрос через `/api/chat` уже прошёл; значение ключа не выводилось и не добавлялось в Git. При деплое настроить ключ как server-side переменную. |
| Доступный бесплатный model ID | A05 и P09 | Выбран официальный router `openrouter/free`; 25.09.2026 live streaming завершился `[DONE]`. Проверить повторно после деплоя, так как конкретная модель-исполнитель меняется. |
| Vercel и допустимость тарифа | Необязательный деплой в P09 | Решение выбрано в `DESIGN.md`; условия проверить для аккаунта, если публикуем сайт. |

GitHub-доступ восстановлен 25.09.2026. Публичный [stupidkubik/ai-chat-test](https://github.com/stupidkubik/ai-chat-test) подключён как `origin`; `main` является веткой по умолчанию. D01–U04 приняты и слиты; A05 основан на merge-коммите U04 (`2005eef`).

## Журнал контрольных точек

Добавлять запись только после фактической проверки:

```text
Дата — ID — принято / на доработку / блокировано
Проверено: ...
Ссылки: <коммит, PR, скриншот, QA>
Решение и следующий шаг: ...
```

2026-09-25 — A05 — на проверке
Проверено: 16 тестов, lint, typecheck, production build, локальный маршрут, live SSE через `openrouter/free`, отсутствие ключа в клиентской сборке.
Ссылки: `ce38889`, `3d564fa`, [PR #5](https://github.com/stupidkubik/ai-chat-test/pull/5).
Решение и следующий шаг: передать PR на ревью; после деплоя отдельно проверить отмену Vercel.
