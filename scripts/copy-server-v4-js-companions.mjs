#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

async function collectRelativeJsFiles(rootDir, nestedPath = "") {
  const targetDir = nestedPath ? path.join(rootDir, nestedPath) : rootDir;

  let entries;
  try {
    entries = await fs.readdir(targetDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT" && !nestedPath) {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = nestedPath ? path.join(nestedPath, entry.name) : entry.name;
    if (entry.isDirectory()) {
      const nestedFiles = await collectRelativeJsFiles(rootDir, relativePath);
      files.push(...nestedFiles);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(relativePath);
    }
  }

  return files;
}

export async function copyServerV4JsCompanions({
  projectRoot = DEFAULT_PROJECT_ROOT,
  sourceDir = "server-v4/src",
  outputDir = "dist/server-v4",
  logger = console,
} = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedSourceDir = path.resolve(resolvedProjectRoot, sourceDir);
  const resolvedOutputDir = path.resolve(resolvedProjectRoot, outputDir);

  const files = await collectRelativeJsFiles(resolvedSourceDir);
  for (const relativePath of files) {
    const sourcePath = path.join(resolvedSourceDir, relativePath);
    const outputPath = path.join(resolvedOutputDir, relativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(sourcePath, outputPath);
  }

  logger.log(
    `[build:server-v4] copied ${files.length} JS companion file(s) from ` +
      `${path.relative(resolvedProjectRoot, resolvedSourceDir) || "."} to ` +
      `${path.relative(resolvedProjectRoot, resolvedOutputDir) || "."}`,
  );

  return {
    count: files.length,
    files,
    sourceDir: resolvedSourceDir,
    outputDir: resolvedOutputDir,
  };
}

async function main() {
  try {
    await copyServerV4JsCompanions();
  } catch (error) {
    console.error(`[build:server-v4] failed to copy JS companion files: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
