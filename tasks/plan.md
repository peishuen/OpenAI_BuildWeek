# Implementation Plan: Self-Healing Playwright Repair Console

## Overview

Build a local TypeScript application that demonstrates one approval-gated Playwright selector repair. The implementation deliberately establishes a deterministic passing/failing test fixture and a safe repair engine before adding the dashboard polish or live Qwen call. This makes the highest-risk claim—one constrained repair can be proposed, approved, applied, and verified—testable early.

## Task 12 extension: Browser-only sandbox and Qwen-primary workflow

Tasks 1-11 are complete. The remaining work turns the existing terminal-driven rehearsal into a browser-only customer journey while making Qwen, rather than a recorded proposal, the visible primary provider. The fixture provider remains a clearly labelled offline fallback for rehearsals and Qwen outages.

### Architecture decisions

- Keep the workspace local and bundled. The browser may request only the documented login-fixture mutation; it cannot name a path, command, selector, or repository.
- Refactor the current mutation logic into a server-owned sandbox-fixture module. The existing script reuses that module for developer recovery, while browser routes call the same constrained functions.
- Choose a proposal provider per repair run. The Qwen option is selected by default when server configuration is valid; the fixture option is an explicit UI fallback and is stored/disclosed as run metadata.
- Keep proposal generation separate from patch policy. Both provider modes continue through the same validator, approval gate, target-test check, full-suite check, and restoration path.
- Reset only recovers a simulated regression before approval or after a failed repair. It is unavailable after a completed repair because that repair intentionally changed the test selector to match the current fixture state.

### Dependency graph

```text
Constrained sandbox-fixture module
  -> sandbox simulation/reset API
       -> browser simulation and recovery controls
  -> existing terminal recovery script

Per-run provider selection and Qwen configuration status
  -> typed repair-run API
       -> provider-aware browser client and status display
  -> live-Qwen / explicit-fixture proposal choice
       -> existing approval-gated patch and verification flow

All feature slices
  -> rehearsal documentation and final quality gate
```

### Implementation sequence

1. Extract and test the constrained fixture mutation first, so all later UI actions call one safe source of truth.
2. Add per-run proposal-mode state and provider selection before exposing it through HTTP; this keeps Qwen-primary behavior explicit and testable without a browser.
3. Add typed API endpoints for sandbox state/actions and proposal-mode selection, including secret-free configuration disclosure.
4. Build the vertical UI slice: sandbox label, simulate/reset controls, provider disclosure/choice, and existing repair flow integration.
5. Rehearse the Qwen-primary and fixture-fallback paths; update the customer-facing demo script and recovery checklist.

### Verification checkpoints

**Checkpoint A - safe backend boundary (after Tasks 12.1-12.3)**

- The only browser-triggered source mutation is the one known login button-ID toggle.
- A repair run records and returns its selected provider without exposing credentials.
- Qwen is the default available option; fixture is an intentional fallback.
- Unit/API tests cover allowed and rejected actions.

**Checkpoint B - customer journey (after Task 12.4)**

- A browser user can simulate the regression, select Qwen, start a repair, approve it, and see both verification results.
- Fixture fallback is visibly identified and neither mode patches before approval.
- Reset is available only when it restores a coherent pre-repair/failed state.

**Checkpoint C - rehearsal-ready (after Task 12.5)**

- The Qwen-primary path is measured from simulated regression through full-suite result.
- The offline fixture fallback is rehearsed separately.
- `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, and `npm run build` pass from the restored baseline.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Qwen credentials are absent or a request fails | High | Disable or safely explain unavailable live mode; make the user explicitly select the labelled offline fixture fallback. |
| Qwen returns a valid-looking but ineffective selector | High | Preserve existing approval, target-test, full-suite, and restoration checks; never claim success before both checks pass. |
| Browser controls broaden file-write access | High | Put all mutation logic in one server module with a fixed target and no caller-controlled path/value. |
| Reset breaks a successful repaired state | Medium | Restrict reset to unrepaired/failed runs and explain the state in the UI. |
| Live timing exceeds the demo budget | Medium | Rehearse early, cap Qwen timeout, and disclose fixture fallback rather than silently switching providers. |

### Parallelization

The mutation-module extraction and provider-run-state refactor are independent at first, but the API contract must wait for both. UI work then depends on the API contract. Documentation can be drafted in parallel after the API/UI labels are finalized; the live rehearsal must be last.

## Dependency Graph

```text
Repository scaffold and shared contracts
  ├─> Controlled login app + passing 3–5-test Playwright suite
  │     └─> Deterministic selector-mutation fixture
  ├─> Pure repair engine (capture, sanitize, validate, patch)
  │     └─> Server repair-run orchestration and process runner
  │           └─> Approval-gated targeted + full-suite verification
  └─> Dashboard shell and shared repair-state events
        └─> Failure / diagnosis / diff / approval experience
              └─> End-to-end demo flow and live Qwen adapter
