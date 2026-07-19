import { useState } from "react";

const staticRepairRun = {
  status: "awaitingApproval" as const,
  failure: {
    selector: "#sign-in-button",
    sourcePath: "tests/e2e/login.spec.ts",
    sourceLine: 43,
    errorExcerpt: "Locator could not find the sign-in button before the test timed out.",
    domSnapshot: '<button id="sign-in-button-v2">Sign in</button>',
  },
  proposal: {
    replacementSelector: "#sign-in-button-v2",
    diagnosis: "The sign-in button ID changed while its visible label stayed the same.",
    evidence: [
      "The sanitized DOM contains a button with id=\"sign-in-button-v2\".",
      "The button still has the visible text “Sign in”.",
    ],
  },
};

const timelineSteps = [
  ["Failure captured", "complete"],
  ["Proposal ready", "complete"],
  ["Awaiting approval", "active"],
  ["Patch applied", "pending"],
  ["Target test verified", "pending"],
  ["Full suite verified", "pending"],
] as const;

export default function RepairConsole() {
  const [notice, setNotice] = useState("");
  const isAwaitingApproval = staticRepairRun.status === "awaitingApproval";

  function showStaticPreviewNotice() {
    setNotice("This static preview will connect to the approval API in Task 10.");
  }

  return (
    <section className="repair-console" aria-labelledby="repair-console-title">
      <header className="repair-console-header">
        <div>
          <p className="eyebrow">Playwright repair review</p>
          <h1 id="repair-console-title">Repair Console</h1>
          <p className="console-intro">Review one safe selector change before modifying a test file.</p>
        </div>
        <p className="status-badge" aria-label="Repair status: awaiting approval">
          <span aria-hidden="true">●</span> Awaiting approval
        </p>
      </header>

      <div className="repair-panel-grid">
        <section className="repair-panel" aria-labelledby="failure-title">
          <p className="panel-kicker">01</p>
          <h2 id="failure-title">Failure</h2>
          <dl className="detail-list">
            <div>
              <dt>Failed selector</dt>
              <dd><code>{staticRepairRun.failure.selector}</code></dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd><code>{staticRepairRun.failure.sourcePath}:{staticRepairRun.failure.sourceLine}</code></dd>
            </div>
            <div>
              <dt>Error</dt>
              <dd>{staticRepairRun.failure.errorExcerpt}</dd>
            </div>
          </dl>
        </section>

        <section className="repair-panel" aria-labelledby="diagnosis-title">
          <p className="panel-kicker">02</p>
          <h2 id="diagnosis-title">Diagnosis</h2>
          <p className="diagnosis-copy">{staticRepairRun.proposal.diagnosis}</p>
          <h3>Evidence</h3>
          <ul className="evidence-list">
            {staticRepairRun.proposal.evidence.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <h3>Sanitized DOM</h3>
          <pre className="dom-preview"><code>{staticRepairRun.failure.domSnapshot}</code></pre>
        </section>

        <section className="repair-panel repair-panel-action" aria-labelledby="repair-title">
          <p className="panel-kicker">03</p>
          <h2 id="repair-title">Proposed repair</h2>
          <p className="diff-label">One selector literal in the test file</p>
          <pre className="selector-diff" aria-label="Selector change from sign-in-button to sign-in-button-v2"><code>
            <span className="diff-remove">− {staticRepairRun.failure.selector}</span>
            <span className="diff-add">+ {staticRepairRun.proposal.replacementSelector}</span>
          </code></pre>
          <button
            className="approval-button"
            type="button"
            disabled={!isAwaitingApproval}
            onClick={showStaticPreviewNotice}
          >
            Approve &amp; rerun
          </button>
          <p className="approval-hint">No file has changed. Approval is required before patching.</p>
          <p className="static-notice" role="status" aria-live="polite">{notice}</p>
        </section>
      </div>

      <section className="repair-timeline" aria-labelledby="timeline-title">
        <div>
          <p className="panel-kicker">Repair progress</p>
          <h2 id="timeline-title">Verification timeline</h2>
        </div>
        <ol>
          {timelineSteps.map(([label, state]) => (
            <li key={label} className={`timeline-${state}`}>
              <span aria-hidden="true">{state === "complete" ? "✓" : state === "active" ? "●" : "○"}</span>
              {label}
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
