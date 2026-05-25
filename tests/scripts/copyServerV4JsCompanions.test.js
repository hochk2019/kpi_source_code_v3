import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { copyServerV4JsCompanions } from "../../scripts/copy-server-v4-js-companions.mjs";

const tempDirs = [];

async function makeProjectRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kpi-copy-js-"));
  tempDirs.push(root);
  return root;
}

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("copyServerV4JsCompanions", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) =>
        fs.rm(dir, {
          recursive: true,
          force: true,
        }),
      ),
    );
  });

  it("copies .js companion files to dist/server-v4 while ignoring non-js files", async () => {
    const projectRoot = await makeProjectRoot();
    await writeFile(
      path.join(projectRoot, "server-v4", "src", "modules", "backup", "backupDomain.js"),
      "export const backup = true;\n",
    );
    await writeFile(
      path.join(projectRoot, "server-v4", "src", "modules", "backup", "backupDomain.d.ts"),
      "export declare const backup: boolean;\n",
    );
    await writeFile(
      path.join(projectRoot, "server-v4", "src", "modules", "rules", "ruleHistory.js"),
      "export const ruleHistory = [];\n",
    );

    const result = await copyServerV4JsCompanions({
      projectRoot,
      logger: { log() {} },
    });

    expect(result.count).toBe(2);
    expect(result.files.sort()).toEqual([
      path.join("modules", "backup", "backupDomain.js"),
      path.join("modules", "rules", "ruleHistory.js"),
    ]);

    const copiedBackupDomain = path.join(
      projectRoot,
      "dist",
      "server-v4",
      "modules",
      "backup",
      "backupDomain.js",
    );
    const copiedRuleHistory = path.join(
      projectRoot,
      "dist",
      "server-v4",
      "modules",
      "rules",
      "ruleHistory.js",
    );
    const copiedDeclaration = path.join(
      projectRoot,
      "dist",
      "server-v4",
      "modules",
      "backup",
      "backupDomain.d.ts",
    );

    await expect(fs.readFile(copiedBackupDomain, "utf8")).resolves.toContain("backup = true");
    await expect(fs.readFile(copiedRuleHistory, "utf8")).resolves.toContain("ruleHistory");
    expect(await exists(copiedDeclaration)).toBe(false);
  });

  it("returns zero copied files when server-v4/src is absent", async () => {
    const projectRoot = await makeProjectRoot();

    const result = await copyServerV4JsCompanions({
      projectRoot,
      logger: { log() {} },
    });

    expect(result.count).toBe(0);
    expect(result.files).toEqual([]);
  });
});
