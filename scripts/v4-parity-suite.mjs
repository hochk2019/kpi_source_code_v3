#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  buildParitySuitePlan,
  formatParitySuitePlan,
  parseParitySuiteArgs,
  runParitySuitePlan,
  summarizeParitySuiteResults,
} from "./v4-parity-suite-core.mjs";

function runShellCommand(command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  });
  return { status: result.status ?? 1 };
}

function main() {
  let parsedArgs;
  try {
    parsedArgs = parseParitySuiteArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[v4-parity] ${error.message}`);
    process.exit(1);
  }

  const plan = buildParitySuitePlan({
    scope: parsedArgs.scope,
    withDiff: parsedArgs.withDiff,
  });
  if (plan.length === 0) {
    console.error("[v4-parity] Không tìm thấy command nào cho cấu hình hiện tại.");
    process.exit(1);
  }

  const modeFlags = [
    `scope=${parsedArgs.scope}`,
    parsedArgs.withDiff ? "withDiff=true" : "withDiff=false",
    parsedArgs.continueOnError ? "continueOnError=true" : "continueOnError=false",
  ].join(" ");
  console.log(`[v4-parity] ${modeFlags}`);
  console.log(`[v4-parity] commands=${plan.length}`);

  if (parsedArgs.dryRun) {
    console.log("[v4-parity] dry-run plan");
    console.log(formatParitySuitePlan(plan));
    process.exit(0);
  }

  const startedAt = Date.now();
  const outcome = runParitySuitePlan(plan, {
    continueOnError: parsedArgs.continueOnError,
    execCommand: runShellCommand,
  });

  console.log("[v4-parity] execution summary");
  console.log(summarizeParitySuiteResults(outcome.results));

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[v4-parity] passed=${outcome.passedCount}/${outcome.executedCount} failed=${outcome.failedCount} duration=${durationSeconds}s`,
  );

  process.exit(outcome.allPassed ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
