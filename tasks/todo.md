# Build Tasks: Self-Healing Playwright Repair Console

Follow tasks in dependency order. Do not start the live Qwen integration until the fixture-driven approval flow safely patches and verifies the demo suite.

## Phase 1 — Foundation and deterministic failure

## Task 1: Scaffold the strict TypeScript workspace

**Description:** Initialize the Node workspace, React/Vite client, Express service entry point, and quality scripts. Establish `.env.example` without secrets and strict shared configuration.

**Acceptance criteria:**

- [ ] `npm run dev`, `build`, `lint`, `typecheck`, `test:unit`, and `test:e2e` scripts exist.
- [ ] TypeScript strict mode and ESLint run with no starter errors.
- [ ] `.env.example` documents `QWEN_API_KEY`, `QWEN_BASE_URL`, and `QWEN_MODEL`; `.env` is ignored.

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

## Task 11: Add the server-only Qwen proposal provider

**Description:** Implement the Qwen OpenAI-compatible Chat Completions provider behind the existing proposal-provider interface. Send only sanitized failure context, require JSON mode with thinking disabled, and handle timeout, API, JSON, and validation failures safely.

**Acceptance criteria:**

- [ ] The browser never receives `QWEN_API_KEY` or raw request credentials.
- [ ] A live response uses the same validator and patch policy as a recorded fixture.
- [ ] Missing key, timeout, invalid output, and API errors leave the test file unchanged and show a recoverable dashboard state.

**Verification:**

- [ ] `npm run test:unit -- --run tests/unit/qwen-proposal-provider.test.ts`
- [ ] Manual run with an API key validates one prepared mutation.

**Dependencies:** Task 7

**Files likely touched:** `src/qwen-proposal-provider.ts`, `src/env.ts`, `src/proposal-provider.ts`, `tests/unit/qwen-proposal-provider.test.ts`, `.env.example`

**Estimated scope:** Medium

## Task 12: Browser-only sandbox and Qwen-primary rehearsal

Implement the approved browser-only sandbox workflow in five small slices. Qwen is the customer-facing primary provider; the recorded fixture is an explicitly selected offline fallback. Do not start implementation until this task breakdown is approved.

### Task 12.1: Extract the bounded sandbox-fixture mutation

**Description:** Move the fixed login button-ID toggle/reset behavior from the terminal script into a reusable server-owned module. Keep the script as a development wrapper so the UI and script share one deterministic implementation.

**Acceptance criteria:**

- [ ] Only the known `src/LoginPage.tsx` sign-in button ID can be toggled or reset.
- [ ] The operation reports the resulting sandbox state without accepting a browser-supplied path or replacement string.
- [ ] Existing terminal mutation verification preserves its current green-to-one-failure-to-restored behavior.

**Verification:**

- [ ] Focused unit tests cover baseline, alternate, and invalid fixture-source states.
- [ ] `npm run test:mutation`
- [ ] `npm run typecheck`

**Dependencies:** Tasks 1-3

**Files likely touched:** `src/sandbox-fixture.ts`, `scripts/repair-mutation.mjs`, `tests/unit/sandbox-fixture.test.ts`

**Estimated scope:** Small

