import { describe, expect, it } from "vitest";

import {
  API_ENTRYPOINT_MODES,
  resolveApiEntrypointMode,
  resolveBackendEntrypointPlan,
} from "../apps/api/src/backendEntrypointPlan.js";

describe("backend entrypoint plan", () => {
  it("defaults to the standalone server-v4 entrypoint", () => {
    const plan = resolveBackendEntrypointPlan({
      envMode: undefined,
      rootDir: "/workspace/kpi",
    });

    expect(plan.mode).toBe(API_ENTRYPOINT_MODES.serverV4);
    expect(plan.label).toBe("server-v4-standalone");
    expect(plan.rollbackMode).toBe(API_ENTRYPOINT_MODES.serverV4);
    expect(plan.entryFile).toMatch(/apps[\\/]api[\\/]src[\\/]cli\.js$/);
  });

  it("supports explicit server-v4 mode", () => {
    const plan = resolveBackendEntrypointPlan({
      envMode: "server-v4",
      rootDir: "/workspace/kpi",
    });

    expect(plan.mode).toBe(API_ENTRYPOINT_MODES.serverV4);
    expect(plan.label).toBe("server-v4-standalone");
    expect(plan.rollbackMode).toBe(API_ENTRYPOINT_MODES.serverV4);
    expect(plan.entryFile).toMatch(/apps[\\/]api[\\/]src[\\/]cli\.js$/);
  });

  it("keeps server-v4 when CLI flag and environment match", () => {
    expect(
      resolveApiEntrypointMode({
        envMode: "server-v4",
        flagMode: "server-v4",
      }),
    ).toBe("server-v4");
  });

  it("rejects invalid entrypoint modes", () => {
    expect(() =>
      resolveApiEntrypointMode({
        envMode: "canary",
      }),
    ).toThrow(/KPI_API_ENTRYPOINT_MODE/i);
  });

  it("rejects legacy rollback mode", () => {
    expect(() =>
      resolveApiEntrypointMode({
        envMode: "legacy",
      }),
    ).toThrow(/KPI_API_ENTRYPOINT_MODE/i);
  });
});
