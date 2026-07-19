import { once } from "node:events";
import { createServer } from "node:http";

import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import type { RepairRun } from "../../src/repair";
import { RepairEventStore } from "../../src/repair-events";
import { apiErrorHandler, createRepairRouter, type RepairRunController } from "../../src/repair-routes";

// Imitate the repair engine so API tests do not run Playwright
class FakeRepairRunController implements RepairRunController {
  private readonly runs = new Map<string, RepairRun>();

  async start() {
    // Create a proposal that must wait for a separate approval request
    const run: RepairRun = { id: "run-1", status: "awaitingApproval" };
    this.runs.set(run.id, run);
    return run;
  }

  getRun(runId: string) {
    return this.runs.get(runId);
  }

  async approve(runId: string) {
    // Change only an awaiting run to show what an approved repair returns
    const run = this.runs.get(runId);
    if (!run || run.status !== "awaitingApproval") return run;

    const completed = { ...run, status: "completed" as const };
    this.runs.set(runId, completed);
    return completed;
  }
}

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  // Close each temporary HTTP server after its test finishes
  await Promise.all(servers.splice(0).map(async (server) => {
    server.close();
    await once(server, "close");
  }));
});

async function createApi() {
  // Build an isolated Express API for one test
  const controller = new FakeRepairRunController();
  const events = new RepairEventStore();
  const app = express();
  app.use(express.json());
  app.use("/api", createRepairRouter(controller, events));
  app.use("/api", apiErrorHandler);

  const server = createServer(app);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  // Confirm the test server selected a TCP port before building its URL
  if (!address || typeof address === "string") throw new Error("Expected a TCP server address.");
  return { controller, events, baseUrl: `http://127.0.0.1:${address.port}/api` };
}

describe("repair run API", () => {
  it("starts a run and leaves approval as an explicit separate action", async () => {
    // Start the repair without sending an approval request
    const { baseUrl } = await createApi();

    const started = await fetch(`${baseUrl}/repair-runs`, { method: "POST" });

    expect(started.status).toBe(201);
    await expect(started.json()).resolves.toEqual({
      data: { id: "run-1", status: "awaitingApproval" },
    });

    const current = await fetch(`${baseUrl}/repair-runs/run-1`);
    await expect(current.json()).resolves.toEqual({
      data: { id: "run-1", status: "awaitingApproval" },
    });

    const approved = await fetch(`${baseUrl}/repair-runs/run-1/approval`, { method: "POST" });
    await expect(approved.json()).resolves.toEqual({
      data: { id: "run-1", status: "completed" },
    });
  });

  it("rejects approval for a run that is not awaiting approval", async () => {
    // Approve the run once before proving a repeated approval is blocked.
    const { baseUrl } = await createApi();
    await fetch(`${baseUrl}/repair-runs`, { method: "POST" });
    await fetch(`${baseUrl}/repair-runs/run-1/approval`, { method: "POST" });

    const repeatedApproval = await fetch(`${baseUrl}/repair-runs/run-1/approval`, { method: "POST" });

    expect(repeatedApproval.status).toBe(409);
    await expect(repeatedApproval.json()).resolves.toEqual({
      error: {
        code: "INVALID_RUN_STATE",
        message: "This repair run is not awaiting approval.",
      },
    });
  });

  it("returns safe errors for unknown repair runs", async () => {
    // Request a run ID that the controller never created.
    const { baseUrl } = await createApi();

    const response = await fetch(`${baseUrl}/repair-runs/missing`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "RUN_NOT_FOUND", message: "Repair run was not found." },
    });
  });

  it("hides unexpected internal errors from API clients", async () => {
    // Throw an error containing text that must never reach the browser
    const controller: RepairRunController = {
      start: async () => { throw new Error("OPENAI_API_KEY=not-for-the-browser"); },
      getRun: () => undefined,
      approve: async () => undefined,
    };
    const events = new RepairEventStore();
    const app = express();
    app.use("/api", createRepairRouter(controller, events));
    app.use("/api", apiErrorHandler);
    const server = createServer(app);
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP server address.");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/repair-runs`, { method: "POST" });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "REPAIR_API_ERROR",
        message: "The repair service could not complete this request.",
      },
    });
  });

  it("replays repair progress through the SSE endpoint", async () => {
    // Save an event before connecting to prove the endpoint replays history.
    const { baseUrl, controller, events } = await createApi();
    const run = await controller.start();
    events.publish(run);

    const response = await fetch(`${baseUrl}/repair-runs/run-1/events`);
    const reader = response.body?.getReader();
    // Stop if the HTTP response does not provide a readable event stream.
    if (!reader) throw new Error("Expected an SSE response body.");

    const firstChunk = await reader.read();
    await reader.cancel();

    // Check the stream type and its first replayed repair update.
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(new TextDecoder().decode(firstChunk.value)).toContain('"status":"awaitingApproval"');
  });
});
