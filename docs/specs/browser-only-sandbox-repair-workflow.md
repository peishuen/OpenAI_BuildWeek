# Spec: Browser-Only Sandbox Repair Workflow

**Status:** Draft — awaiting approval before planning or implementation.

## Objective

Turn the existing Repair Console into a customer-operated, browser-only sandbox experience for the hackathon. A QA engineer or frontend developer must be able to create a controlled selector regression, review an AI-generated repair, explicitly approve it, and observe target-test and full-suite verification without running terminal mutation commands.

The product demonstrates a narrowly scoped developer-tool workflow, not a hosted service connected to an arbitrary customer repository. The bundled login fixture is the only mutable application target.

### User journey

1. The user opens the Repair Console and sees that it is a **Sandbox workspace**.
2. The user selects **Simulate selector regression**.
3. The server switches the known login button ID and the UI shows a simulated-regression state.
4. The user selects **Start repair**. The service runs the failing target test, captures safe evidence, and requests a proposal from Qwen.
5. The console displays the failed selector, concise evidence, and one selector diff. No test file has changed.
6. The user selects **Approve & rerun**. The service applies exactly one validated selector literal, runs the target test, then the full suite.
7. The console reports either a completed repair or a safe failure. The user can select **Simulate selector regression** again to toggle the fixed fixture and begin the next review cycle; **Reset sandbox** remains available for recovery or rehearsal.

### Success criteria

- The complete happy path is operable in the browser; the presenter never needs `npm run mutation:apply` or `npm run mutation:reset`.
- The visible primary provider is Qwen. It receives only the existing sanitized failure context and remains server-only.
- A customer must approve the exact selector diff before the test file is changed.
- A successful repair reports both a passing target test and passing full suite.
- Invalid Qwen output, Qwen/API failure, or failed verification leaves the test file unchanged or restores it, and produces a clear recovery message.
- The UI labels the workspace as a sandbox and states that it changes only the bundled login fixture and Playwright test.
- Fixture mode remains available as an explicit **offline fallback**, never silently masquerading as a live model response.

## Assumptions and scope

- The product is still run locally for the hackathon. No hosted deployment, repository connection, authentication, database, or remote worker is introduced.
- The allowed application mutation remains the documented sign-in button ID toggle in `src/LoginPage.tsx`.
- The allowed repair remains one CSS-selector literal in `tests/e2e/login.spec.ts`, subject to the existing proposal validation and restoration policy.
- Qwen is selected when valid Qwen configuration is present. The browser must never receive credentials.
- The UI preselects **Live Qwen** when it is configured. The user can explicitly select **Offline fixture fallback** for a deterministic rehearsal; the selected provider is visible throughout the run.
- **Reset sandbox** is available only before approval or after a failed repair. After a completed repair, **Simulate selector regression** toggles the fixed fixture to create the next bounded regression; it does not reset the completed repair.

## Provider behavior

### Primary: Qwen

The service sends the existing sanitized failure context to Qwen. A valid, approved proposal may use any policy-allowed CSS selector supported by the observed DOM; it is not required to produce the fixture's exact ID selector. The existing validator, one-string patcher, target-test run, full-suite run, and restoration behavior remain unchanged.

### Explicit fallback: fixture

The fixture provider returns a recorded proposal for the two known sandbox button-ID states. It exists to demonstrate the workflow if Qwen credentials, API availability, or network latency prevent a live model call. The UI must identify it as **Offline fixture fallback**, so users do not mistake it for an AI-generated proposal.

## Commands

Run from `code/`:

```powershell
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

The terminal-only mutation commands remain maintenance/recovery tools during development but are not part of the customer journey:

```powershell
npm run mutation:apply
npm run mutation:reset
```

## Project structure

```text
code/
  src/
    RepairConsole.tsx          # Sandbox controls, provider disclosure, repair status
    repair-client.ts           # Typed browser calls to repair and sandbox APIs
    repair-routes.ts           # Repair and sandbox mutation HTTP boundaries
    repair-orchestrator.ts     # Approval-gated proposal, patch, and verification flow
    qwen-proposal-provider.ts  # Server-only live proposal provider
    fixture-proposal-provider.ts # Explicit offline fallback provider
    server.ts                  # Provider selection and API wiring
    LoginPage.tsx              # The only sandbox-mutable application fixture
  scripts/repair-mutation.mjs  # Existing development/recovery mutation behavior
  tests/unit/                  # Unit/API/UI-state tests
  tests/e2e/                   # Controlled Playwright suite and repair target
docs/
  specs/browser-only-sandbox-repair-workflow.md
  demo-script.md
  rehearsal-checklist.md
tasks/
  plan.md
  todo.md
```

## Code style

- Keep TypeScript strict and validate all browser/API/model input at its boundary.
- Keep mutations server-side, narrowly named, and deterministic; never permit a path supplied by the browser.
- Prefer typed results for expected failure paths, with user-safe messages.
- Use clear provider and sandbox labels instead of inferring hidden state in the UI.

```ts
export type ProposalMode = "qwen" | "fixture";

export function canStartLiveRepair(mode: ProposalMode, hasQwenConfig: boolean) {
  return mode === "fixture" || hasQwenConfig;
}
```

## Testing strategy

- **Unit tests:** provider selection, sandbox mutation state, invalid mutation requests, and the existing Qwen error/validation behavior.
- **API tests:** the simulation and reset endpoints enforce the fixture-only boundary and return safe state; provider mode is disclosed without secrets.
- **UI tests:** controls reflect simulation state, present a Qwen/fixture label, prevent duplicate requests, and make reset a recovery action.
- **E2E/manual rehearsal:** exercise one live-Qwen repair if credentials are configured; exercise offline fallback separately; in each case verify no test-file write before approval and a green target/full suite after successful approval. Browser-control checks that mutate the sandbox are excluded from the active-repair full-suite run.
- **Quality gate:** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, and `npm run build` pass from the restored baseline.

## Boundaries

### Always

- Display the current proposal provider and sandbox limitation in the browser.
- Keep Qwen credentials and raw provider errors off the client.
- Apply no repair patch before explicit approval.
- Restore a test file after failed verification.
- Restrict UI-triggered mutation to the documented login button ID toggle.

### Ask first

- Adding dependencies.
- Changing the repair policy to support more files, application code beyond the login fixture, or automatic repair approval.
- Adding hosted deployment, GitHub/repository connectivity, authentication, a database, CI integration, or background job infrastructure.
- Changing the Qwen model, provider, or sanitized-context policy.

### Never

- Present fixture output as a live Qwen response.
- Send secrets or raw environment variables to the browser.
- Accept a file path, shell command, or arbitrary source mutation from the UI or model.
- Claim arbitrary repository or production-test-suite support.

## Open questions

- What user-safe copy should explain a missing Qwen configuration versus a Qwen request failure?
