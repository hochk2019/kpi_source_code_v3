import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  scanServerDependencyImports,
  summarizeServerDependencyImports,
  validateServerRetirementState,
} from "../scripts/lib/serverRetirementInventory.mjs";

const tempDirs = [];

function createTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "server-retirement-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("server retirement inventory helpers", () => {
  it("scans runtime and test imports that resolve into server/", () => {
    const repoRoot = createTempRepo();
    fs.mkdirSync(path.join(repoRoot, "server-v4", "src"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "tests"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "server"), { recursive: true });

    fs.writeFileSync(
      path.join(repoRoot, "server-v4", "src", "runtime.ts"),
      `import { generateReport } from "../../${["server", "reportExport.js"].join("/")}";\n`,
    );
    fs.writeFileSync(
      path.join(repoRoot, "tests", "runtime.test.js"),
      `const mod = require("../${["server", "reportExport.js"].join("/")}");\n`,
    );
    fs.writeFileSync(
      path.join(repoRoot, "tests", "ignored.test.js"),
      'import { ok } from "../src/not-server.js";\n',
    );

    const edges = scanServerDependencyImports({ rootDir: repoRoot });
    expect(edges).toEqual([
      {
        source: "server-v4/src/runtime.ts",
        target: "server/reportExport.js",
        scope: "runtime",
      },
      {
        source: "tests/runtime.test.js",
        target: "server/reportExport.js",
        scope: "tests",
      },
    ]);

    expect(summarizeServerDependencyImports(edges)).toMatchObject({
      runtimeCount: 1,
      runtimeFiles: 1,
      testCount: 1,
      testFiles: 1,
      targetCount: 1,
    });
  });

  it("fails validation when current imports are not mapped or when epic is closed too early", () => {
    const inventory = {
      epicId: "cng-sr1",
      matrix: [
        {
          target: "server/reportExport.js",
          ownerWave: "3",
          destination: "@kpi/backend-shared/reporting",
          runtimeRefs: 1,
          testRefs: 1,
          status: "open",
        },
      ],
    };
    const edges = [
      {
        source: "server-v4/src/modules/reporting/reportingRuntime.ts",
        target: "server/reportExport.js",
        scope: "runtime",
      },
      {
        source: "tests/server.api.test.js",
        target: "server/reportExport.js",
        scope: "tests",
      },
      {
        source: "tests/server.api.test.js",
        target: "server/reportExportPayloads.js",
        scope: "tests",
      },
    ];

    const result = validateServerRetirementState({
      inventory,
      edges,
      epicStatus: "closed",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("server/reportExportPayloads.js"),
        expect.stringContaining("Epic `cng-sr1` đã closed"),
      ]),
    );
  });

  it("accepts states that only reduce frozen counts while the epic stays open", () => {
    const inventory = {
      epicId: "cng-sr1",
      matrix: [
        {
          target: "server/reportExport.js",
          ownerWave: "3",
          destination: "@kpi/backend-shared/reporting",
          runtimeRefs: 2,
          testRefs: 2,
          status: "open",
        },
      ],
    };
    const edges = [
      {
        source: "server-v4/src/modules/reporting/reportingRuntime.ts",
        target: "server/reportExport.js",
        scope: "runtime",
      },
    ];

    const result = validateServerRetirementState({
      inventory,
      edges,
      epicStatus: "open",
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary).toMatchObject({
      runtimeCount: 1,
      testCount: 0,
    });
  });
});
