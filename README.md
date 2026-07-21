# Repair Console

Repair Console is an approval-gated developer tool for one common Playwright maintenance problem: a frontend selector changes while an end-to-end test still expects the old selector.

Instead of applying a model-generated change automatically, the console captures focused failure evidence, presents one proposed CSS-selector replacement, and requires explicit developer approval. After approval, it verifies the repaired target test and the complete demo suite.

**Track:** Developer Tools

**Supported platform:** local Windows development with Node.js 22 LTS. The project uses a browser-based sandbox and does not require a database, external repository connection, or CI account.

## Demo video

> Add the public YouTube demo URL here before submitting.

The video demonstrates the browser-only workflow: simulate a selector regression, review the proposal, approve the change, and watch the target test and full suite pass.

## What it does

- Simulates a controlled login-button selector regression directly in the browser.
- Captures the failed selector, short error message, source location, and sanitized DOM snapshot.
- Uses Qwen as the live proposal provider when server-side configuration is available.
- Shows the diagnosis, evidence, and exact selector diff before any test file changes.
- Permits exactly one validated CSS-selector literal change below `tests/e2e/`.
- Requires **Approve & rerun** before patching, then verifies the target test and full suite.
- Provides a clearly labelled offline fixture fallback for deterministic rehearsal.

## Quick start

### Prerequisites

- Node.js 22 LTS
- npm
- Chromium for Playwright

From a fresh clone:

```powershell
cd code
npm ci
npx playwright install chromium
Copy-Item .env.example .env
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The React dashboard runs on port `5173`; its local Express API runs on port `3001`.

### Live Qwen configuration

Edit `code/.env` locally; never commit it.

```dotenv
QWEN_API_KEY=your-server-only-key
QWEN_BASE_URL=https://your-qwen-openai-compatible-endpoint/v1
QWEN_MODEL=qwen3.7-plus-2026-05-26
```

When both the key and base URL are configured, **Live Qwen** is preselected in the console. Otherwise, select **Offline fixture fallback** to exercise the same approval and verification workflow without a network call.

## Judge-friendly sandbox

Judges can test the complete approval-gated workflow without Qwen credentials:

1. Follow the Quick start steps.
2. Open the local dashboard and select **Offline fixture fallback**.
3. Follow the Browser demo flow below.

The fallback changes no safety policy: it still requires approval, patches one validated selector literal, and runs the target test and full suite.

## Browser demo flow

1. Start at **Fixture state: Baseline**.
2. Select **Simulate selector regression**. The login fixture changes but the Playwright test remains stale.
3. Select **Start repair**, review the failure, evidence, and one-selector diff.
4. Select **Approve & rerun**. Do not refresh or reset while verification is in progress.
5. Wait for **Repair completed**: the patched target test and the full suite have passed.

After a successful repair, use **Simulate selector regression** again to start the next controlled cycle. **Reset sandbox** is for recovery before approval or after a failed repair; it is deliberately unavailable after a successful repair.

## Commands

Run these from `code/`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dashboard and Express API. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript strict-mode checking. |
| `npm run test:unit` | Run the Vitest unit and API tests. |
| `npm run test:e2e` | Run the Playwright browser suite. |
| `npm run test:mutation` | Verify that the controlled mutation causes exactly the `@repair-target` test to fail, then restores the prior state. |
| `npm run build` | Type-check and create a production frontend build. |

Run the complete quality gate before a demo or submission:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

## Safety model

The scope is intentionally narrow:

- The browser can mutate only the bundled login button ID; it cannot send file paths, shell commands, or arbitrary source changes.
- Qwen credentials stay server-side. The browser never receives API keys, base URLs, or raw provider errors.
- A proposal is data, not code. It must pass schema validation and the locator-only patch policy.
- No test file changes before explicit approval.
- Failed target or full-suite verification restores the pre-patch test file.

Repair Console is a local sandbox demonstration, not a hosted service for arbitrary repositories, CI providers, or general-purpose autonomous test healing.

## Architecture

```text
React/Vite dashboard
  -> Express repair API and SSE status updates
  -> Playwright failure capture and sanitized DOM context
  -> Qwen or recorded fixture proposal
  -> strict proposal validation and one-string patch policy
  -> explicit approval
  -> target-test verification -> full-suite verification
```

Key implementation areas:

- `code/src/RepairConsole.tsx` — browser workspace, provider selection, proposal review, and timeline.
- `code/src/repair-orchestrator.ts` — approval-gated repair lifecycle and restoration behavior.
- `code/src/qwen-proposal-provider.ts` — server-only Qwen JSON proposal provider.
- `code/src/sandbox-fixture.ts` — fixed, browser-triggered login-selector mutation boundary.
- `code/tests/` — Vitest unit/API coverage and Playwright browser coverage.

## How Codex and GPT-5.6 were used

Codex and GPT-5.6 accelerated the project from idea to verified demo:

- Refined the product from a broad “self-healing tests” concept into one constrained, reviewable locator-repair workflow.
- Produced the specification, dependency-ordered implementation plan, safety boundaries, and demo plan.
- Implemented the React/Express workflow incrementally with strict TypeScript, validation, and approval-gated patching.
- Created and iterated on unit, API, mutation, and browser tests.
- Reviewed the browser workflow, identified a sandbox baseline inconsistency, added its regression coverage, and verified the corrected end-to-end flow.
- Prepared the demo narrative and submission documentation.

The core product specification is in [docs/specs/self-healing-playwright-repair-console.md](docs/specs/self-healing-playwright-repair-console.md). The browser-operated sandbox extension and its safety boundary are documented in [docs/specs/browser-only-sandbox-repair-workflow.md](docs/specs/browser-only-sandbox-repair-workflow.md).

## Scope

**In scope:** one Playwright CSS selector repair, a server-only live proposal provider, a deterministic fallback, explicit approval, and local target/full-suite verification.

**Out of scope:** application-code repairs, multi-file patches, automatic approval, authentication, databases, hosted repository connections, CI integration, commits, and pull requests.
