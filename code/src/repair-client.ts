import type { ProposalMode, RepairEvent, RepairRun } from "./repair";

type ApiResponse<T> = { data: T };

export type SandboxStatus = {
  fixture: { state: "baseline" | "alternate" };
  providers: {
    defaultMode: ProposalMode;
    qwen: { available: boolean; message: string };
    fixture: { available: true };
  };
  canReset: boolean;
};

export type SandboxAction = Pick<SandboxStatus, "fixture">;

async function readData<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => undefined) as ApiResponse<T> | undefined;
  if (!response.ok || !body?.data) {
    throw new Error("The repair service could not complete this request.");
  }

  return body.data;
}

export async function getSandboxStatus() {
  return readData<SandboxStatus>(await fetch("/api/sandbox"));
}

export async function simulateRegression() {
  return readData<SandboxAction>(await fetch("/api/sandbox/simulate", { method: "POST" }));
}

export async function resetSandbox() {
  return readData<SandboxAction>(await fetch("/api/sandbox/reset", { method: "POST" }));
}

export async function startRepairRun(proposalMode: ProposalMode) {
  return readData<RepairRun>(await fetch("/api/repair-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposalMode }),
  }));
}

export async function approveRepairRun(runId: string) {
  return readData<RepairRun>(await fetch(`/api/repair-runs/${encodeURIComponent(runId)}/approval`, { method: "POST" }));
}

export function subscribeToRepairRun(runId: string, onUpdate: (event: RepairEvent) => void) {
  const source = new EventSource(`/api/repair-runs/${encodeURIComponent(runId)}/events`);
  let latestSequence = 0;

  source.addEventListener("repair-update", (message) => {
    try {
      const event = JSON.parse((message as MessageEvent<string>).data) as RepairEvent;
      if (event.sequence > latestSequence) {
        latestSequence = event.sequence;
        onUpdate(event);
      }
    } catch {
      // Ignore malformed event data; a later valid event or refresh can recover the UI.
    }
  });

  return () => source.close();
}
