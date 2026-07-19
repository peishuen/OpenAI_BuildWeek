/*
  Run the Express backend for this project
*/
import "dotenv/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { FixtureProposalProvider, recordedFailureDomSnapshot } from "./fixture-proposal-provider";
import { RepairEventStore } from "./repair-events";
import { RepairOrchestrator } from "./repair-orchestrator";
import { createRepairRouter } from "./repair-routes";
import { NodePlaywrightTestRunner } from "./playwright-test-runner";

// Return the service status for health checks
export function getHealthStatus() {
  return { ok: true };
}

export const app = express();
app.use(express.json());
const port = Number(process.env.PORT ?? 3001);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const events = new RepairEventStore();
// Connect repair progress updates to the in-memory SSE event store
const orchestrator = new RepairOrchestrator({
  projectRoot,
  runner: new NodePlaywrightTestRunner({ projectRoot }),
  proposalProvider: new FixtureProposalProvider(),
  recordedDomSnapshot: recordedFailureDomSnapshot,
  onRunUpdate: (run) => events.publish(run),
});

// Respond to a simple health-check request
app.get("/api/health", (_request, response) => {
  response.json(getHealthStatus());
});

app.use("/api", createRepairRouter(orchestrator, events));

// Start the server outside the unit-test process
if (!process.env.VITEST) {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}
