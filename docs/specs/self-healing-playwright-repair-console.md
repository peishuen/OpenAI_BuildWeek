# Spec: Self-Healing Playwright Repair Console

## Objective

Build a local, approval-gated developer tool that repairs a deliberately broken, single CSS locator in a Playwright test. It demonstrates a credible maintenance workflow for frontend developers and QA automation engineers:

1. A prepared UI selector mutation causes one Playwright test to fail.
2. The repair engine captures the failure context and a sanitized DOM snapshot.
3. An LLM proposes one minimal locator replacement and a concise explanation of its evidence.
4. The dashboard presents the failure, evidence, and code diff.
5. The developer chooses **Approve & rerun**.
6. The engine applies the narrowly validated patch, reruns the repaired test, then reruns the complete demo suite.

The MVP's job is not to make all E2E tests autonomous. Its job is to turn one common selector-maintenance chore into a reviewable, auditable repair loop that completes in under 30 seconds during a local demo.

### User stories

- As a QA automation engineer, I can see exactly why a selector-based Playwright test failed and what replacement the agent recommends.
- As a frontend developer, I must explicitly approve the proposed repair before any test file changes.
- As a demo viewer, I can see that both the repaired test and the complete 3–5-test demo suite pass after approval.

## Tech Stack

- **Runtime:** Node.js 22 LTS and TypeScript with strict type checking.
- **Frontend:** React and Vite for the local dashboard and controlled demo login page.
- **Service:** Express HTTP API in the same repository; it owns repair orchestration and local file access.
- **Tests:** Playwright Test for the E2E suite; Vitest for unit tests of sanitization, patch validation, and repair state.
- **LLM:** Alibaba Cloud Model Studio Qwen through its OpenAI-compatible Chat Completions API, called only by the Express service. Default model configuration: `qwen3.7-plus-2026-05-26`, overridable by `QWEN_MODEL`.
- **Validation:** Zod schemas for environment variables, API payloads, LLM proposals, and repair state.
- **Transport:** Server-sent events (SSE) for one repair run's status timeline; polling is an acceptable fallback if SSE adds material risk.

