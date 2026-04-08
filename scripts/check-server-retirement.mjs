#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  readServerRetirementInventory,
  scanServerDependencyImports,
  validateServerRetirementState,
} from "./lib/serverRetirementInventory.mjs";

function extractJsonArray(rawOutput) {
  const start = rawOutput.indexOf("[");
  const end = rawOutput.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    return [];
  }

  try {
    return JSON.parse(rawOutput.slice(start, end + 1));
  } catch {
    return [];
  }
}

function readIssueStatus(issueId) {
  const result = spawnSync("bd", ["list", "--all", "--limit", "0", "--json"], {
    stdio: "pipe",
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
    shell: true,
  });

  if ((result.status ?? 1) !== 0) {
    return "";
  }

  const issues = extractJsonArray(result.stdout ?? "");
  const match = issues.find((issue) => issue.id === issueId);
  return match?.status ?? "";
}

function main() {
  const inventoryPath = path.join(process.cwd(), "docs", "server-retirement-inventory.json");
  const inventory = readServerRetirementInventory(inventoryPath);
  const edges = scanServerDependencyImports();
  const epicStatus = readIssueStatus(inventory.epicId);
  const result = validateServerRetirementState({ inventory, edges, epicStatus });

  console.log(
    `[server-retirement] runtime imports: ${result.summary.runtimeCount} across ${result.summary.runtimeFiles} files`,
  );
  console.log(
    `[server-retirement] test imports: ${result.summary.testCount} across ${result.summary.testFiles} files`,
  );
  console.log(`[server-retirement] mapped targets: ${result.summary.targetCount}`);
  console.log(`[server-retirement] epic ${inventory.epicId}: ${epicStatus || "unknown"}`);

  if (!result.ok) {
    console.error("[server-retirement] Errors:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("[server-retirement] OK: frozen inventory and current imports are aligned.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
