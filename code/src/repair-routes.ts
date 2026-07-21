import { Router, type ErrorRequestHandler, type Response } from "express";
import { z } from "zod";

import type { PublicProviderAvailability } from "./env";
import { ProposalModeSchema, type ProposalMode, type RepairRun } from "./repair";
import type { RepairEventStore } from "./repair-events";
import type { SandboxFixtureResult } from "./sandbox-fixture";

export type ProviderAvailability = PublicProviderAvailability;

export type SandboxController = {
  getState(): Promise<SandboxFixtureResult>;
  simulate(): Promise<SandboxFixtureResult>;
  reset(): Promise<SandboxFixtureResult>;
};

export type RepairRunController = {
  start(proposalMode?: ProposalMode): Promise<RepairRun>;
  getRun(runId: string): Readonly<RepairRun> | undefined;
  getLatestRun(): Readonly<RepairRun> | undefined;
  approve(runId: string): Promise<RepairRun | undefined>;
};

const StartRepairRunSchema = z.object({ proposalMode: ProposalModeSchema.optional() }).strict();

function resetAvailability(run: Readonly<RepairRun> | undefined) {
  if (!run || run.status === "awaitingApproval" || run.status === "failed") {
    return { canReset: true };
  }

  if (run.status === "completed") {
    return { canReset: false, message: "Reset is unavailable after a completed repair." };
  }

  return { canReset: false, message: "Reset is unavailable while a repair is in progress." };
}

function simulationAvailability(run: Readonly<RepairRun> | undefined) {
  if (!run || run.status === "completed" || run.status === "failed") {
    return { canSimulate: true };
  }

  return { canSimulate: false, message: "Simulation is unavailable while a repair is in progress or awaiting approval." };
}

function sendSandboxFailure(response: Response) {
  response.status(409).json({
    error: {
      code: "SANDBOX_UNAVAILABLE",
      message: "The sandbox fixture is not in a recoverable state.",
    },
  });
}

// Return one generic response when an unexpected API error reaches Express
export const apiErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  response.status(500).json({
    error: {
      code: "REPAIR_API_ERROR",
      message: "The repair service could not complete this request.",
    },
  });
};

export function createRepairRouter(
  controller: RepairRunController,
  events: RepairEventStore,
  sandbox: SandboxController,
  providers: ProviderAvailability,
) {
  const router = Router();

  router.get("/sandbox", async (_request, response) => {
    const fixture = await sandbox.getState();
    if (!fixture.ok) {
      sendSandboxFailure(response);
      return;
    }

    const reset = resetAvailability(controller.getLatestRun());
    response.json({
      data: {
        fixture: { state: fixture.state },
        providers,
        canReset: reset.canReset,
      },
    });
  });

  router.post("/sandbox/simulate", async (_request, response) => {
    const simulation = simulationAvailability(controller.getLatestRun());
    if (!simulation.canSimulate) {
      response.status(409).json({
        error: {
          code: "SIMULATION_NOT_ALLOWED",
          message: simulation.message,
        },
      });
      return;
    }

    const result = await sandbox.simulate();
    if (!result.ok) {
      sendSandboxFailure(response);
      return;
    }

    response.json({ data: { fixture: { state: result.state } } });
  });

  router.post("/sandbox/reset", async (_request, response) => {
    const reset = resetAvailability(controller.getLatestRun());
    if (!reset.canReset) {
      response.status(409).json({
        error: {
          code: "RESET_NOT_ALLOWED",
          message: reset.message,
        },
      });
      return;
    }

    const result = await sandbox.reset();
    if (!result.ok) {
      sendSandboxFailure(response);
      return;
    }

    response.json({ data: { fixture: { state: result.state } } });
  });

  // Start a repair run without approving or patching it.
  router.post("/repair-runs", async (request, response) => {
    const parsed = StartRepairRunSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(422).json({
        error: {
          code: "INVALID_PROPOSAL_MODE",
          message: "Choose Live Qwen or the offline fixture fallback.",
        },
      });
      return;
    }

    const proposalMode = parsed.data.proposalMode ?? providers.defaultMode;
    if (proposalMode === "qwen" && !providers.qwen.available) {
      response.status(409).json({
        error: {
          code: "QWEN_UNAVAILABLE",
          message: providers.qwen.message,
        },
      });
      return;
    }

    const run = await controller.start(proposalMode);
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
