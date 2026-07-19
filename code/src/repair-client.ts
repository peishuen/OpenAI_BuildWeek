import type { RepairEvent, RepairRun } from "./repair";

type ApiResponse = { data: RepairRun };

async function readRepairRun(response: Response): Promise<RepairRun> {
  const body = await response.json().catch(() => undefined) as ApiResponse | undefined;
  if (!response.ok || !body?.data) {
    throw new Error("The repair service could not complete this request.");
  }

  return body.data;
}

export async function startRepairRun() {
  return readRepairRun(await fetch("/api/repair-runs", { method: "POST" }));
}

export async function approveRepairRun(runId: string) {
  return readRepairRun(await fetch(`/api/repair-runs/${encodeURIComponent(runId)}/approval`, { method: "POST" }));
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