The model response must use JSON mode with thinking disabled and contain only an explanation, evidence, and one CSS selector replacement. The server validates parsed JSON with the strict proposal schema before any patch policy is considered. [Qwen structured-output documentation](https://help.aliyun.com/en/model-studio/qwen-structured-output)

## Commands

These are the required package scripts after project scaffolding:

```bash
npm install
npm run dev                  # Start the dashboard, API, and demo app locally
npm run test:unit            # Run Vitest unit tests once
npm run test:e2e             # Run all Playwright demo tests
npm run test:e2e -- --grep @repair-target
npm run lint                 # Run ESLint with zero warnings
npm run typecheck            # Run TypeScript without emitting files
npm run build                # Create a production build
```

## Project Structure

```text
src/
  client/                    # React UI: dashboard and controlled demo login page
    components/              # Failure, evidence, diff, approval, and timeline UI
    hooks/                   # Repair-event subscription and view-model hooks
  server/
    api/                     # Start-run, approve-run, and event-stream endpoints
    repair/                  # Capture, sanitization, proposal, validation, patching, rerun
    playwright/              # Child-process runner and error/report parsing
    shared/                  # Shared domain types and schemas
tests/
  e2e/                       # 3–5 deterministic Playwright tests and repair fixture
  unit/                      # Vitest tests for repair-engine modules
docs/
  ideas/                     # Confirmed product direction
  specs/                     # This living specification
```

## Architecture and Workflow

```text
Playwright failure
  -> capture error, source location, failed CSS selector, DOM snapshot
  -> sanitize and size-limit DOM context
  -> Qwen JSON repair proposal
  -> validate proposal against strict patch policy
  -> dashboard displays evidence and diff
  -> developer approves
  -> apply exactly one allowed string replacement
  -> rerun target test
  -> rerun full 3–5-test demo suite
  -> stream final results to dashboard
```

### Repair context

The repair engine sends only the following to the model:

- the failed test name, path, and failing source line;
- the existing CSS selector and a short error excerpt;
- a sanitized DOM snapshot captured at failure; and
- an instruction to return one CSS-selector replacement only when the evidence supports it.

DOM sanitization removes `script`, `style`, `svg`, comments, event-handler attributes, and irrelevant attributes. It truncates the remaining HTML to a configurable safe size while preserving the neighborhood around the failed control when available.

### Repair proposal contract

The LLM proposal schema contains:

```ts
const repairProposalSchema = z.object({
  replacementSelector: z.string().min(1).max(300),
  diagnosis: z.string().min(1).max(500),
  evidence: z.array(z.string().min(1).max(240)).min(1).max(3),
});
```

The system does not accept arbitrary generated code. A proposal is valid only if all conditions hold:

- its target is the known failing locator in a test file below `tests/e2e/`;
- it changes exactly one CSS selector string literal in a supported `page.locator(...)` expression;
- the old selector occurs exactly once at the expected source location;
- the new selector passes a local syntax and allowlist check;
- the proposal contains no file path, shell command, JavaScript expression, or application-code change.

An invalid proposal is displayed as a safe failure; no patch is written.

### Dashboard behavior

The primary screen has three fixed panels:

- **Failure:** test name, failed locator, error excerpt, and test source location.
- **Diagnosis:** concise evidence-backed explanation and a sanitized DOM excerpt, not private model reasoning.
- **Proposed repair:** focused before/after diff and **Approve & rerun** button.

Before approval, the repair is read-only. After approval, the UI replaces the action with a visible timeline: `Patch applied`, `Target test passed/failed`, and `Full demo suite passed/failed`. The final state gives both target-test and suite totals.

## Code Style

- Use TypeScript `strict` mode; avoid `any` and use Zod validation at untrusted boundaries.
- Prefer named exports, `camelCase` functions/variables, `PascalCase` React components/types, and `kebab-case` filenames.
- Keep side effects at module edges. Repair policy functions must be deterministic and unit-testable.
- Return typed result objects for expected repair failures instead of throwing control-flow exceptions.

```ts
export function validateRepairProposal(
  input: unknown,
  context: RepairContext,
): RepairValidationResult {
  const proposal = repairProposalSchema.safeParse(input);

  if (!proposal.success) {
    return { ok: false, reason: "Proposal did not match the required schema." };
  }

  if (!isSupportedLocatorChange(proposal.data.replacementSelector, context)) {
    return { ok: false, reason: "Proposal exceeds the locator-only patch policy." };
  }

  return { ok: true, proposal: proposal.data };
}
```

## Testing Strategy

### Unit tests

Vitest tests live under `tests/unit/` and cover:

- DOM sanitization removes excluded nodes/attributes and preserves relevant control text/attributes.
- LLM proposal schema rejects malformed or oversized output.
- Patch validator rejects path traversal, arbitrary code, multiple replacements, unsupported locator forms, and mismatched source text.
- Patcher changes exactly the expected selector and supports restoration for deterministic test setup.
- Repair state transitions prohibit application before explicit approval.

### E2E tests

Playwright tests live under `tests/e2e/`. The controlled suite contains 3–5 independent tests, including one tagged repair target. It must establish:

- the initial suite passes before the prepared mutation;
- the selector mutation makes only the repair-target test fail;
- approving a valid repair restores the repair-target test;
- the complete suite passes after the repair.

LLM-dependent tests must not require a live API key. Use recorded valid and invalid proposal fixtures for automated tests; the live API path is manually verified during the demo rehearsal.

### Quality gates

Before implementation milestones and any commit, run:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

## Boundaries

### Always

- Keep `QWEN_API_KEY` and `QWEN_BASE_URL` server-side in `.env`; include only a redacted `.env.example` in version control.
- Validate model responses and API payloads before using them.
- Restrict patch targets to the configured `tests/e2e/` root and display the exact diff before approval.
- Run the target test and full demo suite after an approved patch.
- Preserve a pre-patch in-memory snapshot so a failed repair can be restored during the demo.

### Ask first

- Adding a dependency beyond the agreed stack.
- Changing the repair policy to permit arbitrary TypeScript, multiple files, application files, or automatic writes.
- Adding authentication, a database, hosted deployment, CI provider integration, or a git commit/PR action.
- Changing the model default or incorporating external data sources.

### Never

- Expose secrets, raw environment variables, or the Qwen API key to the client or git.
- Apply a patch without explicit UI approval.
- Execute model-produced shell commands or write model-produced file paths.
- Claim support for general test healing, flaky test remediation, or business-flow repair.
- Display hidden chain-of-thought as dashboard reasoning.

## Success Criteria

- A live operator can trigger a prepared ID or data-attribute selector mutation from an initially passing state.
- The dashboard shows the exact failed selector, a concise error, sanitized relevant DOM evidence, and one minimal diff.
- No file changes occur until the operator clicks **Approve & rerun**.
- The system refuses malformed or policy-violating model proposals without changing a file.
- After a valid approval, the agent changes exactly one allowed selector, reruns the repaired test, then reruns the entire 3–5-test demo suite.
- Both the repaired test and full demo suite pass, with a visible final status.
- The complete post-failure repair flow finishes in under 30 seconds on the demo machine, excluding any deliberate presenter pause.
- Automated local checks pass: lint, type check, unit tests, E2E tests, and production build.

## Open Questions

- Confirm during implementation whether SSE is worth its small complexity or whether 500 ms polling is more reliable for the demo.
- Pick the exact CSS selector mutations used in the live demo and fixture tests.
- Choose the DOM snapshot size cap after observing model latency and quality in the first rehearsal.
