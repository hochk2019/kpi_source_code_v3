#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function parseActiveBead(taskContent) {
  const match = taskContent.match(/--\s*Bead:\s*([a-z0-9.-]+)/i);
  return match ? match[1] : "";
}

export function parseReadyBeads(backlogContent) {
  const sectionMatch = backlogContent.match(
    /Current highest-priority ready items:[\s\S]*?(?:\n##\s|\n#\s|$)/i,
  );
  if (!sectionMatch) {
    return [];
  }

  const ids = new Set();
  const regex = /`([a-z0-9.-]+)`/gi;
  for (const match of sectionMatch[0].matchAll(regex)) {
    ids.add(match[1]);
  }
  return [...ids];
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
    return [];
  }
  return extractJsonArray(result.stdout ?? "");
}

function loadText(path) {
  return readFileSync(path, "utf8");
}

function main() {
  const taskContent = loadText("task.md");
  const backlogContent = loadText("docs/open-backlog.md");

  const activeBead = parseActiveBead(taskContent);
  const readyBeads = parseReadyBeads(backlogContent);
  const taskItems = runBdJson(["list", "--type", "task", "--all", "--limit", "0", "--json"]);
  const inProgressItems = runBdJson([
    "list",
    "--type",
    "task",
    "--status",
    "in_progress",
    "--limit",
    "0",
    "--json",
  ]);

  const statusById = new Map(taskItems.map((item) => [item.id, item.status]));
  const inProgressIds = new Set(inProgressItems.map((item) => item.id));

  const errors = [];
  const warnings = [];

  if (!activeBead) {
    warnings.push("task.md chưa có `-- Bead:` trong phần Active Slice.");
  } else {
    const activeStatus = statusById.get(activeBead);
    if (!activeStatus) {
      errors.push(`Active bead \`${activeBead}\` không tồn tại trong BD.`);
    } else if (activeStatus !== "in_progress") {
      errors.push(
        `Active bead \`${activeBead}\` đang ở trạng thái \`${activeStatus}\`, cần \`in_progress\`.`,
      );
    }
  }

  for (const beadId of readyBeads) {
    const status = statusById.get(beadId);
    if (!status) {
      errors.push(`Bead \`${beadId}\` trong ready list không tồn tại trong BD.`);
      continue;
    }
    if (!["open", "in_progress"].includes(status)) {
      errors.push(
        `Bead \`${beadId}\` nằm trong ready list nhưng BD đang là \`${status}\`.`,
      );
    }
  }

  for (const inProgressId of inProgressIds) {
    if (inProgressId !== activeBead) {
      warnings.push(
        `Có bead \`${inProgressId}\` đang \`in_progress\` ngoài Active Slice; cần xác nhận chủ đích.`,
      );
    }
  }

  if (warnings.length > 0) {
    console.log("[bd-check] Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("[bd-check] Errors:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("[bd-check] OK: task.md, open-backlog, và BD đang nhất quán.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
