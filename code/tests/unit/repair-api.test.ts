import { once } from "node:events";
import { createServer } from "node:http";

import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import type { ProposalMode, RepairRun } from "../../src/repair";
import { RepairEventStore } from "../../src/repair-events";
import {
  apiErrorHandler,
  createRepairRouter,
  type ProviderAvailability,
  type RepairRunController,
  type SandboxController,
} from "../../src/repair-routes";
import type { SandboxFixtureResult, SandboxFixtureState } from "../../src/sandbox-fixture";

class FakeRepairRunController implements RepairRunController {
  private readonly runs = new Map<string, RepairRun>();
  private latestRun: RepairRun | undefined;
  readonly startedModes: ProposalMode[] = [];

  async start(proposalMode: ProposalMode) {
    const run: RepairRun = { id: "run-1", proposalMode, status: "awaitingApproval" };
    this.startedModes.push(proposalMode);
    this.runs.set(run.id, run);
    this.latestRun = run;
    return run;
  }

  getRun(runId: string) {
    return this.runs.get(runId);
  }

  getLatestRun() {
    return this.latestRun;
  }

  setLatestRun(status: RepairRun["status"]) {
    this.latestRun = { id: "run-1", proposalMode: "fixture", status };
  }

  async approve(runId: string) {
    const run = this.runs.get(runId);
    if (!run || run.status !== "awaitingApproval") return run;

    const completed = { ...run, status: "completed" as const };
    this.runs.set(runId, completed);
    this.latestRun = completed;
    return completed;
  }
}

class FakeSandboxController implements SandboxController {
  state: SandboxFixtureState = "baseline";
  simulateCalls = 0;
  resetCalls = 0;

  async getState(): Promise<SandboxFixtureResult> {
    return { ok: true, state: this.state };
  }

  async simulate(): Promise<SandboxFixtureResult> {
    this.simulateCalls += 1;
    this.state = this.state === "baseline" ? "alternate" : "baseline";
    return { ok: true, state: this.state };
  }

  async reset(): Promise<SandboxFixtureResult> {
    this.resetCalls += 1;
    this.state = "baseline";
    return { ok: true, state: this.state };
  }
}

const unavailableProviders: ProviderAvailability = {
  defaultMode: "fixture",
  qwen: {
    available: false,
    message: "Live Qwen is not configured. Use the offline fixture fallback.",
  },
  fixture: { available: true },
};

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.close();
    await once(server, "close");
  }));
});

async function createApi(options: {
  controller?: FakeRepairRunController;
  sandbox?: FakeSandboxController;
  providers?: ProviderAvailability;
} = {}) {
  const controller = options.controller ?? new FakeRepairRunController();
  const sandbox = options.sandbox ?? new FakeSandboxController();
  const events = new RepairEventStore();
  const app = express();
  app.use(express.json());
  app.use("/api", createRepairRouter(controller, events, sandbox, options.providers ?? unavailableProviders));
  app.use("/api", apiErrorHandler);

  const server = createServer(app);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP server address.");
  return { controller, sandbox, events, baseUrl: `http://127.0.0.1:${address.port}/api` };
}