```

## Architecture Decisions

- Keep the product in one TypeScript repository: React/Vite client, Express service, Playwright tests, and pure repair-engine modules.
- Treat repair proposals as data, not code. The system permits exactly one validated CSS-selector string replacement in `tests/e2e/` after an explicit UI approval.
- Build with deterministic proposal fixtures first. The live Qwen adapter plugs into the same proposal interface only after safety and verification behavior work locally.
- Store a run in memory and send its state to the dashboard over SSE; use polling only if SSE risks demo stability.
- Verify a repair in two stages: rerun the affected test for immediate feedback, then run the entire small suite for credibility.

## Implementation Phases

### Phase 1: Deterministic foundation

1. Scaffold the Node/TypeScript workspace, scripts, linting, strict type checking, environment validation, and the shared repair domain contract.
2. Create the controlled login demo page plus a 3–5-test Playwright suite that is initially green.
3. Add the prepared selector-mutation mechanism and prove it makes only the tagged repair target fail.

**Checkpoint — foundation:** a clean install can build, type-check, lint, and demonstrate the known pass → single failure transition without an LLM.

### Phase 2: Safe repair engine

4. Implement failure-context capture and DOM sanitization as pure, unit-tested modules.
5. Implement proposal schema validation and the one-string patch policy, including rejection cases and restoration support.
6. Implement the process runner and repair-run state machine using recorded proposal fixtures.

**Checkpoint — engine:** a fixture proposal can repair the target test only after approval, then run both target and full suite; invalid proposals cannot modify files.

### Phase 3: Product experience

7. Build the dashboard shell, repair-run API, and event updates for the three-panel failure/diagnosis/proposed-repair view.
8. Connect the approval UI to the repair engine and render the patch, targeted-test result, full-suite result, and visible timeline.

**Checkpoint — experience:** a local user can complete the entire approval-gated workflow from the dashboard using a fixture proposal.

### Phase 4: Live intelligence and rehearsal

9. Add the server-only Qwen JSON-mode adapter, with timeouts, error states, and the same proposal validation boundary.
10. Rehearse at least two controlled selector mutations, tune sanitized context size, harden errors, and document the two-minute demo script.

**Checkpoint — complete:** live repair flow completes under 30 seconds, automated checks pass, and the demo can fall back to a recorded proposal if network/API availability fails.

## Vertical-Slice Rationale

The plan avoids building all UI before proving the repair. By the end of Phase 2, the essential product outcome works programmatically: a failing test produces a safe proposal, waits for approval, changes one selector, and validates the full suite. Phases 3–4 then make that proven flow persuasive and resilient on stage.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Live model returns an invalid or wrong proposal | High | Strict schema/policy validation; no write before approval; fixture fallback for the demo. |
| Full-suite verification exceeds demo timing | High | Keep the suite at 3–5 independent local tests; measure duration in Phase 1. |
| DOM context is noisy or too large | Medium | Strip non-semantic tags/attributes, cap input, and test two curated mutations. |
| Patch policy becomes unsafe or broad | High | Permit one CSS selector literal only under `tests/e2e/`; unit-test rejection paths. |
| Dashboard obscures the story | Medium | Fixed three-panel layout and terse evidence; no streamed private reasoning. |
| SSE is unreliable locally | Low | Use a simple polling fallback without changing repair-run state semantics. |

## Parallelization Opportunities

After the shared repair contract is stable, the login/Playwright fixture and the dashboard visual components can proceed independently. Repair-engine policy, process orchestration, and approval-gated patching must remain sequential because they share the safety contract.

## Plan Review Criteria

- The deterministic test fixture and safe patch boundary are complete before the live model integration.
- Every phase leaves a demonstrable working system.
- The final flow includes both targeted and full-suite verification.
- Scope remains limited to one locator-only repair, one local demo app, and no CI or git integration.

## Open Questions

- Is a deterministic recorded-proposal fallback acceptable for the live presentation if the API/network is unavailable?
- Should the prepared mutation be a presenter click in the app or a documented one-line source edit?
