/*
  Run the Express backend for this project
*/
import "dotenv/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { readRepairEnvironment } from "./env";
import { FixtureProposalProvider, recordedFailureDomSnapshot } from "./fixture-proposal-provider";
import { OpenAiProposalProvider } from "./openai-proposal-provider";
import { RepairEventStore } from "./repair-events";
import { RepairOrchestrator } from "./repair-orchestrator";
import { apiErrorHandler, createRepairRouter, type RepairRunController } from "./repair-routes";
import { NodePlaywrightTestRunner } from "./playwright-test-runner";

// Return the service status for health checks
export function getHealthStatus() {
  return { ok: true };
}

export function createApp(controller: RepairRunController, events: RepairEventStore) {
  const app = express();
  app.use(express.json());

  // Respond to a simple health-check request.
  app.get("/api/health", (_request, response) => {
    response.json(getHealthStatus());
  });

  app.use("/api", createRepairRouter(controller, events));
  // Return safe API errors after every API route has had a chance to handle requests.
  app.use("/api", apiErrorHandler);
  return app;
}

const port = Number(process.env.PORT ?? 3001);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const events = new RepairEventStore();
const environment = readRepairEnvironment();
const proposalProvider = environment.REPAIR_PROPOSAL_PROVIDER === "openai"
  ? new OpenAiProposalProvider({ apiKey: environment.OPENAI_API_KEY, model: environment.OPENAI_MODEL })
  : new FixtureProposalProvider();
// Connect repair progress updates to the in-memory SSE event store.
const orchestrator = new RepairOrchestrator({
  projectRoot,
  runner: new NodePlaywrightTestRunner({ projectRoot }),
  proposalProvider,
  recordedDomSnapshot: recordedFailureDomSnapshot,
  onRunUpdate: (run) => events.publish(run),
});
export const app = createApp(orchestrator, events);

// Start the server outside the unit-test process
if (!process.env.VITEST) {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}