describe("repair run API", () => {
  it("returns safe sandbox and provider status without environment secrets", async () => {
    const { baseUrl } = await createApi();

    const response = await fetch(`${baseUrl}/sandbox`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toEqual({
      data: {
        fixture: { state: "baseline" },
        providers: unavailableProviders,
        canReset: true,
      },
    });
    expect(body).not.toContain("QWEN_API_KEY");
    expect(body).not.toContain("https://");
  });

  it("toggles only the known sandbox regression so a completed repair can start the next cycle", async () => {
    const { baseUrl, controller, sandbox } = await createApi();

    const simulated = await fetch(`${baseUrl}/sandbox/simulate`, { method: "POST" });
    expect(simulated.status).toBe(200);
    await expect(simulated.json()).resolves.toEqual({ data: { fixture: { state: "alternate" } } });
    expect(sandbox.simulateCalls).toBe(1);

    controller.setLatestRun("completed");
    const nextCycle = await fetch(`${baseUrl}/sandbox/simulate`, { method: "POST" });
    expect(nextCycle.status).toBe(200);
    await expect(nextCycle.json()).resolves.toEqual({ data: { fixture: { state: "baseline" } } });
    expect(sandbox.simulateCalls).toBe(2);

    controller.setLatestRun("awaitingApproval");
    const blocked = await fetch(`${baseUrl}/sandbox/simulate`, { method: "POST" });
    expect(blocked.status).toBe(409);
    expect(sandbox.simulateCalls).toBe(2);
  });

  it("accepts only a validated proposal mode and preserves approval as a separate action", async () => {
    const { baseUrl, controller } = await createApi();

    const invalidMode = await fetch(`${baseUrl}/repair-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalMode: "unsupported" }),
    });
    expect(invalidMode.status).toBe(422);

    const extraInput = await fetch(`${baseUrl}/repair-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalMode: "fixture", path: "src/LoginPage.tsx" }),
    });
    expect(extraInput.status).toBe(422);
    expect(controller.startedModes).toEqual([]);

    const started = await fetch(`${baseUrl}/repair-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalMode: "fixture" }),
    });
    expect(started.status).toBe(201);
    await expect(started.json()).resolves.toEqual({
      data: { id: "run-1", proposalMode: "fixture", status: "awaitingApproval" },
    });
    expect(controller.startedModes).toEqual(["fixture"]);

    const approved = await fetch(`${baseUrl}/repair-runs/run-1/approval`, { method: "POST" });
    await expect(approved.json()).resolves.toEqual({
      data: { id: "run-1", proposalMode: "fixture", status: "completed" },
    });
  });

  it("uses the safe server default when the existing client omits a provider mode", async () => {
    const { baseUrl, controller } = await createApi();

    const started = await fetch(`${baseUrl}/repair-runs`, { method: "POST" });

    expect(started.status).toBe(201);
    expect(controller.startedModes).toEqual(["fixture"]);
  });

  it("rejects an unavailable Qwen request without starting a fallback run", async () => {
    const { baseUrl, controller } = await createApi();

    const response = await fetch(`${baseUrl}/repair-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalMode: "qwen" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "QWEN_UNAVAILABLE",
        message: "Live Qwen is not configured. Use the offline fixture fallback.",
      },
    });
    expect(controller.startedModes).toEqual([]);
  });

  it("resets only before approval or after a failed repair", async () => {
    const { baseUrl, controller, sandbox } = await createApi();
    sandbox.state = "alternate";
    controller.setLatestRun("awaitingApproval");

    const reset = await fetch(`${baseUrl}/sandbox/reset`, { method: "POST" });
    expect(reset.status).toBe(200);
    await expect(reset.json()).resolves.toEqual({ data: { fixture: { state: "baseline" } } });
    expect(sandbox.resetCalls).toBe(1);

    sandbox.state = "alternate";
    controller.setLatestRun("failed");
    const failedReset = await fetch(`${baseUrl}/sandbox/reset`, { method: "POST" });
    expect(failedReset.status).toBe(200);
    expect(sandbox.resetCalls).toBe(2);

    sandbox.state = "alternate";
    controller.setLatestRun("completed");
    const completedReset = await fetch(`${baseUrl}/sandbox/reset`, { method: "POST" });
    expect(completedReset.status).toBe(409);
    await expect(completedReset.json()).resolves.toEqual({
      error: {
        code: "RESET_NOT_ALLOWED",
        message: "Reset is unavailable after a completed repair.",
      },
    });
    expect(sandbox.resetCalls).toBe(2);
  });

  it("returns safe errors for unknown repair runs", async () => {
    const { baseUrl } = await createApi();

    const response = await fetch(`${baseUrl}/repair-runs/missing`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "RUN_NOT_FOUND", message: "Repair run was not found." },
    });
  });

  it("hides unexpected internal errors from API clients", async () => {
    const controller: RepairRunController = {
      start: async () => { throw new Error("QWEN_API_KEY=not-for-the-browser"); },
      getRun: () => undefined,
      getLatestRun: () => undefined,
      approve: async () => undefined,
    };
    const sandbox = new FakeSandboxController();
    const events = new RepairEventStore();
    const app = express();
    app.use(express.json());
    app.use("/api", createRepairRouter(controller, events, sandbox, unavailableProviders));
    app.use("/api", apiErrorHandler);
    const server = createServer(app);
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP server address.");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/repair-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalMode: "fixture" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "REPAIR_API_ERROR",
        message: "The repair service could not complete this request.",
      },
    });
  });

  it("replays repair progress through the SSE endpoint", async () => {
    const { baseUrl, controller, events } = await createApi();
    const run = await controller.start("fixture");
    events.publish(run);

    const response = await fetch(`${baseUrl}/repair-runs/run-1/events`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Expected an SSE response body.");

    const firstChunk = await reader.read();
    await reader.cancel();

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(new TextDecoder().decode(firstChunk.value)).toContain('"status":"awaitingApproval"');
  });
});
