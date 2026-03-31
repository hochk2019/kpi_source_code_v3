#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  captureRolloutRehearsalSnapshot,
  formatRolloutRehearsalSummary,
  parseRolloutRehearsalArgs,
  writeRolloutRehearsalEvidence,
} from "./v4-rollout-rehearsal-core.mjs";

async function main() {
  let parsed;
  try {
    parsed = parseRolloutRehearsalArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[v4-rehearsal] ${error.message}`);
    process.exit(1);
  }

  const modeFlags = [
    `baseUrl=${parsed.baseUrl}`,
    `discoverBaseUrl=${parsed.discoverBaseUrl ? "true" : "false"}`,
    `label=${parsed.label}`,
    parsed.expectedStage ? `expectedStage=${parsed.expectedStage}` : "expectedStage=(none)",
    `timeoutMs=${parsed.timeoutMs}`,
    parsed.dryRun ? "dryRun=true" : "dryRun=false",
    parsed.allowFailedGates ? "allowFailedGates=true" : "allowFailedGates=false",
  ].join(" ");
  console.log(`[v4-rehearsal] ${modeFlags}`);

  let report;
  try {
    report = await captureRolloutRehearsalSnapshot({
      baseUrl: parsed.baseUrl,
      discoverBaseUrl: parsed.discoverBaseUrl,
      baseUrlCandidates: parsed.baseUrlCandidates,
      label: parsed.label,
      expectedStage: parsed.expectedStage,
      timeoutMs: parsed.timeoutMs,
    });
  } catch (error) {
    console.error(`[v4-rehearsal] Khong the thu thap rollout evidence: ${error.message}`);
    process.exit(1);
  }

  console.log("[v4-rehearsal] summary");
  console.log(formatRolloutRehearsalSummary(report));

  if (!parsed.dryRun) {
    const output = await writeRolloutRehearsalEvidence(report, {
      outDir: parsed.outDir,
    });
    console.log(`[v4-rehearsal] evidence json: ${output.jsonPath}`);
    console.log(`[v4-rehearsal] evidence markdown: ${output.markdownPath}`);
  } else {
    console.log("[v4-rehearsal] dry-run enabled, skip writing evidence files.");
  }

  const shouldFail = report.assessment.status === "fail" && !parsed.allowFailedGates;
  if (shouldFail) {
    console.error("[v4-rehearsal] Gate fail detected. Use --allow-failed-gates only for diagnostics.");
    process.exit(1);
  }

  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
