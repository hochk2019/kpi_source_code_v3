#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DEFAULT_CUTOVER_TASKBOARD_PATH = "docs/operations/v4-cutover-execution-board.md";
export const CUTOVER_LABEL = "cutover-hard-gate";
export const REQUIRED_COLUMNS = Object.freeze([
  "Task ID",
  "Bead ID",
  "Owner",
  "Dependency",
  "Status",
  "Verify Command",
  "Evidence Path",
  "Rollback Note",
]);

const PLACEHOLDER_PATTERN = /^(-|n\/a|none|\(pending\)|pending)$/i;

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function parseCutoverTaskboard(content) {
  const lines = content.split(/\r?\n/);
  let headerIndex = -1;
  let headerCells = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) {
      continue;
    }
    const cells = splitTableRow(line);
    const hasAllRequired = REQUIRED_COLUMNS.every((required) =>
      cells.some((cell) => cell.toLowerCase() === required.toLowerCase()),
    );
    if (hasAllRequired) {
      headerIndex = index;
      headerCells = cells;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error("Khong tim thay bang cutover voi du cot bat buoc.");
  }

  const rows = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) {
      if (rows.length > 0) {
        break;
      }
      continue;
    }
    const cells = splitTableRow(line);
    if (isSeparatorRow(cells)) {
      continue;
    }
    const row = {};
    for (let cellIndex = 0; cellIndex < headerCells.length; cellIndex += 1) {
      row[headerCells[cellIndex]] = (cells[cellIndex] ?? "").trim();
    }
    const hasSignal = Object.values(row).some((value) => value !== "");
    if (hasSignal) {
      rows.push(row);
    }
  }

  return rows;
}

function extractJsonArray(rawOutput) {
  const start = rawOutput.indexOf("[");
  const end = rawOutput.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    return [];
  }
  const slice = rawOutput.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return [];
  }
}

