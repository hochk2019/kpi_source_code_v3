import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildEvidenceBasename,
  captureRolloutRehearsalSnapshot,
  DEFAULT_REHEARSAL_BASE_URL,
  DEFAULT_REHEARSAL_BASE_URL_CANDIDATES,
  DEFAULT_REHEARSAL_TIMEOUT_MS,
} from "./v4-rollout-rehearsal-core.mjs";

export const DEFAULT_CUTOVER_PREFLIGHT_OUT_DIR = "docs/operations/v4-cutover-evidence";

export const CUTOVER_PREFLIGHT_COMMAND_CATALOG = Object.freeze([
  {
    id: "cutover-governance-gate",
    label: "Hard-gate taskboard consistency",
    command: "pnpm run cutover:check",
  },
  {
    id: "api-contract-report",
    label: "Frontend contract inventory",
    command: "pnpm run api:contract:report",
  },
  {
    id: "api-contract-gate",
    label: "Frontend legacy route gate",
    command: "pnpm run api:contract:gate",
  },
  {
    id: "parity-suite",
    label: "Canonical parity suite",
    command: "pnpm run verify:v4:parity",
  },
  {
    id: "uat-smoke",
    label: "Role-based UAT smoke",
    command:
      "pnpm exec playwright test tests/playwright/account-management.spec.js tests/playwright/team-management.spec.js tests/playwright/import-flow.spec.js tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1",
    optional: "withUatSmoke",
  },
]);

function parseStringFlag(rawArgs, index, flagName) {
  const value = rawArgs[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Thieu gia tri cho ${flagName}.`);
  }
  return value;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function parseTimeoutMs(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Gia tri timeout khong hop le: ${value}.`);
  }
  return parsed;
}

function parseBaseUrlCandidates(value) {
  const entries = value
    .split(",")
    .map((entry) => normalizeBaseUrl(entry.trim()))
    .filter(Boolean);
  if (entries.length === 0) {
    throw new Error("Danh sach --base-url-candidates rong.");
  }
  return entries;
}

function normalizeExecResult(rawResult) {
  if (typeof rawResult === "number") {
    return { status: rawResult };
  }
  if (rawResult && typeof rawResult.status === "number") {
    return rawResult;
  }
  return { status: 1 };
}

export function parseCutoverPreflightArgs(rawArgs) {
  const parsed = {
    baseUrl: DEFAULT_REHEARSAL_BASE_URL,
    baseUrlCandidates: [...DEFAULT_REHEARSAL_BASE_URL_CANDIDATES],
    outDir: DEFAULT_CUTOVER_PREFLIGHT_OUT_DIR,
    label: "manual",
    expectedStage: "module-parity",
    timeoutMs: DEFAULT_REHEARSAL_TIMEOUT_MS,
    dryRun: false,
    allowFailedGates: false,
    continueOnError: false,
    discoverBaseUrl: false,
    withUatSmoke: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--allow-failed-gates") {
      parsed.allowFailedGates = true;
      continue;
    }
    if (arg === "--continue-on-error") {
      parsed.continueOnError = true;
      continue;
    }
    if (arg === "--discover-base-url") {
      parsed.discoverBaseUrl = true;
      continue;
    }
    if (arg === "--with-uat-smoke") {
      parsed.withUatSmoke = true;
      continue;
    }
    if (arg === "--base-url") {
      parsed.baseUrl = normalizeBaseUrl(parseStringFlag(rawArgs, index, "--base-url"));
      index += 1;
      continue;
    }
    if (arg === "--base-url-candidates") {
      parsed.baseUrlCandidates = parseBaseUrlCandidates(
        parseStringFlag(rawArgs, index, "--base-url-candidates"),
      );
      index += 1;
      continue;
    }
    if (arg === "--out-dir") {
      parsed.outDir = parseStringFlag(rawArgs, index, "--out-dir");
      index += 1;
      continue;
    }
    if (arg === "--label") {
      parsed.label = parseStringFlag(rawArgs, index, "--label");
      index += 1;
      continue;
    }
    if (arg === "--expected-stage") {
      parsed.expectedStage = parseStringFlag(rawArgs, index, "--expected-stage");
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = parseTimeoutMs(parseStringFlag(rawArgs, index, "--timeout-ms"));
      index += 1;
      continue;
    }

    throw new Error(`Tham so khong ho tro: ${arg}`);
  }

  return parsed;
}

export function buildCutoverPreflightPlan(options = {}) {
  const withUatSmoke = options.withUatSmoke === true;
  return CUTOVER_PREFLIGHT_COMMAND_CATALOG.filter((entry) => {
    if (entry.optional === "withUatSmoke" && !withUatSmoke) {
      return false;
    }
    return true;
  });
}

export function runCutoverPreflightPlan(plan, options = {}) {
  const execCommand = options.execCommand;
  const continueOnError = options.continueOnError === true;
  if (typeof execCommand !== "function") {
    throw new Error("execCommand phai la function.");
  }

  const results = [];

  for (const entry of plan) {
    const executed = normalizeExecResult(execCommand(entry.command, entry));
    const status = executed.status ?? 1;
    const ok = status === 0;
    results.push({
      id: entry.id,
      label: entry.label,
      command: entry.command,
      status,
      ok,
    });
    if (!ok && !continueOnError) {
      break;
    }
  }

  const failedCount = results.filter((entry) => !entry.ok).length;

  return {
    total: plan.length,
    executedCount: results.length,
    failedCount,
    passedCount: results.length - failedCount,
    allPassed: failedCount === 0 && results.length === plan.length,
    results,
  };
}