**Required skill activation:** Follow [Task 12.1](task-12-skill-activation.md#task-121-bounded-sandbox-fixture-mutation).

### Task 12.2: Make proposal-provider choice explicit per repair run

**Description:** Evolve the repair-run/orchestrator contract so a run records whether it uses Qwen or the fixture fallback. The orchestrator selects the requested provider but retains the existing shared validation, approval, patch, verification, and restoration behavior.

**Acceptance criteria:**

- [ ] A run records a provider mode of `qwen` or `fixture` and exposes no credential material.
- [ ] Qwen is selected as the primary mode when live configuration is available; fixture mode is accepted only as an explicit fallback choice.
- [ ] Both modes traverse the same no-patch-before-approval and restore-on-failed-verification rules.

**Verification:**

- [ ] Focused orchestrator tests prove selection is per run and does not bypass approval.
- [ ] Existing Qwen provider error tests still show safe, fallback-oriented messages.
- [ ] `npm run typecheck`

**Dependencies:** Task 11

**Files likely touched:** `src/repair.ts`, `src/repair-orchestrator.ts`, `src/proposal-provider.ts`, `tests/unit/repair-orchestrator.test.ts`, `tests/unit/qwen-proposal-provider.test.ts`

**Estimated scope:** Medium

**Required skill activation:** Follow [Task 12.2](task-12-skill-activation.md#task-122-per-run-provider-choice).

### Task 12.3: Add typed sandbox and provider-aware API boundaries

**Description:** Add API routes for reading sandbox/provider availability, simulating the regression, resetting a recoverable sandbox state, and starting a provider-selected repair. Wire server environment configuration without exposing secrets.

**Acceptance criteria:**

- [ ] The API accepts only a validated proposal mode and never accepts a target path, command, or selector.
- [ ] Qwen availability is disclosed as a boolean/safe message; API keys, base URLs, and raw provider errors never reach the browser.
- [ ] Simulation/reset routes call only the bounded sandbox-fixture module and reject reset after a completed repair.

**Verification:**

- [ ] API tests cover valid simulation, invalid mode, missing run, reset state rules, and secret-safe errors.
- [ ] Environment tests cover configured Qwen and unavailable Qwen states.
- [ ] `npm run test:unit -- --run tests/unit/repair-api.test.ts tests/unit/env.test.ts`

**Dependencies:** Tasks 12.1 and 12.2

**Files likely touched:** `src/repair-routes.ts`, `src/server.ts`, `src/env.ts`, `tests/unit/repair-api.test.ts`, `tests/unit/env.test.ts`

**Estimated scope:** Medium

**Required skill activation:** Follow [Task 12.3](task-12-skill-activation.md#task-123-sandbox-and-provider-aware-api).

### Task 12.4: Deliver the browser-only sandbox customer journey

**Description:** Extend the Repair Console and browser client with visible sandbox disclosure, Qwen-primary provider state, explicit fixture fallback, regression simulation, recoverable reset, and the existing start/approve timeline.

**Acceptance criteria:**

- [ ] The UI says **Sandbox workspace** and states that it affects only the bundled login fixture and repair target.
- [ ] **Simulate selector regression** starts a known failure without a terminal command; **Start repair** uses Qwen by default when available.
- [ ] Fixture fallback is visibly labelled; no state implies it was a Qwen response.
- [ ] The UI prevents duplicate actions and offers reset only in a safe recovery state.

**Verification:**

- [ ] Focused client/status tests cover provider and reset messaging.
- [ ] Manual browser flow: simulate -> Qwen proposal -> approve -> target pass -> suite pass.
- [ ] Manual browser flow: explicit fixture fallback is clearly labelled and completes the same safe loop.
- [ ] `npm run build`

**Dependencies:** Task 12.3

**Files likely touched:** `src/RepairConsole.tsx`, `src/repair-client.ts`, `src/repair-console-status.ts`, `src/repair-console.css`, `tests/unit/repair-console.test.ts`

**Estimated scope:** Medium

**Required skill activation:** Follow [Task 12.4](task-12-skill-activation.md#task-124-browser-only-customer-journey).

### Task 12.4.1: Restore the canonical sandbox baseline

**Description:** Correct the committed state so the login fixture, repair-target test, and sandbox state machine agree that `sign-in-button` is baseline and `sign-in-button-v2` is the simulated regression.

**Acceptance criteria:**

- [x] `src/LoginPage.tsx` renders `id="sign-in-button"` before any simulation.
- [x] The `@repair-target` locator is `#sign-in-button` before any simulation.
- [x] No sandbox API, provider, patch-policy, or reset-state behavior is broadened.

**Verification:**

- [x] `npm run test:e2e -- --grep @repair-target`
- [x] `npm run test:mutation`
- [x] `npm run typecheck`

**Dependencies:** Task 12.4

**Files likely touched:** `src/LoginPage.tsx`, `tests/e2e/login.spec.ts`, `scripts/repair-mutation.mjs`

**Estimated scope:** Small

**Required skill activation:** Follow [Task 12.4](task-12-skill-activation.md#task-124-browser-only-customer-journey), starting with test-driven development.

### Task 12.4.2: Guard the browser sandbox state contract

**Description:** Strengthen the existing E2E scenario so it proves the baseline label on load, the regression label after one simulation, and the baseline label after a second simulation. This catches a fixture/test state mismatch before presentation.

**Acceptance criteria:**

- [x] The initial console state visibly reports `baseline`.
- [x] The first simulation visibly reports `selector regression simulated` and makes the repair target fail.
- [x] The second simulation visibly returns to `baseline` and restores the repair-target pass.

**Verification:**

- [x] `npm run test:e2e -- --grep @sandbox-only`
- [x] `npm run test:e2e`
- [x] Fixture-fallback path: simulate -> start -> approve -> target pass -> full-suite pass (two cycles; restored baseline).

**Dependencies:** Task 12.4.1

**Files likely touched:** `tests/e2e/login.spec.ts`

**Estimated scope:** Small

**Required skill activation:** Follow [Task 12.4](task-12-skill-activation.md#task-124-browser-only-customer-journey), including browser verification.

### Task 12.5: Rehearse, document, and gate the demo

**Description:** Replace terminal mutation instructions with the approved customer journey, document Qwen setup/fallback/recovery, measure the live path, and record the results in a concise rehearsal checklist.

**Acceptance criteria:**

- [ ] The presenter script uses only browser controls after starting the app; terminal mutation commands are omitted from the customer flow.
- [ ] Documentation distinguishes live-Qwen primary mode from explicitly selected fixture fallback and gives safe recovery actions.
- [ ] At least one live-Qwen rehearsal and one fixture-fallback rehearsal have recorded duration and result.

**Verification:**

- [ ] Timed browser rehearsal from simulation to full-suite result.
- [ ] `npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build`

**Dependencies:** Task 12.4

**Files likely touched:** `docs/demo-script.md`, `docs/rehearsal-checklist.md`, `docs/specs/browser-only-sandbox-repair-workflow.md`

**Estimated scope:** Small

**Required skill activation:** Follow [Task 12.5](task-12-skill-activation.md#task-125-rehearsal-documentation-and-final-gate).

## Final Definition of Done

- [ ] All 12 tasks and all phase checkpoints are complete.
- [ ] A selector mutation produces a reviewable proposal but no patch before approval.
- [ ] A valid approved repair changes one selector, passes its target test, then passes the complete demo suite.
- [ ] Invalid or failed repairs remain safe and restore the test file.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, and `npm run build` all pass.
