#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  buildCutoverPreflightPlan,
  executeCutoverPreflight,
  formatCutoverPreflightPlan,
  parseCutoverPreflightArgs,
  runCutoverPreflightPlan,
  summarizeCutoverPreflightReport,
  writeCutoverPreflightEvidence,
} from "./v4-cutover-preflight-core.mjs";

function runShellCommand(command, { timeoutMs }) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
    env: process.env,
    timeout: timeoutMs,
  });
  return { status: result.status ?? 1 };
}

async function main() {
  let parsed;
  try {
    parsed = parseCutoverPreflightArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[v4-cutover] ${error.message}`);
    process.exit(1);
  }

  const plan = buildCutoverPreflightPlan({ withUatSmoke: parsed.withUatSmoke });
  if (plan.length === 0) {
    console.error("[v4-cutover] Khong tim thay command nao cho preflight.");
    process.exit(1);
  }

  const modeFlags = [
    `baseUrl=${parsed.baseUrl}`,
    `discoverBaseUrl=${parsed.discoverBaseUrl ? "true" : "false"}`,
    `label=${parsed.label}`,
    `expectedStage=${parsed.expectedStage}`,
    `timeoutMs=${parsed.timeoutMs}`,
    parsed.withUatSmoke ? "withUatSmoke=true" : "withUatSmoke=false",
    parsed.dryRun ? "dryRun=true" : "dryRun=false",
    parsed.continueOnError ? "continueOnError=true" : "continueOnError=false",
    parsed.allowFailedGates ? "allowFailedGates=true" : "allowFailedGates=false",
  ].join(" ");
  console.log(`[v4-cutover] ${modeFlags}`);
  console.log(`[v4-cutover] commands=${plan.length}`);

  if (parsed.dryRun) {
    console.log("[v4-cutover] dry-run plan");
    console.log(formatCutoverPreflightPlan(plan));
    process.exit(0);
  }

  const report = await executeCutoverPreflight({
    plan,
    runPlan: () =>
      runCutoverPlan(plan, {
        timeoutMs: parsed.timeoutMs,
        continueOnError: parsed.continueOnError,
      }),
    rehearsalOptions: {
      baseUrl: parsed.baseUrl,
      discoverBaseUrl: parsed.discoverBaseUrl,
      baseUrlCandidates: parsed.baseUrlCandidates,
      label: parsed.label,
      expectedStage: parsed.expectedStage,
      timeoutMs: parsed.timeoutMs,
    },
    reportOptions: {
      label: parsed.label,
      expectedStage: parsed.expectedStage,
    },
  });

  console.log("[v4-cutover] summary");
  console.log(summarizeCutoverPreflightReport(report));

  const output = await writeCutoverPreflightEvidence(report, {
    outDir: parsed.outDir,
  });
  console.log(`[v4-cutover] evidence json: ${output.jsonPath}`);
  console.log(`[v4-cutover] evidence markdown: ${output.markdownPath}`);

  const shouldFail = report.status === "fail" && !parsed.allowFailedGates;
  if (shouldFail) {
    console.error("[v4-cutover] Gate fail detected. Use --allow-failed-gates only for diagnostics.");
    process.exit(1);
  }

  process.exit(0);
}

function runCutoverPlan(plan, { timeoutMs, continueOnError }) {
  return runCutoverPreflightPlan(plan, {
    continueOnError,
    execCommand: (command) => runShellCommand(command, { timeoutMs }),
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