export function formatCutoverPreflightPlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) {
    return "(empty plan)";
  }
  return plan
    .map((entry, index) => `${index + 1}. [${entry.id}] ${entry.label}\n   ${entry.command}`)
    .join("\n");
}

export function buildCutoverPreflightReport({
  label,
  expectedStage,
  commandRun,
  rehearsalReport,
  capturedAt = new Date().toISOString(),
}) {
  const stageActual = rehearsalReport?.assessment?.currentStage ?? null;
  const stageMatches = expectedStage ? stageActual === expectedStage : true;
  const commandFailures = Array.isArray(commandRun?.results)
    ? commandRun.results.filter((entry) => !entry.ok)
    : [];
  const rehearsalBlockers = Array.isArray(rehearsalReport?.assessment?.blockers)
    ? rehearsalReport.assessment.blockers
    : [];

  const blockers = [
    ...commandFailures.map((entry) => `Command failed: ${entry.id} (exit ${entry.status})`),
    ...rehearsalBlockers,
  ];

  if (!stageMatches && expectedStage) {
    blockers.push(
      `rollout.currentStage mismatch: expected \"${expectedStage}\", actual \"${stageActual ?? "(missing)"}\".`,
    );
  }

  const status = blockers.length > 0 ? "fail" : "pass";

  const checklist = [
    {
      id: "contract-and-parity-commands-pass",
      label: "Contract + parity command gates pass",
      ok: commandFailures.length === 0,
    },
    {
      id: "health-readiness-not-blocked",
      label: "Health readiness khong blocked",
      ok: rehearsalReport?.assessment?.healthReadinessState !== "blocked",
    },
    {
      id: "rollout-readiness-not-blocked",
      label: "Rollout readiness khong blocked",
      ok: rehearsalReport?.assessment?.rolloutReadinessState !== "blocked",
    },
    {
      id: "migration-checks-no-fail",
      label: "Migration verification khong co fail",
      ok: (rehearsalReport?.assessment?.failedChecks?.length ?? 0) === 0,
    },
  ];

  if (expectedStage) {
    checklist.push({
      id: "stage-matches-expected",
      label: `Current stage khop expected (${expectedStage})`,
      ok: stageMatches,
    });
  }

  return {
    metadata: {
      capturedAt,
      label,
      expectedStage: expectedStage ?? null,
      baseUrl: rehearsalReport?.metadata?.baseUrl ?? null,
    },
    status,
    checklist,
    blockers,
    commandRun,
    rehearsal: rehearsalReport,
  };
}

export function summarizeCutoverPreflightReport(report) {
  const lines = [
    `[cutover-preflight] capturedAt=${report.metadata.capturedAt}`,
    `[cutover-preflight] label=${report.metadata.label} baseUrl=${report.metadata.baseUrl ?? "(missing)"}`,
    `[cutover-preflight] status=${report.status}`,
    `[cutover-preflight] commands`,
    ...(report.commandRun?.results ?? []).map((entry) =>
      `  - ${entry.ok ? "PASS" : "FAIL"} [${entry.id}] (${entry.status}) ${entry.command}`,
    ),
    `[cutover-preflight] checklist`,
    ...report.checklist.map((entry) => `  - ${entry.ok ? "PASS" : "FAIL"} ${entry.label}`),
  ];

  if (report.blockers.length > 0) {
    lines.push("[cutover-preflight] blockers");
    lines.push(...report.blockers.map((entry) => `  - ${entry}`));
  }

  return lines.join("\n");
}

export function toCutoverPreflightMarkdown(report) {
  const lines = [
    "# V4 Cutover Preflight Evidence",
    "",
    `- Captured at: ${report.metadata.capturedAt}`,
    `- Label: ${report.metadata.label}`,
    `- Base URL: ${report.metadata.baseUrl ?? "(missing)"}`,
    `- Expected stage: ${report.metadata.expectedStage ?? "(none)"}`,
    `- Status: ${report.status}`,
    "",
    "## Command gates",
    ...(report.commandRun?.results ?? []).map(
      (entry) =>
        `- ${entry.ok ? "[x]" : "[ ]"} [${entry.id}] ${entry.command} (exit ${entry.status})`,
    ),
    "",
    "## Checklist",
    ...report.checklist.map((entry) => `- ${entry.ok ? "[x]" : "[ ]"} ${entry.label}`),
  ];

  if (report.blockers.length > 0) {
    lines.push("", "## Blockers");
    lines.push(...report.blockers.map((entry) => `- ${entry}`));
  }

  lines.push("", "## Rehearsal summary", "```text", summarizeCutoverPreflightReport(report), "```");

  return lines.join("\n");
}

export async function writeCutoverPreflightEvidence(
  report,
  { outDir = DEFAULT_CUTOVER_PREFLIGHT_OUT_DIR, mkdirImpl = mkdir, writeFileImpl = writeFile } = {},
) {
  await mkdirImpl(outDir, { recursive: true });
  const base = `${buildEvidenceBasename({
    capturedAt: report.metadata.capturedAt,
    label: report.metadata.label,
  })}-cutover-preflight`;
  const jsonPath = path.resolve(outDir, `${base}.json`);
  const markdownPath = path.resolve(outDir, `${base}.md`);
  await writeFileImpl(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFileImpl(markdownPath, `${toCutoverPreflightMarkdown(report)}\n`, "utf8");
  return { jsonPath, markdownPath };
}

export async function executeCutoverPreflight({
  plan,
  runPlan,
  rehearsalOptions,
  reportOptions,
}) {
  const commandRun = runPlan();
  const rehearsalReport = await captureRolloutRehearsalSnapshot(rehearsalOptions);
  return buildCutoverPreflightReport({
    ...reportOptions,
    commandRun,
    rehearsalReport,
  });
}
