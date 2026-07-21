# Task 12 Skill Activation Map

Use this document with [Task 12 in `todo.md`](todo.md#task-12-browser-only-sandbox-and-qwen-primary-rehearsal). Before editing code for a subtask, the implementation agent must read the listed `SKILL.md` files in the stated order and follow them. These are workflow instructions, not runtime dependencies; no package installation is required.

## Shared rules for every Task 12 subtask

1. Read [using-agent-skills](C:/Users/User/.agents/skills/using-agent-skills/SKILL.md) to re-evaluate applicability when the task starts.
2. Load only the approved spec section, task section, and affected source/tests with [context-engineering](C:/Users/User/.agents/skills/context-engineering/SKILL.md).
3. Make a thin, verified change with [incremental-implementation](C:/Users/User/.agents/skills/incremental-implementation/SKILL.md).
4. Run the subtask verification commands before marking it complete. Do not expand scope without updating the spec and task list.

## Task 12.1: Bounded sandbox-fixture mutation

1. [security-and-hardening](C:/Users/User/.agents/skills/security-and-hardening/SKILL.md) — establish the fixed-file, fixed-value, no-user-input mutation boundary before extracting the module.
2. [test-driven-development](C:/Users/User/.agents/skills/test-driven-development/SKILL.md) — add failing unit tests for baseline, alternate, and invalid source states before implementation.
3. [incremental-implementation](C:/Users/User/.agents/skills/incremental-implementation/SKILL.md) — extract the smallest shared module and then point the terminal wrapper at it.

## Task 12.2: Per-run provider choice

1. [api-and-interface-design](C:/Users/User/.agents/skills/api-and-interface-design/SKILL.md) — define the narrow `qwen | fixture` provider contract and safe run metadata before changing orchestration.
2. [doubt-driven-development](C:/Users/User/.agents/skills/doubt-driven-development/SKILL.md) — challenge whether per-run provider selection can bypass approval, patch policy, or restoration.
3. [test-driven-development](C:/Users/User/.agents/skills/test-driven-development/SKILL.md) — write orchestrator tests for provider isolation and unchanged safety transitions.
4. [security-and-hardening](C:/Users/User/.agents/skills/security-and-hardening/SKILL.md) — confirm provider metadata exposes no credentials or raw model output.

## Task 12.3: Sandbox and provider-aware API

1. [api-and-interface-design](C:/Users/User/.agents/skills/api-and-interface-design/SKILL.md) — specify request/response schemas, state conflicts, and error codes for simulation, reset, and provider-selected repair.
2. [security-and-hardening](C:/Users/User/.agents/skills/security-and-hardening/SKILL.md) — enforce allowlists, secret-free responses, fixed mutation targets, and state-gated reset.
3. [test-driven-development](C:/Users/User/.agents/skills/test-driven-development/SKILL.md) — write API and environment tests before route/server changes.
4. [incremental-implementation](C:/Users/User/.agents/skills/incremental-implementation/SKILL.md) — deliver the endpoint contract in small vertical slices.

## Task 12.4: Browser-only customer journey

1. [frontend-ui-engineering](C:/Users/User/.agents/skills/frontend-ui-engineering/SKILL.md) — create accessible, clearly labelled sandbox, provider, simulation, and recovery controls.
2. [test-driven-development](C:/Users/User/.agents/skills/test-driven-development/SKILL.md) — cover new pure client/status logic before wiring interactions.
3. [incremental-implementation](C:/Users/User/.agents/skills/incremental-implementation/SKILL.md) — connect one browser workflow slice at a time without altering repair policy.
4. [browser-testing-with-devtools](C:/Users/User/.agents/skills/browser-testing-with-devtools/SKILL.md) — verify the rendered controls, disabled states, and full customer journey in a real browser.

## Task 12.5: Rehearsal, documentation, and final gate

1. [documentation-and-adrs](C:/Users/User/.agents/skills/documentation-and-adrs/SKILL.md) — document the customer journey, live-Qwen setup, fixture fallback, and recovery behavior as decisions, not just commands.
2. [browser-testing-with-devtools](C:/Users/User/.agents/skills/browser-testing-with-devtools/SKILL.md) — perform and record live-Qwen and fixture-fallback browser rehearsals.
3. [code-review-and-quality](C:/Users/User/.agents/skills/code-review-and-quality/SKILL.md) — review all Task 12 changes before calling the feature complete.
4. [code-simplification](C:/Users/User/.agents/skills/code-simplification/SKILL.md) — remove only unnecessary complexity identified by review, then rerun every required check.

## Completion rule

If a required skill is unavailable or conflicts with the approved spec, stop and report the conflict. Do not silently omit the skill or substitute a broader feature.
