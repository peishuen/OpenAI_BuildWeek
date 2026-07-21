# Repair Console Workspace

## Stack and commands

- React 19, Vite 6, Express 5, TypeScript strict mode, Vitest 3, and Playwright.
- Run commands from this directory: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run test:mutation`, and `npm run build`.

## Test conventions

- Unit tests live in `tests/unit/` and are collected only by Vitest.
- Browser tests live in `tests/e2e/` and are collected only by Playwright.
- Keep the `@repair-target` test's CSS locator intentionally stale during the prepared mutation; it is the controlled Phase 1 failure input.

## Boundaries

- Keep `QWEN_API_KEY` server-side and never commit `.env` files.
- Phase 1 may mutate only the documented login-button ID through `npm run mutation:apply` and `npm run mutation:reset`.
- Do not add repair-engine, dashboard, API, or dependency work until the remaining phases.
