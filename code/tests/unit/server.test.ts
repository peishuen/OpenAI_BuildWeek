/*
  Verify that the server health-status function returns the expected value.
*/
import { describe, expect, it } from "vitest";
import { getHealthStatus } from "../../src/server";

describe("getHealthStatus", () => {
  it("returns an available service status", () => {
    expect(getHealthStatus()).toEqual({ ok: true });
  });
});
