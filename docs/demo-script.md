# Phase 1 presenter script

Run all commands from `code/`.

1. Confirm the clean baseline:

   ```bash
   npm run lint
   npm run typecheck
   npm run test:unit
   npm run test:e2e
   ```

   Expected: one unit test and four E2E tests pass.

2. Apply the prepared UI selector mutation:

   ```bash
   npm run mutation:apply
   npm run test:e2e -- --grep @repair-target
   ```

   Expected: the tagged test fails because the page now renders `#sign-in-button-v2` while its intentional CSS locator remains `#sign-in-button`.

3. Prove the failure is isolated and restore the baseline:

   ```bash
   npm run mutation:reset
   npm run test:e2e
   ```

   Expected: the full four-test suite is green again.

4. Use the automated safety check during rehearsal:

   ```bash
   npm run test:mutation
   ```

   Expected: it applies the mutation, confirms exactly one `@repair-target` failure with Playwright JSON output, and restores `src/LoginPage.tsx` even if verification fails.
