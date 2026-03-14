import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

describe("workspace layout", () => {
  it("defines the target app and package shells for the v4 split", () => {
    const workspacePath = path.join(projectRoot, "pnpm-workspace.yaml");

    expect(fs.existsSync(workspacePath)).toBe(true);

    const workspace = fs.readFileSync(workspacePath, "utf8");
    expect(workspace).toContain("apps/*");
    expect(workspace).toContain("packages/*");

    expect(readJson("apps/web/package.json")).toEqual(
      expect.objectContaining({
        name: "@kpi/web",
        private: true,
      }),
    );
    expect(readJson("apps/api/package.json")).toEqual(
      expect.objectContaining({
        name: "@kpi/api",
        private: true,
        scripts: expect.objectContaining({
          start: expect.any(String),
          "build:v4": expect.any(String),
        }),
      }),
    );
    expect(readJson("apps/ecus-bridge/package.json")).toEqual(
      expect.objectContaining({
        name: "@kpi/ecus-bridge",
        private: true,
      }),
    );
    expect(readJson("packages/domain/package.json")).toEqual(
      expect.objectContaining({
        name: "@kpi/domain",
        type: "module",
      }),
    );
    expect(readJson("packages/api-client/package.json")).toEqual(
      expect.objectContaining({
        name: "@kpi/api-client",
        type: "module",
      }),
    );
    expect(readJson("packages/ui/package.json")).toEqual(
      expect.objectContaining({
        name: "@kpi/ui",
        type: "module",
      }),
    );
  });
});
