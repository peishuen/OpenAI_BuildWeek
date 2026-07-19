import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approveRepairRun,
  startRepairRun,
  subscribeToRepairRun,
} from "../../src/repair-client";

const run = { id: "run-1", status: "awaitingApproval" as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("repair client", () => {
  it("starts and approves repair runs through the approval-gated API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: run }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...run, status: "completed" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(startRepairRun()).resolves.toEqual(run);
    await expect(approveRepairRun("run-1")).resolves.toEqual({ ...run, status: "completed" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/repair-runs", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/repair-runs/run-1/approval", { method: "POST" });
  });

  it("forwards only newer ordered SSE repair updates", () => {
    let listener: ((event: MessageEvent<string>) => void) | undefined;
    const close = vi.fn();
    vi.stubGlobal("EventSource", class {
      constructor() {
        // The production API uses a named SSE event.
      }
      addEventListener(_type: string, callback: (event: MessageEvent<string>) => void) {
        listener = callback;
      }
      close = close;
    });
    const received: string[] = [];

    const unsubscribe = subscribeToRepairRun("run-1", (event) => received.push(event.run.status));
    listener?.({ data: JSON.stringify({ sequence: 2, run: { ...run, status: "approved" } }) } as MessageEvent<string>);
    listener?.({ data: JSON.stringify({ sequence: 1, run }) } as MessageEvent<string>);

    expect(received).toEqual(["approved"]);
    unsubscribe();
    expect(close).toHaveBeenCalledOnce();
  });
});
