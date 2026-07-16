# Build Tasks: Self-Healing Playwright Repair Console

Follow tasks in dependency order. Do not start the live OpenAI integration until the fixture-driven approval flow safely patches and verifies the demo suite.

## Phase 1 — Foundation and deterministic failure

## Task 1: Scaffold the strict TypeScript workspace

**Description:** Initialize the Node workspace, React/Vite client, Express service entry point, and quality scripts. Establish `.env.example` without secrets and strict shared configuration.

**Acceptance criteria:**

- [ ] `npm run dev`, `build`, `lint`, `typecheck`, `test:unit`, and `test:e2e` scripts exist.
- [ ] TypeScript strict mode and ESLint run with no starter errors.
- [ ] `.env.example` documents `OPENAI_API_KEY` and `OPENAI_MODEL` only; `.env` is ignored.

**Verification:**

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`

**Dependencies:** None

**Files likely touched:** `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`

**Estimated scope:** Medium

## Task 2: Build the controlled login demo and green Playwright suite

**Description:** Create a minimal login page with stable initial selectors and 3–5 independent Playwright tests, including a test tagged `@repair-target`.

**Acceptance criteria:**

- [ ] The login page renders email, password, and sign-in controls.
- [ ] The full Playwright demo suite has 3–5 independent passing tests.
- [ ] One test targets a `page.locator(...)` CSS-selector string intended for later repair.

**Verification:**

- [ ] `npm run test:e2e`
- [ ] Manually load the login page and submit the mock form.

**Dependencies:** Task 1

**Files likely touched:** `src/client/demo/LoginPage.tsx`, `src/client/demo/login.css`, `tests/e2e/login.spec.ts`, `playwright.config.ts`

**Estimated scope:** Medium

## Task 3: Add the prepared selector-mutation scenario

**Description:** Add a deliberate, documented one-line selector mutation so a presenter can move the suite from all-green to exactly one `@repair-target` failure.

**Acceptance criteria:**

- [ ] The baseline configuration keeps the entire suite green.
- [ ] Applying the documented mutation changes the control's ID or data attribute and causes only the repair-target test to fail.
- [ ] A reset path restores the green baseline without manual ambiguity.

**Verification:**

- [ ] `npm run test:e2e`
- [ ] Apply mutation, run `npm run test:e2e -- --grep @repair-target`, then reset and repeat.

**Dependencies:** Task 2

**Files likely touched:** `src/client/demo/LoginPage.tsx`, `tests/e2e/login.spec.ts`, `docs/demo-script.md`

**Estimated scope:** Small

### Checkpoint: Deterministic fixture

- [ ] A presenter can show green → one known red test → green again locally.
- [ ] `npm run lint`, `npm run typecheck`, and `npm run test:e2e` pass after reset.

## Phase 2 — Safe repair engine

## Task 4: Define repair contracts and run-state transitions

**Description:** Create the shared types and Zod schemas for failure context, repair proposals, run states, and event payloads. Model approval as a required transition before patching.

**Acceptance criteria:**

- [ ] Shared types describe the complete lifecycle from failure capture through full-suite result.
- [ ] The proposal schema permits only selector, diagnosis, and short evidence fields.
- [ ] State-transition tests prove a run cannot apply a patch before approval.

**Verification:**

- [ ] `npm run test:unit -- --run tests/unit/repair-state.test.ts`
- [ ] `npm run typecheck`

**Dependencies:** Task 1

**Files likely touched:** `src/shared/repair-types.ts`, `src/shared/repair-schemas.ts`, `src/server/repair/repair-state.ts`, `tests/unit/repair-state.test.ts`

**Estimated scope:** Medium

## Task 5: Implement failure-context capture and DOM sanitization

**Description:** Extract the failed selector, error excerpt, source location, and relevant DOM snapshot; remove disallowed tags and attributes and enforce a configurable size cap.

**Acceptance criteria:**

- [ ] Sanitization removes `script`, `style`, `svg`, comments, and event-handler attributes.
- [ ] Relevant visible control text and safe attributes survive sanitization.
- [ ] Oversized snapshots are truncated deterministically and covered by tests.

**Verification:**

- [ ] `npm run test:unit -- --run tests/unit/dom-sanitizer.test.ts`
- [ ] `npm run typecheck`

**Dependencies:** Task 4

**Files likely touched:** `src/server/repair/dom-sanitizer.ts`, `src/server/playwright/failure-context.ts`, `tests/unit/dom-sanitizer.test.ts`, `tests/fixtures/dom-snapshots.ts`

**Estimated scope:** Medium

## Task 6: Implement the proposal validator and one-string patcher

**Description:** Validate a proposal against the known failed `page.locator(...)` source range, patch exactly one CSS-selector literal in `tests/e2e/`, and support restoration from a pre-patch snapshot.

**Acceptance criteria:**

- [ ] A valid fixture changes only the expected selector string once.
- [ ] Invalid selector syntax, multiple matches, out-of-root paths, and unsupported expressions are rejected without a write.
- [ ] The original file can be restored after a failed verification run.

**Verification:**

- [ ] `npm run test:unit -- --run tests/unit/repair-patcher.test.ts`
- [ ] `npm run typecheck`

**Dependencies:** Task 4

**Files likely touched:** `src/server/repair/proposal-validator.ts`, `src/server/repair/test-patcher.ts`, `tests/unit/repair-patcher.test.ts`, `tests/fixtures/repair-proposals.ts`

**Estimated scope:** Medium

## Task 7: Implement fixture-driven repair orchestration and verification

**Description:** Wire the capture, sanitizer, state machine, proposal fixture, patcher, and Playwright child-process runner into a server-side repair run that waits for approval and executes both verification stages.

**Acceptance criteria:**

- [ ] A failed repair-target run reaches `awaitingApproval` with a validated fixture proposal.
- [ ] Approval applies the one allowed patch, reruns the target test, then reruns the full suite.
- [ ] A failed target or suite verification restores the test file and ends in an explanatory failed state.

**Verification:**

- [ ] `npm run test:unit -- --run tests/unit/repair-orchestrator.test.ts`
- [ ] `npm run test:e2e`

**Dependencies:** Tasks 3, 5, and 6

**Files likely touched:** `src/server/repair/repair-orchestrator.ts`, `src/server/playwright/test-runner.ts`, `src/server/repair/proposal-provider.ts`, `tests/unit/repair-orchestrator.test.ts`, `tests/fixtures/repair-proposals.ts`

**Estimated scope:** Medium

### Checkpoint: Safe engine

- [ ] Fixture-driven repair works only after approval.
- [ ] Invalid proposals make no file changes.
- [ ] Target test and full suite pass after a valid approved repair.

## Phase 3 — Dashboard and approval workflow

## Task 8: Expose repair-run API and event stream

**Description:** Add endpoints to start a repair run, approve an awaiting proposal, retrieve the active run, and subscribe to state updates. Keep API payloads typed and reject invalid requests.

**Acceptance criteria:**

- [ ] Start and approval endpoints cannot bypass run-state rules.
- [ ] The client receives ordered events for capture, proposal, patch, target verification, and suite verification.
- [ ] Server errors become safe, user-facing repair states without leaking secrets or raw model data.

**Verification:**

- [ ] `npm run test:unit -- --run tests/unit/repair-api.test.ts`
- [ ] Manual API request confirms no patch occurs before approval.

**Dependencies:** Task 7

**Files likely touched:** `src/server/api/repair-routes.ts`, `src/server/api/repair-events.ts`, `src/server/index.ts`, `tests/unit/repair-api.test.ts`

**Estimated scope:** Medium

## Task 9: Build the static three-panel dashboard

**Description:** Create the visual dashboard shell: Failure, Diagnosis, and Proposed repair panels, including an accessible diff preview and timeline status components.

**Acceptance criteria:**

- [ ] The dashboard clearly displays failed selector, source location, error excerpt, diagnosis, evidence, and before/after selector diff.
- [ ] The **Approve & rerun** action is disabled unless the run is awaiting approval.
- [ ] The layout is readable at presentation scale on a standard laptop viewport.

**Verification:**

- [ ] `npm run build`
- [ ] Manual browser check at 1280×720 and keyboard navigation of the approval control.

**Dependencies:** Task 4

**Files likely touched:** `src/client/dashboard/RepairConsole.tsx`, `src/client/dashboard/FailurePanel.tsx`, `src/client/dashboard/DiagnosisPanel.tsx`, `src/client/dashboard/RepairPanel.tsx`, `src/client/dashboard/repair-console.css`

**Estimated scope:** Medium

## Task 10: Connect dashboard approval to the repair run

**Description:** Subscribe the dashboard to repair events, start a repair from the UI, route explicit approval to the API, and render the final target-test and full-suite outcomes in a concise timeline.

**Acceptance criteria:**

- [ ] A user can start a fixture-backed repair from the dashboard and see the proposed diff.
- [ ] The test file remains unchanged until **Approve & rerun** is clicked.
- [ ] The UI displays separate target-test and full-suite final results, including safe failure messages.

**Verification:**

- [ ] `npm run test:unit -- --run tests/unit/repair-events.test.ts`
- [ ] Manual end-to-end flow using the mutation fixture and recorded proposal.

**Dependencies:** Tasks 8 and 9

**Files likely touched:** `src/client/hooks/useRepairRun.ts`, `src/client/dashboard/RepairConsole.tsx`, `src/client/api/repair-client.ts`, `src/server/api/repair-events.ts`, `tests/unit/repair-events.test.ts`

**Estimated scope:** Medium

### Checkpoint: Demo experience without live AI

- [ ] The dashboard demonstrates the full approval-gated repair loop using a recorded valid proposal.
- [ ] The full demo suite passes after repair and the UI visibly reports it.

## Phase 4 — Live model integration and rehearsal

## Task 11: Add the server-only OpenAI proposal provider

**Description:** Implement the Responses API provider behind the existing proposal-provider interface. Send only sanitized failure context; require the structured proposal schema and handle timeout, API, and validation failures safely.

**Acceptance criteria:**

- [ ] The browser never receives `OPENAI_API_KEY` or raw request credentials.
- [ ] A live response uses the same validator and patch policy as a recorded fixture.
- [ ] Missing key, timeout, invalid output, and API errors leave the test file unchanged and show a recoverable dashboard state.

**Verification:**

- [ ] `npm run test:unit -- --run tests/unit/openai-proposal-provider.test.ts`
- [ ] Manual run with an API key validates one prepared mutation.

**Dependencies:** Task 7

**Files likely touched:** `src/server/repair/openai-proposal-provider.ts`, `src/server/config/env.ts`, `src/server/repair/proposal-provider.ts`, `tests/unit/openai-proposal-provider.test.ts`, `.env.example`

**Estimated scope:** Medium

## Task 12: Rehearse, harden, and document the two-minute demo

**Description:** Measure latency, rehearse two prepared mutations, confirm the fixture fallback, improve presentation-state errors, and document exact presenter steps and recovery actions.

**Acceptance criteria:**

- [ ] Two selector mutations produce valid repair proposals and green full-suite results in rehearsal.
- [ ] The post-failure flow completes under 30 seconds on the demo machine.
- [ ] The demo script includes green baseline, mutation, failure, proposal review, approval, targeted pass, full-suite pass, and fallback disclosure.

**Verification:**

- [ ] `npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build`
- [ ] Timed manual rehearsal from mutation to full-suite result.

**Dependencies:** Tasks 10 and 11

**Files likely touched:** `docs/demo-script.md`, `docs/rehearsal-checklist.md`, `src/client/dashboard/RepairConsole.tsx`, `tests/e2e/login.spec.ts`

**Estimated scope:** Small

## Final Definition of Done

- [ ] All 12 tasks and all phase checkpoints are complete.
- [ ] A selector mutation produces a reviewable proposal but no patch before approval.
- [ ] A valid approved repair changes one selector, passes its target test, then passes the complete demo suite.
- [ ] Invalid or failed repairs remain safe and restore the test file.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, and `npm run build` all pass.
