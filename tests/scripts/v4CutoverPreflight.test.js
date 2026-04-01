import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  buildCutoverPreflightPlan,
  buildCutoverPreflightReport,
  DEFAULT_CUTOVER_PREFLIGHT_OUT_DIR,
  formatCutoverPreflightPlan,
  parseCutoverPreflightArgs,
  runCutoverPreflightPlan,
  summarizeCutoverPreflightReport,
  toCutoverPreflightMarkdown,
  writeCutoverPreflightEvidence,
  executeCutoverPreflight,
} from "../../scripts/v4-cutover-preflight-core.mjs";

function createCommandRun(results) {
  const failedCount = results.filter((entry) => !entry.ok).length;
  return {
    total: results.length,
    executedCount: results.length,
    failedCount,
    passedCount: results.length - failedCount,
    allPassed: failedCount === 0,
    results,
  };
}

function createRehearsalReport({
  currentStage = "module-parity",
  readinessState = "ready",
  rolloutReadinessState = "ready",
  failedChecks = [],
  blockers = [],
  baseUrl = "http://127.0.0.1:5000",
} = {}) {
  return {
    metadata: {
      baseUrl,
    },
    assessment: {
      status: blockers.length > 0 || failedChecks.length > 0 ? "fail" : "pass",
      currentStage,
      healthReadinessState: readinessState,
      rolloutReadinessState,
      failedChecks,
      blockers,
    },
  };
}

