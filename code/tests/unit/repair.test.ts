import { describe, it, expect } from 'vitest';
import {
  canApplyPatch,
  RepairProposalSchema,
  transitionRun,
  type RepairRun,
} from "../../src/repair";
import {
    createFailureContext,
    sanitizeDomSnapshot,
} from "../../src/failure-context";

/*
    Test the repair-run safety rules.
    Confirm that a patch cannot start until a user approves the proposal.
*/
describe("repair run state", () => {
    
    // confirm that the program blocks a patch before user approval
    it("does not allow a patch before approval", () => {

        // create a run that has a proposal but is still waiting for approval
        const run: RepairRun = {
            id: "run-1",
            proposalMode: "fixture",
            status: "awaitingApproval",
        };

        // confirm that patching is not allowed yet
        expect(canApplyPatch(run)).toBe(false);

        // confirm that skipping directly to patching causes an error
        expect(() => transitionRun(run, "applyingPatch")).toThrow(
            "Cannot move from awaitingApproval to applyingPatch.",
        );
    });

    // confirm that patching becomes allowed after user approval
    it("allows a patch after approval", () => {

        // start at the waiting-for-approval stage
        const waitingRun: RepairRun = {
            id: "run-1",
            proposalMode: "fixture",
            status: "awaitingApproval",
        };

        // move the run forward after a user approves it
        const approvedRun = transitionRun(waitingRun, "approved");

        // move the approved run into the patching stage
        const patchingRun = transitionRun(approvedRun, "applyingPatch");

        // confirm that the approval unlocks patching
        expect(canApplyPatch(approvedRun)).toBe(true);

        // confirm that the run reached the correct next stage
        expect(patchingRun.status).toBe("applyingPatch");
    });

    // confirm that a repair proposal cannot contain random extra data.
    it("rejects repair proposals with unexpected fields", () => {
        expect(() =>
        RepairProposalSchema.parse({
            replacementSelector: "#sign-in-button",
            diagnosis: "The button ID changed.",
            evidence: "The DOM shows the sign-in button.",
            unsafeExtraField: "Do not allow this.",
        }),
        ).toThrow();
    });

});

describe("failure context", () => {
    
    // create unsafe HTML similar to a browser snapshot
    const dirtyHtml = `
        <!-- Remove this comment. -->
        <section onclick="doSomething()">
        <script>stealData()</script>
        <style>button { display: none; }</style>
        <svg><path /></svg>
        <button id="sign-in-button-renamed" data-testid="sign-in">
            Sign in
        </button>
        </section>
    `;

    // confirm unsafe DOM content is removed but useful button information remains
    it("sanitizes a DOM snapshot", () => {
        const cleanHtml = sanitizeDomSnapshot(dirtyHtml);

        expect(cleanHtml).not.toContain("<script");
        expect(cleanHtml).not.toContain("<style");
        expect(cleanHtml).not.toContain("<svg");
        expect(cleanHtml).not.toContain("onclick");
        expect(cleanHtml).not.toContain("Remove this comment.");

        expect(cleanHtml).toContain("Sign in");
        expect(cleanHtml).toContain('id="sign-in-button-renamed"');
        expect(cleanHtml).toContain('data-testid="sign-in"');
    });
    
    // confirm very large snapshots always stop at the same maximum length
    it("truncates oversized snapshots deterministically", () => {
        const oversizedHtml = `<p>${"a".repeat(500)}</p>`;

        const firstResult = sanitizeDomSnapshot(oversizedHtml, 40);
        const secondResult = sanitizeDomSnapshot(oversizedHtml, 40);

        expect(firstResult).toHaveLength(40);
        expect(secondResult).toBe(firstResult);
    });

    // confirm raw failure data becomes validated and sanitized context
    it("creates safe failure context", () => {
        const context = createFailureContext({
            selector: "#sign-in-button",
            errorExcerpt: "Locator could not find the sign-in button.",
            sourcePath: "tests/login.spec.ts",
            sourceLine: 34,
            domSnapshot: dirtyHtml,
        });

        expect(context.selector).toBe("#sign-in-button");
        expect(context.domSnapshot).not.toContain("<script");
        expect(context.domSnapshot).toContain("Sign in");
    });
})
