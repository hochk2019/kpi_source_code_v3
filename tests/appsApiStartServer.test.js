import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadCompiledBuildV4App } from "../apps/api/src/startApiServer.js";

const tempDirs = [];

async function makeProjectRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kpi-api-runtime-"));
  tempDirs.push(root);
  return root;
}

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

describe("loadCompiledBuildV4App", () => {
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

  it("throws a build hint when dist/server-v4/index.js is absent", async () => {
    const projectRoot = await makeProjectRoot();

    await expect(loadCompiledBuildV4App(projectRoot)).rejects.toThrow(
      /Missing compiled server-v4 runtime/i,
    );
  });

  it("reports missing runtime dependencies with actionable detail", async () => {
    const projectRoot = await makeProjectRoot();
    await writeFile(
      path.join(projectRoot, "dist", "server-v4", "index.js"),
      "export { buildV4App } from './app/build-v4-app.js';\n",
    );
    await writeFile(
      path.join(projectRoot, "dist", "server-v4", "app", "build-v4-app.js"),
      "import './missing-dependency.js';\nexport function buildV4App() { return null; }\n",
    );

    await expect(loadCompiledBuildV4App(projectRoot)).rejects.toThrow(
      /cannot be loaded\. Missing dependency/i,
    );
    await expect(loadCompiledBuildV4App(projectRoot)).rejects.toThrow(
      /missing-dependency\.js/i,
    );
  });

  it("returns the compiled buildV4App function when runtime is complete", async () => {
    const projectRoot = await makeProjectRoot();
    await writeFile(
      path.join(projectRoot, "dist", "server-v4", "index.js"),
      "export function buildV4App() { return { listen() {} }; }\n",
    );

    const buildV4App = await loadCompiledBuildV4App(projectRoot);
    expect(typeof buildV4App).toBe("function");
  });
});