function runBdJson(args) {
  const result = spawnSync("bd", args, {
    stdio: "pipe",
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
    shell: true,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error((result.stderr || result.stdout || "bd command failed").trim());
  }
  return extractJsonArray(result.stdout ?? "");
}

function runBdConsistencyCheck() {
  const result = spawnSync("node", ["scripts/check-bd-consistency.mjs"], {
    stdio: "pipe",
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
  });
  return {
    ok: (result.status ?? 1) === 0,
    output: [result.stdout ?? "", result.stderr ?? ""].join("\n").trim(),
  };
}

export function normalizeBoardStatus(status) {
  const normalized = (status || "").trim().toLowerCase().replaceAll("_", " ");
  if (normalized === "done") {
    return "done";
  }
  if (normalized === "in progress") {
    return "in_progress";
  }
  if (normalized === "not started") {
    return "not_started";
  }
  if (normalized === "blocked") {
    return "blocked";
  }
  return "unknown";
}

function parseDependencyIds(rawValue) {
  if (!rawValue || PLACEHOLDER_PATTERN.test(rawValue)) {
    return [];
  }
  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseEvidencePaths(rawValue) {
  if (!rawValue || PLACEHOLDER_PATTERN.test(rawValue)) {
    return [];
  }
  return rawValue
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isMissingRequired(value) {
  return !value || PLACEHOLDER_PATTERN.test(value.trim());
}

export function validateCutoverTaskboard({
  rows,
  issues,
  cwd = process.cwd(),
  consistency = { ok: true, output: "" },
}) {
  const errors = [];
  const warnings = [];

  const taskIdSet = new Set();
  const beadIdSet = new Set();
  const boardByTaskId = new Map();
  const boardByBeadId = new Map();

  for (const row of rows) {
    const taskId = row["Task ID"] ?? "";
    const beadId = row["Bead ID"] ?? "";
    if (!taskId) {
      errors.push("Co dong taskboard thieu Task ID.");
      continue;
    }
    if (!beadId) {
      errors.push(`Task ${taskId} thieu Bead ID.`);
      continue;
    }
    if (taskIdSet.has(taskId)) {
      errors.push(`Task ID bi trung: ${taskId}.`);
    }
    if (beadIdSet.has(beadId)) {
      errors.push(`Bead ID bi trung trong taskboard: ${beadId}.`);
    }
    taskIdSet.add(taskId);
    beadIdSet.add(beadId);
    boardByTaskId.set(taskId, row);
    boardByBeadId.set(beadId, row);
  }

  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const cutoverTaskIssues = issues.filter(
    (issue) =>
      issue.issue_type === "task" &&
      Array.isArray(issue.labels) &&
      issue.labels.some((label) => label.toLowerCase() === CUTOVER_LABEL),
  );

  for (const row of rows) {
    const taskId = row["Task ID"];
    const beadId = row["Bead ID"];
    const status = normalizeBoardStatus(row.Status);
    const issue = issueById.get(beadId);

    if (!issue) {
      errors.push(`Task ${taskId}: bead ${beadId} khong ton tai trong BD.`);
      continue;
    }

    if (status === "unknown") {
      errors.push(`Task ${taskId}: Status khong hop le (${row.Status}).`);
    }

    if (status === "done") {
      if (isMissingRequired(row["Verify Command"])) {
        errors.push(`Task ${taskId}: Done nhung thieu Verify Command.`);
      }
      if (isMissingRequired(row["Evidence Path"])) {
        errors.push(`Task ${taskId}: Done nhung thieu Evidence Path.`);
      }
      const evidencePaths = parseEvidencePaths(row["Evidence Path"]);
      for (const evidencePath of evidencePaths) {
        const absolutePath = path.resolve(cwd, evidencePath);
        if (!existsSync(absolutePath)) {
          errors.push(`Task ${taskId}: Evidence path khong ton tai (${evidencePath}).`);
        }
      }
    }

    if (status === "done" && issue.status !== "closed") {
      errors.push(`Task ${taskId}: board Done nhung bead ${beadId} chua closed.`);
    }
    if (status === "in_progress" && issue.status !== "in_progress") {
      errors.push(`Task ${taskId}: board In Progress nhung bead ${beadId} khong in_progress.`);
    }
    if (status === "not_started" && !["open", "blocked", "deferred"].includes(issue.status)) {
      errors.push(`Task ${taskId}: board Not Started nhung bead ${beadId} dang ${issue.status}.`);
    }
    if (status === "blocked" && issue.status !== "blocked") {
      warnings.push(`Task ${taskId}: board Blocked nhung bead ${beadId} dang ${issue.status}.`);
    }

    const dependencies = parseDependencyIds(row.Dependency);
    if (["in_progress", "done"].includes(status)) {
      for (const dependencyId of dependencies) {
        const dependencyRow = boardByTaskId.get(dependencyId);
        if (!dependencyRow) {
          errors.push(`Task ${taskId}: dependency ${dependencyId} khong ton tai trong taskboard.`);
          continue;
        }
        const dependencyStatus = normalizeBoardStatus(dependencyRow.Status);
        if (dependencyStatus !== "done") {
          errors.push(`Task ${taskId}: dependency ${dependencyId} chua Done.`);
        }
      }
    }
  }

  for (const issue of cutoverTaskIssues) {
    if (["open", "in_progress"].includes(issue.status) && !boardByBeadId.has(issue.id)) {
      errors.push(`Bead mo ${issue.id} co label cutover-hard-gate nhung khong co dong trong board.`);
    }
  }

  if (!consistency.ok) {
    errors.push(
      `check-bd-consistency fail: ${consistency.output || "task.md/open-backlog/BD khong nhat quan"}.`,
    );
  }

  return { errors, warnings };
}

function main() {
  const taskboardPath = process.argv[2] || DEFAULT_CUTOVER_TASKBOARD_PATH;
  const absoluteTaskboardPath = path.resolve(taskboardPath);
  if (!existsSync(absoluteTaskboardPath)) {
    console.error(`[cutover-check] Khong tim thay taskboard: ${taskboardPath}`);
    process.exit(1);
  }

  const taskboardContent = readFileSync(absoluteTaskboardPath, "utf8");
  let rows;
  try {
    rows = parseCutoverTaskboard(taskboardContent);
  } catch (error) {
    console.error(`[cutover-check] ${error.message}`);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.error("[cutover-check] Taskboard rong, khong the enforce hard-gate.");
    process.exit(1);
  }

  const issues = runBdJson([
    "list",
    "--type",
    "task",
    "--label-any",
    CUTOVER_LABEL,
    "--all",
    "--limit",
    "0",
    "--json",
  ]);
  const consistency = runBdConsistencyCheck();
  const result = validateCutoverTaskboard({
    rows,
    issues,
    consistency,
  });

  if (result.warnings.length > 0) {
    console.log("[cutover-check] Warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.error("[cutover-check] Errors:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[cutover-check] OK: ${rows.length} tasks hop le, board/bead/dependency/evidence gate da nhat quan.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

