const VALID_SCOPES = new Set(["quick", "full"]);

export const PARITY_COMMAND_CATALOG = Object.freeze([
  {
    id: "shell-health-rollout",
    label: "server-v4 shell health + rollout metadata",
    command:
      "pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js",
    scopes: ["quick", "full"],
  },
  {
    id: "runtime-reporting-parity",
    label: "server-v4 runtime reporting parity",
    command:
      "pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js tests/server-v4/reportingService.test.js tests/server-v4/legacyReportBridge.test.js",
    scopes: ["quick", "full"],
  },
  {
    id: "monolith-ecus-bridge",
    label: "monolith ECUS bridge extraction",
    command:
      "pnpm exec vitest run tests/server.ecusBridgeService.test.js tests/server.ecusSqlBridge.test.js tests/server.api.test.js tests/server.seed.test.js",
    scopes: ["quick", "full"],
  },
  {
    id: "import-workflow-regression",
    label: "import workflow regression",
    command:
      "pnpm exec vitest run tests/dataImporter.preview.test.jsx tests/dataImporterWorkflowGuide.test.jsx tests/useDataImporterWorkflowSession.test.jsx",
    scopes: ["quick", "full"],
  },
  {
    id: "reporting-client-viewer-parity",
    label: "reporting client + viewer parity",
    command:
      "pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx",
    scopes: ["quick", "full"],
  },
  {
    id: "typecheck-server-v4",
    label: "static verification",
    command: "pnpm run typecheck:server-v4",
    scopes: ["full"],
  },
  {
    id: "lint-rollout-slice",
    label: "lint verification",
    command:
      "pnpm exec eslint server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js",
    scopes: ["full"],
  },
  {
    id: "diff-hygiene-rollout",
    label: "diff hygiene",
    command:
      "git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js docs/operations/v4-qa-matrix.md docs/operations/v4-rollout-plan.md",
    scopes: ["full"],
    optional: "withDiff",
  },
]);

export function parseParitySuiteArgs(rawArgs) {
  const parsed = {
    scope: "quick",
    dryRun: false,
    withDiff: false,
    continueOnError: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--with-diff") {
      parsed.withDiff = true;
      continue;
    }
    if (arg === "--continue-on-error") {
      parsed.continueOnError = true;
      continue;
    }
    if (arg === "--scope") {
      const scope = rawArgs[index + 1];
      if (!scope || scope.startsWith("--")) {
        throw new Error("Thiếu giá trị cho --scope (quick|full).");
      }
      if (!VALID_SCOPES.has(scope)) {
        throw new Error(`Scope không hợp lệ: ${scope}. Chỉ nhận quick hoặc full.`);
      }
      parsed.scope = scope;
      index += 1;
      continue;
    }
    throw new Error(`Tham số không hỗ trợ: ${arg}`);
  }

  return parsed;
}

export function buildParitySuitePlan(options = {}) {
  const scope = options.scope ?? "quick";
  const withDiff = options.withDiff === true;
  if (!VALID_SCOPES.has(scope)) {
    throw new Error(`Scope không hợp lệ: ${scope}. Chỉ nhận quick hoặc full.`);
  }

  return PARITY_COMMAND_CATALOG.filter((entry) => {
    if (!entry.scopes.includes(scope)) {
      return false;
    }
    if (entry.optional === "withDiff" && !withDiff) {
      return false;
    }
    return true;
  });
}

export function formatParitySuitePlan(plan) {
  return plan
    .map(
      (entry, index) =>
        `${index + 1}. [${entry.id}] ${entry.label}\n   ${entry.command}`,
    )
    .join("\n");
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

export function runParitySuitePlan(plan, options) {
  const execCommand = options?.execCommand;
  const continueOnError = options?.continueOnError === true;
  if (typeof execCommand !== "function") {
    throw new Error("execCommand phải là function.");
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
  const passedCount = results.length - failedCount;
  return {
    total: plan.length,
    executedCount: results.length,
    failedCount,
    passedCount,
    allPassed: failedCount === 0 && results.length === plan.length,
    results,
  };
}

export function summarizeParitySuiteResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return "No parity commands were executed.";
  }
  return results
    .map((entry) => {
      const icon = entry.ok ? "PASS" : "FAIL";
      return `${icon} [${entry.id}] (${entry.status}) ${entry.command}`;
    })
    .join("\n");
}
