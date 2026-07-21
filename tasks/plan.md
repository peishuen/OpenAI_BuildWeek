# Implementation Plan: Self-Healing Playwright Repair Console

## Overview

Build a local TypeScript application that demonstrates one approval-gated Playwright selector repair. The implementation deliberately establishes a deterministic passing/failing test fixture and a safe repair engine before adding the dashboard polish or live Qwen call. This makes the highest-risk claim—one constrained repair can be proposed, approved, applied, and verified—testable early.

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