describe("v4 cutover preflight helpers", () => {
  it("parses default arguments", () => {
    const parsed = parseCutoverPreflightArgs([]);
    expect(parsed).toMatchObject({
      baseUrl: "http://127.0.0.1:5000",
      outDir: DEFAULT_CUTOVER_PREFLIGHT_OUT_DIR,
      label: "manual",
      expectedStage: "module-parity",
      timeoutMs: 15_000,
      dryRun: false,
      allowFailedGates: false,
      continueOnError: false,
      discoverBaseUrl: false,
      withUatSmoke: false,
    });
    expect(parsed.baseUrlCandidates.length).toBeGreaterThan(0);
    expect(parsed.baseUrlCandidates).toContain("http://127.0.0.1:5050");
  });

  it("parses custom arguments and booleans", () => {
    expect(
      parseCutoverPreflightArgs([
        "--base-url",
        "https://staging.example.local/",
        "--base-url-candidates",
        "http://127.0.0.1:5151,http://127.0.0.1:5100",
        "--out-dir",
        "tmp/cutover",
        "--label",
        "staging preflight",
        "--expected-stage",
        "cutover-ready",
        "--timeout-ms",
        "24000",
        "--discover-base-url",
        "--with-uat-smoke",
        "--dry-run",
        "--allow-failed-gates",
        "--continue-on-error",
      ]),
    ).toEqual({
      baseUrl: "https://staging.example.local",
      baseUrlCandidates: ["http://127.0.0.1:5151", "http://127.0.0.1:5100"],
      outDir: "tmp/cutover",
      label: "staging preflight",
      expectedStage: "cutover-ready",
      timeoutMs: 24_000,
      dryRun: true,
      allowFailedGates: true,
      continueOnError: true,
      discoverBaseUrl: true,
      withUatSmoke: true,
    });
  });

  it("rejects invalid arguments", () => {
    expect(() => parseCutoverPreflightArgs(["--timeout-ms", "0"])).toThrow(/timeout/i);
    expect(() => parseCutoverPreflightArgs(["--base-url-candidates", ""])).toThrow(
      /base-url-candidates/i,
    );
    expect(() => parseCutoverPreflightArgs(["--unknown"])).toThrow(/khong ho tro/i);
  });

  it("builds default plan without optional UAT smoke", () => {
    const plan = buildCutoverPreflightPlan();
    expect(plan.some((entry) => entry.id === "uat-smoke")).toBe(false);
  });

  it("builds plan with UAT smoke when enabled", () => {
    const plan = buildCutoverPreflightPlan({ withUatSmoke: true });
    expect(plan.some((entry) => entry.id === "uat-smoke")).toBe(true);
  });

  it("formats command plan for dry-run output", () => {
    const plan = buildCutoverPreflightPlan({ withUatSmoke: true }).slice(0, 2);
    const summary = formatCutoverPreflightPlan(plan);
    expect(summary).toContain("1. [");
    expect(summary).toContain("2. [");
    expect(summary).toContain(plan[0].command);
  });

  it("runs commands fail-fast by default", () => {
    const plan = [
      { id: "a", label: "A", command: "cmd-a" },
      { id: "b", label: "B", command: "cmd-b" },
      { id: "c", label: "C", command: "cmd-c" },
    ];
    const execCommand = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 0 });

    const outcome = runCutoverPreflightPlan(plan, { execCommand });
    expect(outcome.executedCount).toBe(2);
    expect(outcome.failedCount).toBe(1);
    expect(outcome.passedCount).toBe(1);
    expect(execCommand).toHaveBeenCalledTimes(2);
  });

  it("continues execution when continue-on-error is enabled", () => {
    const plan = [
      { id: "a", label: "A", command: "cmd-a" },
      { id: "b", label: "B", command: "cmd-b" },
      { id: "c", label: "C", command: "cmd-c" },
    ];
    const execCommand = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 2 })
      .mockReturnValueOnce({ status: 0 });

    const outcome = runCutoverPreflightPlan(plan, {
      execCommand,
      continueOnError: true,
    });
    expect(outcome.executedCount).toBe(3);
    expect(outcome.failedCount).toBe(1);
    expect(outcome.passedCount).toBe(2);
    expect(execCommand).toHaveBeenCalledTimes(3);
  });

  it("builds fail report when command or stage gate fails", () => {
    const report = buildCutoverPreflightReport({
      label: "nightly",
      expectedStage: "cutover-ready",
      commandRun: createCommandRun([
        {
          id: "api-contract-gate",
          label: "api gate",
          command: "pnpm run api:contract:gate",
          status: 1,
          ok: false,
        },
      ]),
      rehearsalReport: createRehearsalReport({
        currentStage: "module-parity",
        blockers: ["rollout gate blocked"],
      }),
      capturedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("fail");
    expect(report.blockers.join(" ")).toMatch(/Command failed/i);
    expect(report.blockers.join(" ")).toMatch(/mismatch/i);
    expect(report.checklist.some((entry) => entry.id === "stage-matches-expected")).toBe(true);
  });

  it("builds pass report when all gates are green", () => {
    const report = buildCutoverPreflightReport({
      label: "staging",
      expectedStage: "module-parity",
      commandRun: createCommandRun([
        {
          id: "api-contract-gate",
          label: "api gate",
          command: "pnpm run api:contract:gate",
          status: 0,
          ok: true,
        },
      ]),
      rehearsalReport: createRehearsalReport(),
      capturedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("pass");
    expect(report.blockers).toEqual([]);
    expect(report.checklist.every((entry) => entry.ok)).toBe(true);
  });

  it("summarizes and renders markdown", () => {
    const report = buildCutoverPreflightReport({
      label: "staging",
      expectedStage: "module-parity",
      commandRun: createCommandRun([
        {
          id: "parity-suite",
          label: "parity",
          command: "pnpm run verify:v4:parity",
          status: 0,
          ok: true,
        },
      ]),
      rehearsalReport: createRehearsalReport(),
      capturedAt: "2026-04-01T00:00:00.000Z",
    });

    const summary = summarizeCutoverPreflightReport(report);
    const markdown = toCutoverPreflightMarkdown(report);

    expect(summary).toContain("status=pass");
    expect(summary).toContain("PASS [parity-suite]");
    expect(markdown).toContain("# V4 Cutover Preflight Evidence");
    expect(markdown).toContain("## Checklist");
  });

  it("writes json and markdown evidence files", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "v4-cutover-"));
    const report = buildCutoverPreflightReport({
      label: "nightly",
      expectedStage: "module-parity",
      commandRun: createCommandRun([
        {
          id: "parity-suite",
          label: "parity",
          command: "pnpm run verify:v4:parity",
          status: 0,
          ok: true,
        },
      ]),
      rehearsalReport: createRehearsalReport(),
      capturedAt: "2026-04-01T00:00:00.000Z",
    });

    const output = await writeCutoverPreflightEvidence(report, { outDir });
    const jsonContents = await readFile(output.jsonPath, "utf8");
    const markdownContents = await readFile(output.markdownPath, "utf8");

    expect(output.jsonPath).toContain("cutover-preflight.json");
    expect(output.markdownPath).toContain("cutover-preflight.md");
    expect(jsonContents).toContain('"label": "nightly"');
    expect(markdownContents).toContain("# V4 Cutover Preflight Evidence");
  });

  it("executes preflight workflow with injected fetch", async () => {
    const plan = [{ id: "parity", label: "Parity", command: "pnpm run verify:v4:parity" }];
    const runPlan = vi.fn(() =>
      createCommandRun([
        {
          id: "parity",
          label: "Parity",
          command: "pnpm run verify:v4:parity",
          status: 0,
          ok: true,
        },
      ]),
    );
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith("/api/v4/health")) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => "application/json",
          },
          json: async () => ({
            readiness: { state: "ready" },
            db: { state: "ready" },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: {
          get: () => "application/json",
        },
        json: async () => ({
          health: {
            readiness: { state: "ready" },
            dbFile: { state: "ready" },
          },
          rollout: { currentStage: "module-parity" },
          migrationVerification: { checks: [{ id: "check-1", status: "pass" }] },
        }),
      };
    });

    const report = await executeCutoverPreflight({
      plan,
      runPlan,
      rehearsalOptions: {
        baseUrl: "http://127.0.0.1:5000",
        timeoutMs: 2_000,
        label: "ci",
        expectedStage: "module-parity",
        fetchImpl,
      },
      reportOptions: {
        label: "ci",
        expectedStage: "module-parity",
        capturedAt: "2026-04-01T00:00:00.000Z",
      },
    });

    expect(runPlan).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(report.status).toBe("pass");
  });
});
