# Phase 1 implementation sources

The project uses the installed versions in `code/package.json`; these official references record the framework-specific decisions made in Phase 1.

- [Vitest v3 configuration](https://v3.vitest.dev/config/#include): `vitest.config.ts` uses the documented `test.include` glob to collect only unit tests and avoid collecting Playwright specs.
- [Playwright Test configuration](https://playwright.dev/docs/test-configuration): `testDir`, `webServer`, `baseURL`, and the bounded per-test timeout are configured through Playwright's top-level configuration options.
- [Vite server options](https://vite.dev/config/server-options#server-proxy): Vite owns the local frontend server and `/api` proxy configuration.
- [React `useState`](https://react.dev/reference/react/useState): the login demo keeps submission feedback as component-local state.
