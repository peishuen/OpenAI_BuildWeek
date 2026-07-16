# Self-Healing Playwright Repair Console

## Problem Statement

How might we help frontend developers and QA automation engineers recover from a simple Playwright locator regression in seconds, with clear evidence and an explicit approval step, without running costly AI agents across every CI test?

## Recommended Direction

Build a local **Repair Console** backed by a small repair engine. When one Playwright test fails because a single locator no longer matches, the engine captures the failing locator, error, source location, and a sanitized DOM snapshot. It sends this focused context to an LLM, which returns one minimal selector repair with a short evidence-based diagnosis.

The dashboard makes the workflow legible: it shows the failure, the proposed patch, and why the replacement is credible. The developer explicitly selects **Approve & rerun** before the patch is written. The repair engine then reruns the affected test for immediate feedback and runs the complete 3–5 test demo suite to show that the approved repair restores suite health.

This direction has the strongest balance of user value, feasibility, and differentiation for a seven-day hackathon. It turns a familiar maintenance chore into an observable, reviewable automation loop while avoiding the unreliable scope of general-purpose browser agents.

## Key Assumptions to Validate

- [ ] A sanitized DOM snapshot, failure error, and test source are sufficient to identify a correct replacement locator for controlled single-locator failures. Validate with at least two intentional mutations (for example, an ID change and a label/data-attribute change).
- [ ] Developers trust a proposed patch when it contains a concise diagnosis, exact diff, and explicit approval step. Validate by ensuring the dashboard exposes all three before any write occurs.
- [ ] The full demo suite remains fast enough to run live after approval. Validate by keeping 3–5 tests deterministic and under an agreed time budget.
- [ ] The LLM response can be constrained to a minimal structured repair rather than arbitrary code. Validate with schema validation and a reject-on-invalid-response path.

## MVP Scope

### In

- A deliberately small local demo web application, including a login form.
- A deterministic 3–5 test Playwright suite with one intentionally broken selector.
- Failure capture: failed locator, error excerpt, source file/line, and sanitized DOM snapshot.
- An LLM-backed proposal for one locator-only repair.
- A dashboard with failure, diagnosis/evidence, before/after diff, and **Approve & rerun** control.
- Approval-gated file write, targeted test rerun, followed by a full demo-suite rerun.
- Clear pass/fail status and an audit timeline for the repair attempt.

### Out

- Repairing changed business workflows, multi-step journeys, assertions, or application code.
- Network timing, flaky-test, authentication, and test-data remediation.
- Running visual/computer-use agents during normal test execution.
- Automatic application of patches, automatic commits, pull requests, and hosted CI integration.
- Support for arbitrary repositories or production-scale test suites.

## Not Doing (and Why)

- **Generic self-healing claims** — the MVP is limited to single-locator regressions so its promise is credible and testable.
- **Streaming private model reasoning** — concise evidence is more trustworthy, safer, and clearer than a simulated chain-of-thought display.
- **Complex collaboration features** — a one-click developer approval is enough to demonstrate control without derailing the repair loop.
- **Full CI integration** — a local deterministic demo proves the value first; CI wiring is a follow-on integration concern.

## Open Questions

- Which frontend and backend framework gives the fastest, most reliable local dashboard and demo application for the team?
- What structured response format and model/API will the repair engine use?
- What latency budget should the demo enforce for targeted verification and the full demo suite?
