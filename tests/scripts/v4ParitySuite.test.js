import { describe, expect, it, vi } from "vitest";

import {
  buildParitySuitePlan,
  formatParitySuitePlan,
  parseParitySuiteArgs,
  runParitySuitePlan,
  summarizeParitySuiteResults,
} from "../../scripts/v4-parity-suite-core.mjs";

describe("v4 parity suite helpers", () => {
  it("parses default arguments", () => {
    const parsed = parseParitySuiteArgs([]);
    expect(parsed).toEqual({
      scope: "quick",
      dryRun: false,
      withDiff: false,
      continueOnError: false,
    });
  });

  it("parses full arguments and enables optional flags", () => {
    const parsed = parseParitySuiteArgs([
      "--scope",
      "full",
      "--dry-run",
      "--with-diff",
      "--continue-on-error",
    ]);
    expect(parsed).toEqual({
      scope: "full",
      dryRun: true,
      withDiff: true,
      continueOnError: true,
    });
  });

  it("rejects unsupported arguments", () => {
    expect(() => parseParitySuiteArgs(["--scope", "invalid"])).toThrow(
      /Scope không hợp lệ/i,
    );
    expect(() => parseParitySuiteArgs(["--unknown"])).toThrow(
      /Tham số không hỗ trợ/i,
    );
  });

  it("builds quick plan without optional diff command", () => {
    const plan = buildParitySuitePlan({ scope: "quick" });
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some((entry) => entry.id === "diff-hygiene-rollout")).toBe(false);
    expect(plan.every((entry) => entry.scopes.includes("quick"))).toBe(true);
  });

  it("builds full plan with optional diff command when enabled", () => {
    const plan = buildParitySuitePlan({ scope: "full", withDiff: true });
    expect(plan.some((entry) => entry.id === "typecheck-server-v4")).toBe(true);
    expect(plan.some((entry) => entry.id === "lint-rollout-slice")).toBe(true);
    expect(plan.some((entry) => entry.id === "diff-hygiene-rollout")).toBe(true);
  });

  it("formats command plan for dry-run output", () => {
    const plan = buildParitySuitePlan({ scope: "quick" }).slice(0, 2);
    const summary = formatParitySuitePlan(plan);
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
      .mockReturnValueOnce({ status: 2 })
      .mockReturnValueOnce({ status: 0 });

    const outcome = runParitySuitePlan(plan, { execCommand });
    expect(outcome.total).toBe(3);
    expect(outcome.executedCount).toBe(2);
    expect(outcome.failedCount).toBe(1);
    expect(outcome.allPassed).toBe(false);
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
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 0 });

    const outcome = runParitySuitePlan(plan, {
      execCommand,
      continueOnError: true,
    });
    expect(outcome.executedCount).toBe(3);
    expect(outcome.failedCount).toBe(1);
    expect(outcome.passedCount).toBe(2);
    expect(outcome.allPassed).toBe(false);
    expect(execCommand).toHaveBeenCalledTimes(3);
  });

  it("summarizes parity execution results", () => {
    const summary = summarizeParitySuiteResults([
      { id: "a", command: "cmd-a", status: 0, ok: true },
      { id: "b", command: "cmd-b", status: 1, ok: false },
    ]);
    expect(summary).toContain("PASS [a]");
    expect(summary).toContain("FAIL [b]");
  });
});
