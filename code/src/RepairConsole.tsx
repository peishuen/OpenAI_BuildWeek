import { useCallback, useEffect, useState } from "react";

import {
  approveRepairRun,
  getSandboxStatus,
  resetSandbox,
  simulateRegression,
  startRepairRun,
  subscribeToRepairRun,
  type SandboxStatus,
} from "./repair-client";
import {
  approvalHintFor,
  canResetSandbox,
  canSimulateRegression,
  canStartRepair,
} from "./repair-console-status";
import type { ProposalMode, RepairRun, RunStatus } from "./repair";

const timelineSteps: Array<[string, RunStatus]> = [
  ["Failure captured", "capturingFailure"],
  ["Proposal ready", "awaitingApproval"],
  ["Patch applied", "applyingPatch"],
  ["Target test verified", "verifyingTarget"],
  ["Full suite verified", "verifyingSuite"],
];

const statusLabels: Record<RunStatus, string> = {
  capturingFailure: "Capturing failure",
  awaitingApproval: "Awaiting approval",
  approved: "Approved",
  applyingPatch: "Applying patch",
  verifyingTarget: "Verifying target test",
  verifyingSuite: "Verifying full suite",
  completed: "Repair completed",
  failed: "Repair failed",
};

function timelineState(status: RunStatus | undefined, stepStatus: RunStatus) {
  if (!status) return "pending";
  if (status === "failed") return "pending";
  if (status === "completed") return "complete";
  const currentIndex = timelineSteps.findIndex(([, candidate]) => candidate === status);
  const stepIndex = timelineSteps.findIndex(([, candidate]) => candidate === stepStatus);
  return stepIndex < currentIndex ? "complete" : stepIndex === currentIndex ? "active" : "pending";
}

