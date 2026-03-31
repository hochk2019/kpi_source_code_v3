import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const ROLLOUT_HEALTH_ENDPOINT = "/api/v4/health";
export const ROLLOUT_METADATA_ENDPOINT = "/api/v4/meta/rollout";
export const DEFAULT_REHEARSAL_BASE_URL = "http://127.0.0.1:5000";
export const DEFAULT_REHEARSAL_OUT_DIR = "docs/operations/v4-rollout-evidence";
export const DEFAULT_REHEARSAL_TIMEOUT_MS = 15_000;
export const DEFAULT_REHEARSAL_BASE_URL_CANDIDATES = Object.freeze([
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5001",
  "http://127.0.0.1:5050",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
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

function normalizeCheckStatus(status) {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

function formatChecklistLine(label, ok) {
  return `${ok ? "PASS" : "FAIL"} - ${label}`;
}

export function sanitizeLabel(value) {
  if (!value) {
    return "manual";
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "manual";
}

export function buildEvidenceBasename({ capturedAt, label }) {
  const dateIso = new Date(capturedAt ?? Date.now()).toISOString();
  const compactTimestamp = dateIso.replace(/[:.]/g, "-");
  return `${compactTimestamp}-${sanitizeLabel(label)}`;
}

export function parseRolloutRehearsalArgs(rawArgs) {
  const parsed = {
    baseUrl: DEFAULT_REHEARSAL_BASE_URL,
    baseUrlCandidates: [...DEFAULT_REHEARSAL_BASE_URL_CANDIDATES],
    outDir: DEFAULT_REHEARSAL_OUT_DIR,
    label: "manual",
    expectedStage: null,
    timeoutMs: DEFAULT_REHEARSAL_TIMEOUT_MS,
    dryRun: false,
    allowFailedGates: false,
    discoverBaseUrl: false,
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
    if (arg === "--discover-base-url") {
      parsed.discoverBaseUrl = true;
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

export function buildRehearsalAssessment({
  healthPayload,
  rolloutPayload,
  expectedStage = null,
}) {
  const healthReadinessState = healthPayload?.readiness?.state ?? null;
  const rolloutReadinessState = rolloutPayload?.health?.readiness?.state ?? null;
  const dbFileState = rolloutPayload?.health?.dbFile?.state ?? healthPayload?.db?.state ?? null;
  const currentStage = rolloutPayload?.rollout?.currentStage ?? null;
  const checks = Array.isArray(rolloutPayload?.migrationVerification?.checks)
    ? rolloutPayload.migrationVerification.checks
    : [];
  const failedChecks = checks
    .filter((entry) => normalizeCheckStatus(entry?.status) === "fail")
    .map((entry) => entry?.id ?? "(unknown-check)");

  const blockers = [];
  const warnings = [];

  if (healthReadinessState === "blocked") {
    blockers.push("Health readiness state dang blocked.");
  }
  if (rolloutReadinessState === "blocked") {
    blockers.push("Rollout readiness state dang blocked.");
  }
  if (failedChecks.length > 0) {
    blockers.push(`Migration checks fail: ${failedChecks.join(", ")}`);
  }

  if (!healthReadinessState) {
    warnings.push("Khong doc duoc health.readiness.state tu /api/v4/health.");
  }
  if (!rolloutReadinessState) {
    warnings.push("Khong doc duoc health.readiness.state tu /api/v4/meta/rollout.");
  }
  if (dbFileState && dbFileState !== "ready" && dbFileState !== "not-required") {
    warnings.push(`health.dbFile.state hien tai la "${dbFileState}".`);
  }
  if (expectedStage && currentStage !== expectedStage) {
    warnings.push(
      `rollout.currentStage mismatch: expected "${expectedStage}", actual "${currentStage ?? "(missing)"}".`,
    );
  }

  const checklist = [
    {
      id: "health-readiness-not-blocked",
      label: "Health readiness khong blocked",
      ok: healthReadinessState !== "blocked",
    },
    {
      id: "rollout-readiness-not-blocked",
      label: "Rollout readiness khong blocked",
      ok: rolloutReadinessState !== "blocked",
    },
    {
      id: "migration-checks-no-fail",
      label: "Migration verification khong co fail",
      ok: failedChecks.length === 0,
    },
  ];

  if (expectedStage) {
    checklist.push({
      id: "stage-matches-expected",
      label: `Current stage khop expected (${expectedStage})`,
      ok: currentStage === expectedStage,
    });
  }

  const status = blockers.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass";

  return {
    status,
    healthReadinessState,
    rolloutReadinessState,
    dbFileState,
    currentStage,
    expectedStage,
    failedChecks,
    blockers,
    warnings,
    checklist,
  };
}

export function createRolloutRehearsalReport({
  baseUrl,
  label,
  expectedStage = null,
  healthPayload,
  rolloutPayload,
  capturedAt = new Date().toISOString(),
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl || DEFAULT_REHEARSAL_BASE_URL);
  const assessment = buildRehearsalAssessment({
    healthPayload,
    rolloutPayload,
    expectedStage,
  });

  return {
    metadata: {
      capturedAt,
      label,
      baseUrl: normalizedBaseUrl,
      expectedStage,
    },
    endpoints: {
      health: `${normalizedBaseUrl}${ROLLOUT_HEALTH_ENDPOINT}`,
      rollout: `${normalizedBaseUrl}${ROLLOUT_METADATA_ENDPOINT}`,
    },
    assessment,
    snapshot: {
      health: healthPayload,
      rollout: rolloutPayload,
    },
  };
}

export function formatRolloutRehearsalSummary(report) {
  const { metadata, assessment, endpoints } = report;
  const lines = [
    `[rehearsal] capturedAt=${metadata.capturedAt}`,
    `[rehearsal] label=${metadata.label} baseUrl=${metadata.baseUrl}`,
    `[rehearsal] endpoints: health=${endpoints.health} rollout=${endpoints.rollout}`,
    `[rehearsal] status=${assessment.status} currentStage=${assessment.currentStage ?? "(missing)"}`,
    `[rehearsal] checklist`,
    ...assessment.checklist.map((entry) => `  - ${formatChecklistLine(entry.label, entry.ok)}`),
  ];

  if (assessment.failedChecks.length > 0) {
    lines.push(`[rehearsal] failedChecks=${assessment.failedChecks.join(", ")}`);
  }
  if (assessment.blockers.length > 0) {
    lines.push("[rehearsal] blockers");
    lines.push(...assessment.blockers.map((entry) => `  - ${entry}`));
  }
  if (assessment.warnings.length > 0) {
    lines.push("[rehearsal] warnings");
    lines.push(...assessment.warnings.map((entry) => `  - ${entry}`));
  }
  return lines.join("\n");
}

export async function fetchJsonWithTimeout(
  url,
  { fetchImpl = fetch, timeoutMs = DEFAULT_REHEARSAL_TIMEOUT_MS } = {},
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });
    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType && !contentType.toLowerCase().includes("application/json")) {
      const payloadText = await response.text();
      const snippet = payloadText.replace(/\s+/g, " ").trim().slice(0, 120);
      throw new Error(
        `${url} did not return JSON (content-type: ${contentType || "unknown"}, snippet: ${snippet || "(empty)"})`,
      );
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(`${url} returned invalid JSON: ${error.message}`);
    }
    if (!response.ok) {
      const reason = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(`${url} failed: ${reason}`);
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function captureRolloutRehearsalSnapshot({
  baseUrl = DEFAULT_REHEARSAL_BASE_URL,
  discoverBaseUrl = false,
  baseUrlCandidates = DEFAULT_REHEARSAL_BASE_URL_CANDIDATES,
  label = "manual",
  expectedStage = null,
  timeoutMs = DEFAULT_REHEARSAL_TIMEOUT_MS,
  fetchImpl = fetch,
  capturedAt,
} = {}) {
  const resolution = discoverBaseUrl
    ? await resolveRehearsalBaseUrl({
        baseUrl,
        candidates: baseUrlCandidates,
        fetchImpl,
        timeoutMs,
      })
    : {
        resolvedBaseUrl: normalizeBaseUrl(baseUrl),
        probeHealthPayload: null,
      };
  const normalizedBaseUrl = resolution.resolvedBaseUrl;
  const healthUrl = `${normalizedBaseUrl}${ROLLOUT_HEALTH_ENDPOINT}`;
  const rolloutUrl = `${normalizedBaseUrl}${ROLLOUT_METADATA_ENDPOINT}`;

  const [healthPayload, rolloutPayload] = await Promise.all([
    resolution.probeHealthPayload
      ? Promise.resolve(resolution.probeHealthPayload)
      : fetchJsonWithTimeout(healthUrl, { fetchImpl, timeoutMs }),
    fetchJsonWithTimeout(rolloutUrl, { fetchImpl, timeoutMs }),
  ]);

  return createRolloutRehearsalReport({
    baseUrl: normalizedBaseUrl,
    label,
    expectedStage,
    healthPayload,
    rolloutPayload,
    capturedAt,
  });
}

export async function resolveRehearsalBaseUrl({
  baseUrl = DEFAULT_REHEARSAL_BASE_URL,
  candidates = DEFAULT_REHEARSAL_BASE_URL_CANDIDATES,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_REHEARSAL_TIMEOUT_MS,
} = {}) {
  const normalizedPrimary = normalizeBaseUrl(baseUrl);
  const mergedCandidates = [normalizedPrimary, ...candidates.map((entry) => normalizeBaseUrl(entry))]
    .filter(Boolean);
  const dedupedCandidates = [...new Set(mergedCandidates)];

  const probeResults = [];

  for (const candidate of dedupedCandidates) {
    const url = `${candidate}${ROLLOUT_HEALTH_ENDPOINT}`;
    try {
      const payload = await fetchJsonWithTimeout(url, { fetchImpl, timeoutMs });
      probeResults.push({
        baseUrl: candidate,
        ok: true,
      });
      return {
        resolvedBaseUrl: candidate,
        probeHealthPayload: payload,
        probeResults,
      };
    } catch (error) {
      probeResults.push({
        baseUrl: candidate,
        ok: false,
        reason: error.message,
      });
    }
  }

  const lines = probeResults
    .map((entry) =>
      entry.ok
        ? `- ${entry.baseUrl}: ok`
        : `- ${entry.baseUrl}: ${entry.reason || "failed"}`,
    )
    .join("; ");
  throw new Error(`Khong tim thay base URL API phu hop. Probe summary: ${lines}`);
}

export function toRolloutRehearsalMarkdown(report) {
  const sections = [
    "# V4 Rollout Rehearsal Evidence",
    "",
    `- Captured at: ${report.metadata.capturedAt}`,
    `- Label: ${report.metadata.label}`,
    `- Base URL: ${report.metadata.baseUrl}`,
    `- Status: ${report.assessment.status}`,
    `- Current stage: ${report.assessment.currentStage ?? "(missing)"}`,
    `- Expected stage: ${report.assessment.expectedStage ?? "(none)"}`,
    "",
    "## Checklist",
    ...report.assessment.checklist.map(
      (entry) => `- ${entry.ok ? "[x]" : "[ ]"} ${entry.label}`,
    ),
  ];

  if (report.assessment.failedChecks.length > 0) {
    sections.push("", "## Failed checks");
    sections.push(...report.assessment.failedChecks.map((entry) => `- ${entry}`));
  }
  if (report.assessment.blockers.length > 0) {
    sections.push("", "## Blockers");
    sections.push(...report.assessment.blockers.map((entry) => `- ${entry}`));
  }
  if (report.assessment.warnings.length > 0) {
    sections.push("", "## Warnings");
    sections.push(...report.assessment.warnings.map((entry) => `- ${entry}`));
  }

  sections.push(
    "",
    "## Endpoints",
    `- Health: ${report.endpoints.health}`,
    `- Rollout: ${report.endpoints.rollout}`,
    "",
    "## Summary",
    "```text",
    formatRolloutRehearsalSummary(report),
    "```",
  );

  return sections.join("\n");
}

export async function writeRolloutRehearsalEvidence(
  report,
  {
    outDir = DEFAULT_REHEARSAL_OUT_DIR,
    mkdirImpl = mkdir,
    writeFileImpl = writeFile,
  } = {},
) {
  await mkdirImpl(outDir, { recursive: true });
  const basename = buildEvidenceBasename({
    capturedAt: report.metadata.capturedAt,
    label: report.metadata.label,
  });
  const jsonPath = path.resolve(outDir, `${basename}.json`);
  const markdownPath = path.resolve(outDir, `${basename}.md`);
  await writeFileImpl(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFileImpl(markdownPath, `${toRolloutRehearsalMarkdown(report)}\n`, "utf8");
  return { jsonPath, markdownPath };
}
