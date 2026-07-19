import { Router } from "express";

import type { RepairRun } from "./repair";
import type { RepairEventStore } from "./repair-events";

export type RepairRunController = {
  start(): Promise<RepairRun>;
  getRun(runId: string): Readonly<RepairRun> | undefined;
  approve(runId: string): Promise<RepairRun | undefined>;
};

export function createRepairRouter(controller: RepairRunController, events: RepairEventStore) {
  const router = Router();

  // Start a repair run without approving or patching it
  router.post("/repair-runs", async (_request, response) => {
    const run = await controller.start();
    response.status(201).json({ data: run });
  });

  // Return the current safe state for one repair run
  router.get("/repair-runs/:runId", (request, response) => {
    const run = controller.getRun(request.params.runId);
    if (!run) {
      response.status(404).json({
        error: { code: "RUN_NOT_FOUND", message: "Repair run was not found." },
      });
      return;
    }

    response.json({ data: run });
  });

  // Require an awaiting proposal before allowing approval to continue
  router.post("/repair-runs/:runId/approval", async (request, response) => {
    const currentRun = controller.getRun(request.params.runId);
    if (!currentRun) {
      response.status(404).json({
        error: { code: "RUN_NOT_FOUND", message: "Repair run was not found." },
      });
      return;
    }

    if (currentRun.status !== "awaitingApproval") {
      response.status(409).json({
        error: {
          code: "INVALID_RUN_STATE",
          message: "This repair run is not awaiting approval.",
        },
      });
      return;
    }

    const run = await controller.approve(currentRun.id);
    response.json({ data: run });
  });

  // Stream saved and future status updates to one connected browser.
  router.get("/repair-runs/:runId/events", (request, response) => {
    const run = controller.getRun(request.params.runId);
    if (!run) {
      response.status(404).json({
        error: { code: "RUN_NOT_FOUND", message: "Repair run was not found." },
      });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const unsubscribe = events.subscribe(run.id, (event) => {
      response.write("event: repair-update\n");
      response.write(`data: ${event}\n\n`);
    });
    request.once("close", unsubscribe);
  });

  return router;
}
