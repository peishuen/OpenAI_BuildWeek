/*
  Verify that the server health-status function returns the expected value
*/
import { once } from "node:events";
import { createServer } from "node:http";

import { describe, expect, it } from "vitest";
import type { RepairRun } from "../../src/repair";
import { RepairEventStore } from "../../src/repair-events";
import type { RepairRunController } from "../../src/repair-routes";
import { createApp, getHealthStatus } from "../../src/server";

describe("getHealthStatus", () => {
  it("returns an available service status", () => {
    expect(getHealthStatus()).toEqual({ ok: true });
  });

  it("returns a safe error when a real server route throws unexpectedly", async () => {
    // Create a controller that simulates an unexpected server-only failure
    const controller: RepairRunController = {
      start: async () => { throw new Error("QWEN_API_KEY=not-for-the-browser"); },
      getRun: (): Readonly<RepairRun> | undefined => undefined,
      approve: async () => undefined,
    };
    const server = createServer(createApp(controller, new RepairEventStore()));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP server address.");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/repair-runs`, { method: "POST" });

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "REPAIR_API_ERROR",
          message: "The repair service could not complete this request.",
        },
      });
    } finally {
      // Close the temporary server after checking its real middleware order
      server.close();
      await once(server, "close");
    }
  });
});
