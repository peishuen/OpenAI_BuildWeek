/*
  Run the Express backend for this project
*/
import "dotenv/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { getPublicProviderAvailability, readRepairEnvironment } from "./env";
import { FixtureProposalProvider, recordedFailureDomSnapshot } from "./fixture-proposal-provider";
import { QwenProposalProvider } from "./qwen-proposal-provider";
import { RepairEventStore } from "./repair-events";
import { RepairOrchestrator } from "./repair-orchestrator";
import {
  apiErrorHandler,
  createRepairRouter,
  type ProviderAvailability,
  type RepairRunController,
  type SandboxController,
} from "./repair-routes";
import { getSandboxFixtureState, resetSandboxFixture, toggleSandboxFixture } from "./sandbox-fixture";
import { NodePlaywrightTestRunner } from "./playwright-test-runner";

// Return the service status for health checks
export function getHealthStatus() {
  return { ok: true };
}

export function createApp(
  controller: RepairRunController,
  events: RepairEventStore,
  sandbox: SandboxController,
  providers: ProviderAvailability,
) {
  const app = express();
  app.use(express.json());

  // Respond to a simple health-check request.
  app.get("/api/health", (_request, response) => {
    response.json(getHealthStatus());
  });

  app.use("/api", createRepairRouter(controller, events, sandbox, providers));
  // Return safe API errors after every API route has had a chance to handle requests.
  app.use("/api", apiErrorHandler);
  return app;
}

const port = Number(process.env.PORT ?? 3001);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const events = new RepairEventStore();
const environment = readRepairEnvironment();
const proposalProviders = {
  qwen: new QwenProposalProvider({
    apiKey: environment.QWEN_API_KEY,
    baseURL: environment.QWEN_BASE_URL,
    model: environment.QWEN_MODEL,
  }),
  fixture: new FixtureProposalProvider(),
};
const sandbox: SandboxController = {
  getState: getSandboxFixtureState,
  simulate: toggleSandboxFixture,
  reset: resetSandboxFixture,
};
// Connect repair progress updates to the in-memory SSE event store.
const orchestrator = new RepairOrchestrator({
  projectRoot,
  runner: new NodePlaywrightTestRunner({ projectRoot }),
  proposalProviders,
  defaultProposalMode: environment.REPAIR_PROPOSAL_PROVIDER,
  recordedDomSnapshot: recordedFailureDomSnapshot,
  onRunUpdate: (run) => events.publish(run),
});
export const app = createApp(orchestrator, events, sandbox, getPublicProviderAvailability(environment));

// Start the server outside the unit-test process
if (!process.env.VITEST) {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}
