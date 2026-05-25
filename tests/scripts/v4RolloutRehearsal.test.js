import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  buildEvidenceBasename,
  buildRehearsalAssessment,
  captureRolloutRehearsalSnapshot,
  createRolloutRehearsalReport,
  DEFAULT_REHEARSAL_BASE_URL_CANDIDATES,
  fetchJsonWithTimeout,
  formatRolloutRehearsalSummary,
  parseRolloutRehearsalArgs,
  resolveRehearsalBaseUrl,
  writeRolloutRehearsalEvidence,
} from "../../scripts/v4-rollout-rehearsal-core.mjs";

function createHealthPayload(state = "degraded") {
  return {
    readiness: {
      state,
    },
    db: {
      state: "ready",
    },
  };
}

function createRolloutPayload({
  readinessState = "degraded",
  dbFileState = "ready",
  currentStage = "module-parity",
  checkStatuses = ["pass", "warn"],
} = {}) {
  return {
    health: {
      readiness: {
        state: readinessState,
      },
      dbFile: {
        state: dbFileState,
      },
    },
    rollout: {
      currentStage,
    },
    migrationVerification: {
      checks: checkStatuses.map((status, index) => ({
        id: `check-${index + 1}`,
        status,
      })),
    },
  };
}

describe("v4 rollout rehearsal helpers", () => {
  it("parses default args", () => {
    expect(parseRolloutRehearsalArgs([])).toEqual({
      baseUrl: "http://127.0.0.1:5000",
      baseUrlCandidates: [...DEFAULT_REHEARSAL_BASE_URL_CANDIDATES],
      outDir: "docs/operations/v4-rollout-evidence",
      label: "manual",
      expectedStage: null,
      timeoutMs: 15_000,
      dryRun: false,
      allowFailedGates: false,
      discoverBaseUrl: false,
    });
  });

  it("parses custom args and booleans", () => {
    expect(
      parseRolloutRehearsalArgs([
        "--base-url",
        "https://rollout.example.local/",
        "--base-url-candidates",
        "http://127.0.0.1:5050,http://127.0.0.1:5000",
        "--out-dir",
        "tmp/rehearsal",
        "--label",
        "staging wave",
        "--expected-stage",
        "module-parity",
        "--timeout-ms",
        "25000",
        "--discover-base-url",
        "--dry-run",
        "--allow-failed-gates",
      ]),
    ).toEqual({
      baseUrl: "https://rollout.example.local",
      baseUrlCandidates: ["http://127.0.0.1:5050", "http://127.0.0.1:5000"],
      outDir: "tmp/rehearsal",
      label: "staging wave",
      expectedStage: "module-parity",
      timeoutMs: 25_000,
      dryRun: true,
      allowFailedGates: true,
      discoverBaseUrl: true,
    });
  });

  it("rejects invalid args", () => {
    expect(() => parseRolloutRehearsalArgs(["--timeout-ms", "-1"])).toThrow(
      /timeout/i,
    );
    expect(() => parseRolloutRehearsalArgs(["--unknown"])).toThrow(
      /khong ho tro/i,
    );
  });

  it("assesses blockers when readiness blocked or checks fail", () => {
    const assessment = buildRehearsalAssessment({
      healthPayload: createHealthPayload("blocked"),
      rolloutPayload: createRolloutPayload({
        readinessState: "blocked",
        checkStatuses: ["pass", "fail"],
      }),
    });

    expect(assessment.status).toBe("fail");
    expect(assessment.failedChecks).toEqual(["check-2"]);
    expect(assessment.blockers.length).toBeGreaterThan(0);
  });

  it("returns pass when gates are green", () => {
    const assessment = buildRehearsalAssessment({
      healthPayload: createHealthPayload("ready"),
      rolloutPayload: createRolloutPayload({
        readinessState: "ready",
        dbFileState: "not-required",
        currentStage: "cutover-ready",
        checkStatuses: ["pass", "warn"],
      }),
      expectedStage: "cutover-ready",
    });

    expect(assessment.status).toBe("pass");
    expect(assessment.failedChecks).toEqual([]);
    expect(assessment.warnings).toEqual([]);
  });

  it("returns warn when expected stage mismatches", () => {
    const assessment = buildRehearsalAssessment({
      healthPayload: createHealthPayload("degraded"),
      rolloutPayload: createRolloutPayload({
        readinessState: "degraded",
        currentStage: "module-parity",
        checkStatuses: ["pass", "warn"],
      }),
      expectedStage: "internal-qa",
    });

    expect(assessment.status).toBe("warn");
    expect(assessment.warnings.join(" ")).toMatch(/mismatch/i);
  });

  it("formats textual summary", () => {
    const report = createRolloutRehearsalReport({
      baseUrl: "http://127.0.0.1:5000",
      label: "nightly",
      expectedStage: "internal-qa",
      healthPayload: createHealthPayload("degraded"),
      rolloutPayload: createRolloutPayload({
        readinessState: "degraded",
        currentStage: "module-parity",
      }),
      capturedAt: "2026-04-01T00:00:00.000Z",
    });

    const summary = formatRolloutRehearsalSummary(report);
    expect(summary).toContain("status=warn");
    expect(summary).toContain("PASS - Health readiness khong blocked");
    expect(summary).toContain("Current stage khop expected");
  });

  it("builds safe evidence basename", () => {
    const basename = buildEvidenceBasename({
      capturedAt: "2026-04-01T01:02:03.456Z",
      label: "Staging Wave #1",
    });
    expect(basename).toContain("2026-04-01T01-02-03-456Z");
    expect(basename).toContain("staging-wave-1");
  });

  it("captures snapshots via injected fetch", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith("/api/v4/health")) {
        return {
          ok: true,
          status: 200,
          json: async () => createHealthPayload("degraded"),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => createRolloutPayload(),
      };
    });

    const report = await captureRolloutRehearsalSnapshot({
      baseUrl: "http://127.0.0.1:5000",
      label: "ci",
      fetchImpl,
      timeoutMs: 2_000,
      expectedStage: "internal-qa",
      capturedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(report.assessment.status).toBe("warn");
    expect(report.snapshot.rollout.rollout.currentStage).toBe("module-parity");
  });

  it("resolves baseUrl by probing candidates when discovery is enabled", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).startsWith("http://127.0.0.1:5000")) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => "text/html",
          },
          text: async () => "<html>frontend shell</html>",
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: {
          get: () => "application/json",
        },
        json: async () => createHealthPayload("degraded"),
      };
    });

    const resolved = await resolveRehearsalBaseUrl({
      baseUrl: "http://127.0.0.1:5000",
      candidates: ["http://127.0.0.1:5050"],
      fetchImpl,
      timeoutMs: 500,
    });

    expect(resolved.resolvedBaseUrl).toBe("http://127.0.0.1:5050");
    expect(resolved.probeResults.length).toBe(2);
    expect(resolved.probeResults[0]).toMatchObject({
      baseUrl: "http://127.0.0.1:5000",
      ok: false,
    });
  });

  it("returns aggregate diagnostics when no candidate is valid", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: () => "text/html",
      },
      text: async () => "<html>no api</html>",
      json: async () => ({}),
    }));

    await expect(
      resolveRehearsalBaseUrl({
        baseUrl: "http://127.0.0.1:5000",
        candidates: ["http://127.0.0.1:5050"],
        fetchImpl,
        timeoutMs: 500,
      }),
    ).rejects.toThrow(/Khong tim thay base URL API phu hop/i);
  });

  it("captures snapshots with discovery mode and reuses probed health payload", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).startsWith("http://127.0.0.1:5000")) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => "text/html",
          },
          text: async () => "<html>frontend shell</html>",
          json: async () => ({}),
        };
      }
      if (String(url).endsWith("/api/v4/health")) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => "application/json",
          },
          json: async () => createHealthPayload("degraded"),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: {
          get: () => "application/json",
        },
        json: async () =>
          createRolloutPayload({
            readinessState: "degraded",
            currentStage: "module-parity",
          }),
      };
    });

    const report = await captureRolloutRehearsalSnapshot({
      baseUrl: "http://127.0.0.1:5000",
      discoverBaseUrl: true,
      baseUrlCandidates: ["http://127.0.0.1:5050"],
      label: "ci",
      fetchImpl,
      timeoutMs: 1_000,
      expectedStage: "module-parity",
      capturedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.metadata.baseUrl).toBe("http://127.0.0.1:5050");
    expect(report.assessment.status).toBe("pass");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("reports a clear error when endpoint does not return JSON", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: () => "text/html; charset=UTF-8",
      },
      text: async () => "<!doctype html><html><body>Not API</body></html>",
      json: async () => ({}),
    }));

    await expect(
      fetchJsonWithTimeout("http://127.0.0.1:5000/api/v4/health", {
        fetchImpl,
        timeoutMs: 500,
      }),
    ).rejects.toThrow(/did not return JSON/i);
  });

  it("writes json and markdown evidence files", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "v4-rehearsal-"));
    const report = createRolloutRehearsalReport({
      baseUrl: "http://127.0.0.1:5000",
      label: "nightly",
      expectedStage: "module-parity",
      healthPayload: createHealthPayload("degraded"),
      rolloutPayload: createRolloutPayload(),
      capturedAt: "2026-04-01T00:00:00.000Z",
    });

    const output = await writeRolloutRehearsalEvidence(report, { outDir });
    const jsonContents = await readFile(output.jsonPath, "utf8");
    const markdownContents = await readFile(output.markdownPath, "utf8");

    expect(jsonContents).toContain('"label": "nightly"');
    expect(markdownContents).toContain("# V4 Rollout Rehearsal Evidence");
    expect(markdownContents).toContain("## Checklist");
  });
});
