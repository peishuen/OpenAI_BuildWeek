import { describe, expect, it } from "vitest";

import type { RepairRun } from "../../src/repair";
import { RepairEventStore } from "../../src/repair-events";

function createRun(status: RepairRun["status"]): RepairRun {
  // Return the smallest run object needed to create a progress event.
  return { id: "run-1", proposalMode: "fixture", status };
}

describe("RepairEventStore", () => {
  it("replays ordered events and forwards new events to a subscriber", () => {
    // Fix the clock so the event data stays deterministic.
    const events = new RepairEventStore(() => "2026-07-19T00:00:00.000Z");
    const received: string[] = [];

    // Save an event before connecting to represent an earlier repair update.
    events.publish(createRun("capturingFailure"));
    // Subscribe a pretend browser callback that collects sent event text.
    const unsubscribe = events.subscribe("run-1", (event) => received.push(event));
    // Publish another event while the pretend browser is connected.
    events.publish(createRun("awaitingApproval"));
    // Stop receiving updates before publishing one final event.
    unsubscribe();
    events.publish(createRun("approved"));

    expect(received).toHaveLength(2);
    expect(received.map((event) => JSON.parse(event).status)).toEqual([
      "capturingFailure",
      "awaitingApproval",
    ]);
    expect(received.map((event) => JSON.parse(event).sequence)).toEqual([1, 2]);
  });
});
