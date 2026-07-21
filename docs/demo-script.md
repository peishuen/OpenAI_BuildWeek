# Presenter script

Run all commands from `code/`.

1. Confirm the clean baseline:

   ```bash
   npm run lint
   npm run typecheck
   npm run test:unit
   npm run test:e2e
   ```

   Expected: all unit and E2E tests pass.

2. Apply the prepared UI selector mutation:

   ```bash
   npm run mutation:apply
   npm run test:e2e -- --grep @repair-target
   ```

   Expected: the tagged test fails because the page now renders the alternate sign-in-button ID while its test locator remains stale.

3. Start the local app in the first terminal and repair it in the dashboard:

   ```bash
   npm run dev
   ```

   In the browser, select **Start repair**, review the one-selector diff, then choose **Approve & rerun**. Expected: the target test and full suite pass. Do not run `mutation:reset` after a successful repair.

   In a second terminal, also opened in `code/`, confirm the final green state:

   ```bash
   npm run test:e2e
   ```

4. Demonstrate a second repair cycle without resetting:

   ```bash
   npm run mutation:apply
   npm run test:e2e -- --grep @repair-target
   ```

   Return to the dashboard and repeat **Start repair** then **Approve & rerun**. Expected: the ID changes in the opposite direction, and the fixture proposal repairs the stale selector again. Run `npm run test:e2e` in the second terminal again if you want to confirm the final green state in the terminal.

5. Use the automated safety check during rehearsal:

   ```bash
   npm run test:mutation
   ```

   Expected: it applies one toggle, confirms exactly one `@repair-target` failure with Playwright JSON output, then returns the page to its prior state.

6. Use `npm run mutation:reset` only to undo a mutation that was applied but not repaired. It is not part of the normal successful repair loop.
