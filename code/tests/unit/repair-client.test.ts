import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approveRepairRun,
  getSandboxStatus,
  resetSandbox,
  simulateRegression,
  startRepairRun,
  subscribeToRepairRun,
} from "../../src/repair-client";

const run = { id: "run-1", proposalMode: "fixture" as const, status: "awaitingApproval" as const };
const sandbox = {
  fixture: { state: "baseline" as const },
  providers: {
    defaultMode: "fixture" as const,
    qwen: { available: false, message: "Qwen is unavailable." },
    fixture: { available: true as const },
  },
  canReset: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("repair client", () => {
  it("starts and approves repair runs through the approval-gated API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: run }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...run, status: "completed" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(startRepairRun("fixture")).resolves.toEqual(run);
    await expect(approveRepairRun("run-1")).resolves.toEqual({ ...run, status: "completed" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/repair-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalMode: "fixture" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/repair-runs/run-1/approval", { method: "POST" });
  });

  it("gets the safe sandbox status and controls only its fixed endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: sandbox }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { fixture: { state: "alternate" } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { fixture: { state: "baseline" } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSandboxStatus()).resolves.toEqual(sandbox);
    await expect(simulateRegression()).resolves.toEqual({ fixture: { state: "alternate" } });
    await expect(resetSandbox()).resolves.toEqual({ fixture: { state: "baseline" } });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/sandbox");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/sandbox/simulate", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/sandbox/reset", { method: "POST" });
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