export default function RepairConsole() {
  const [run, setRun] = useState<RepairRun>();
  const [sandbox, setSandbox] = useState<SandboxStatus>();
  const [proposalMode, setProposalMode] = useState<ProposalMode>();
  const [requestError, setRequestError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSandboxSubmitting, setIsSandboxSubmitting] = useState(false);

  const refreshSandbox = useCallback(async () => {
    try {
      const status = await getSandboxStatus();
      setSandbox(status);
      setProposalMode((current) => current ?? status.providers.defaultMode);
    } catch {
      setRequestError("The sandbox status could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void refreshSandbox();
  }, [refreshSandbox]);

  useEffect(() => {
    if (!run?.id) return;
    return subscribeToRepairRun(run.id, (event) => {
      setRun(event.run);
      if (event.run.status === "awaitingApproval" || event.run.status === "failed" || event.run.status === "completed") {
        void refreshSandbox();
      }
    });
  }, [refreshSandbox, run?.id]);

  async function startRepair() {
    if (!proposalMode) return;
    setIsSubmitting(true);
    setRequestError("");
    try {
      setRun(await startRepairRun(proposalMode));
      await refreshSandbox();
    } catch {
      setRequestError("The repair service could not start a repair run.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function simulateSelectorRegression() {
    setIsSandboxSubmitting(true);
    setRequestError("");
    try {
      await simulateRegression();
      // A new mutation starts a new review cycle; completed or failed run details no longer describe this state.
      setRun(undefined);
      await refreshSandbox();
    } catch {
      setRequestError("The selector regression could not be simulated.");
    } finally {
      setIsSandboxSubmitting(false);
    }
  }

  async function resetSandboxWorkspace() {
    setIsSandboxSubmitting(true);
    setRequestError("");
    try {
      await resetSandbox();
      setRun(undefined);
      await refreshSandbox();
    } catch {
      setRequestError("The sandbox workspace could not be reset.");
    } finally {
      setIsSandboxSubmitting(false);
    }
  }

  async function approveRepair() {
    if (!run || run.status !== "awaitingApproval") return;

    setIsSubmitting(true);
    setRequestError("");
    try {
      setRun(await approveRepairRun(run.id));
    } catch {
      setRequestError("The repair service could not approve this repair run.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBusy = isSubmitting || isSandboxSubmitting;
  const canApprove = run?.status === "awaitingApproval" && !isBusy;
  const status = run?.status;
  const approvalHint = approvalHintFor(status);
  const canStart = proposalMode !== undefined
    && canStartRepair(proposalMode, sandbox?.providers.qwen.available ?? false, isBusy)
    && !run;
  const canSimulate = canSimulateRegression(sandbox?.fixture.state, isBusy, status);
  const canReset = canResetSandbox(sandbox?.canReset ?? false, isBusy);

  return (
    <section className="repair-console" aria-labelledby="repair-console-title">
      <header className="repair-console-header">
        <div>
          <p className="eyebrow">Playwright repair review</p>
          <h1 id="repair-console-title">Repair Console</h1>
          <p className="console-intro">Review one safe selector change before modifying a test file.</p>
        </div>
        <p className={`status-badge ${status === "failed" ? "status-failed" : ""}`} aria-label={`Repair status: ${status ? statusLabels[status] : "ready"}`}>
          <span aria-hidden="true">●</span> {status ? statusLabels[status] : "Ready to start"}
        </p>
      </header>

      <div className="repair-workspace">
        <div className="repair-panel-grid">
          <section className="repair-panel" aria-labelledby="failure-title">
          <p className="panel-kicker">01</p>
          <h2 id="failure-title">Failure</h2>
          {run?.failure ? (
            <dl className="detail-list">
              <div><dt>Failed selector</dt><dd><code>{run.failure.selector}</code></dd></div>
              <div><dt>Source</dt><dd><code>{run.failure.sourcePath}:{run.failure.sourceLine}</code></dd></div>
              <div><dt>Error</dt><dd className="error-excerpt">{run.failure.errorExcerpt}</dd></div>
            </dl>
          ) : <p className="empty-panel-copy">Start a repair run to capture the known failing test.</p>}
          </section>

          <section className="repair-panel" aria-labelledby="diagnosis-title">
          <p className="panel-kicker">02</p>
          <h2 id="diagnosis-title">Diagnosis</h2>
          {run?.proposal && run.failure ? (
            <>
              <p className="diagnosis-copy">{run.proposal.diagnosis}</p>
              <h3>Evidence</h3>
              <ul className="evidence-list"><li>{run.proposal.evidence}</li></ul>
              <h3>Sanitized DOM</h3>
              <pre className="dom-preview"><code>{run.failure.domSnapshot}</code></pre>
            </>
          ) : <p className="empty-panel-copy">A validated, evidence-backed proposal will appear here.</p>}
          </section>
        </div>

        <div className="repair-panel repair-panel-action">
          <section className="repair-action-section" aria-labelledby="sandbox-title">
          <p className="panel-kicker">03</p>
          <h2 id="sandbox-title">Sandbox workspace</h2>
          <p className="sandbox-state" role="status">Fixture state: <strong>{sandbox?.fixture.state === "alternate" ? "selector regression simulated" : sandbox ? "baseline" : "checkingâ€¦"}</strong></p>
          <fieldset className="provider-options">
            <legend>Proposal source</legend>
            <label htmlFor="proposal-mode-qwen">
              <input
                id="proposal-mode-qwen"
                type="radio"
                name="proposal-mode"
                value="qwen"
                checked={proposalMode === "qwen"}
                disabled={!sandbox?.providers.qwen.available || isBusy || Boolean(run)}
                onChange={() => setProposalMode("qwen")}
              />
              Live Qwen
            </label>
            <label htmlFor="proposal-mode-fixture">
              <input
                id="proposal-mode-fixture"
                type="radio"
                name="proposal-mode"
                value="fixture"
                checked={proposalMode === "fixture"}
                disabled={isBusy || Boolean(run)}
                onChange={() => setProposalMode("fixture")}
              />
              Offline fixture fallback
            </label>
          </fieldset>
          {!sandbox?.providers.qwen.available && sandbox && <p className="provider-note">Live Qwen is unavailable: {sandbox.providers.qwen.message}</p>}
          <div className="sandbox-actions">
            <button type="button" className="secondary-button" disabled={!canSimulate} onClick={simulateSelectorRegression}>
              {isSandboxSubmitting ? "Simulatingâ€¦" : "Simulate selector regression"}
            </button>
            <button type="button" className="secondary-button" disabled={!canReset} onClick={resetSandboxWorkspace}>
              {isSandboxSubmitting ? "Resettingâ€¦" : "Reset sandbox"}
            </button>
          </div>
          </section>
          <div className="action-divider" />
          <section className="repair-action-section" aria-labelledby="proposed-repair-title">
          <p className="panel-kicker">04</p>
          <h2 id="proposed-repair-title">Proposed repair</h2>
          {run?.failure && run.proposal ? (
            <>
              <p className="diff-label">One selector literal in the test file</p>
              <pre className="selector-diff" aria-label="Proposed selector change"><code>
                <span className="diff-remove">− {run.failure.selector}</span>
                <span className="diff-add">+ {run.proposal.replacementSelector}</span>
              </code></pre>
              <button className="approval-button" type="button" disabled={!canApprove} onClick={approveRepair}>
                {isSubmitting && run.status === "awaitingApproval" ? "Approving…" : "Approve & rerun"}
              </button>
              {approvalHint && <p className="approval-hint">{approvalHint}</p>}
            </>
          ) : (
            <>
              <p className="empty-panel-copy">The proposal remains read-only until you explicitly approve it.</p>
              <button className="approval-button" type="button" disabled={!canStart} onClick={startRepair}>
                {isSubmitting ? "Starting repair…" : "Start repair"}
              </button>
            </>
          )}
          {(requestError || run?.error) && <p className="static-notice repair-error" role="alert">{requestError || run?.error}</p>}
          </section>
        </div>
      </div>

      <section className="repair-timeline" aria-labelledby="timeline-title">
        <div>
          <p className="panel-kicker">Repair progress</p>
          <h2 id="timeline-title">Verification timeline</h2>
        </div>
        <ol>
          {timelineSteps.map(([label, stepStatus]) => {
            const state = timelineState(status, stepStatus);
            return <li key={label} className={`timeline-${state}`}><span aria-hidden="true">{state === "complete" ? "✓" : state === "active" ? "●" : "○"}</span>{label}</li>;
          })}
        </ol>
      </section>
    </section>
  );
}
