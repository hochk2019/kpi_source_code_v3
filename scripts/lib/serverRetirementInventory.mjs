import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_SCAN_ROOTS = ["server-v4/src", "tests"];
export const DEFAULT_SCAN_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];

const IMPORT_RE =
  /(?:import|export)\s+(?:[^'"]*?from\s*)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function scanServerDependencyImports(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const scanRoots = options.scanRoots ?? DEFAULT_SCAN_ROOTS;
  const extensions = new Set(options.extensions ?? DEFAULT_SCAN_EXTENSIONS);
  const edges = [];

  for (const scanRoot of scanRoots) {
    const absoluteRoot = path.join(rootDir, scanRoot);
    walkTree(absoluteRoot, extensions, (filePath) => {
      const source = toPosixPath(path.relative(rootDir, filePath));
      const text = readFileSync(filePath, "utf8");

      for (const match of text.matchAll(IMPORT_RE)) {
        const specifier = match[1] || match[2] || match[3] || "";
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolved = path.normalize(path.join(path.dirname(filePath), specifier));
        const target = toPosixPath(path.relative(rootDir, resolved));
        if (target === "server" || target.startsWith("server/")) {
          edges.push({
            source,
            target,
            scope: source.startsWith("server-v4/src/") ? "runtime" : "tests",
          });
        }
      }
    });
  }

  edges.sort((left, right) => {
    if (left.source === right.source) {
      return left.target.localeCompare(right.target);
    }
    return left.source.localeCompare(right.source);
  });

  return edges;
}

export function summarizeServerDependencyImports(edges) {
  const byTarget = new Map();
  const runtimeSources = new Set();
  const testSources = new Set();

  for (const edge of edges) {
    const current =
      byTarget.get(edge.target) ?? {
        target: edge.target,
        runtimeRefs: 0,
        testRefs: 0,
        runtimeSources: new Set(),
        testSources: new Set(),
      };

    if (edge.scope === "runtime") {
      current.runtimeRefs += 1;
      current.runtimeSources.add(edge.source);
      runtimeSources.add(edge.source);
    } else {
      current.testRefs += 1;
      current.testSources.add(edge.source);
      testSources.add(edge.source);
    }

    byTarget.set(edge.target, current);
  }

  const matrix = [...byTarget.values()]
    .map((entry) => ({
      target: entry.target,
      runtimeRefs: entry.runtimeRefs,
      testRefs: entry.testRefs,
      runtimeFiles: entry.runtimeSources.size,
      testFiles: entry.testSources.size,
    }))
    .sort((left, right) => left.target.localeCompare(right.target));

  return {
    runtimeCount: edges.filter((edge) => edge.scope === "runtime").length,
    runtimeFiles: runtimeSources.size,
    testCount: edges.filter((edge) => edge.scope === "tests").length,
    testFiles: testSources.size,
    targetCount: matrix.length,
    matrix,
  };
}

export function readServerRetirementInventory(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function validateServerRetirementState({ inventory, edges, epicStatus }) {
  const summary = summarizeServerDependencyImports(edges);
  const errors = [];
  const allowedStatuses = new Set(["open", "closed"]);
  const frozenMatrix = new Map();

  for (const row of inventory.matrix ?? []) {
    frozenMatrix.set(row.target, row);
    if (!row.ownerWave || !row.destination) {
      errors.push(`Frozen row \`${row.target}\` thiếu ownerWave hoặc destination.`);
    }
    if (!allowedStatuses.has(row.status)) {
      errors.push(`Frozen row \`${row.target}\` có status không hợp lệ: \`${row.status}\`.`);
    }
  }

  for (const current of summary.matrix) {
    const frozen = frozenMatrix.get(current.target);
    if (!frozen) {
      errors.push(`Import target \`${current.target}\` chưa được map vào frozen matrix.`);
      continue;
    }
    if (current.runtimeRefs > Number(frozen.runtimeRefs ?? 0)) {
      errors.push(
        `Runtime imports tới \`${current.target}\` tăng từ ${frozen.runtimeRefs} lên ${current.runtimeRefs}.`,
      );
    }
    if (current.testRefs > Number(frozen.testRefs ?? 0)) {
      errors.push(
        `Test imports tới \`${current.target}\` tăng từ ${frozen.testRefs} lên ${current.testRefs}.`,
      );
    }
  }

  if (epicStatus === "closed" && (summary.runtimeCount > 0 || summary.testCount > 0)) {
    errors.push(
      `Epic \`${inventory.epicId}\` đã closed nhưng vẫn còn ${summary.runtimeCount} runtime imports và ${summary.testCount} test imports trỏ tới server/.`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    summary,
  };
}

function walkTree(rootDir, extensions, onFile) {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkTree(fullPath, extensions, onFile);
      continue;
    }
    if (extensions.has(path.extname(entry.name))) {
      onFile(fullPath);
    }
  }
}
