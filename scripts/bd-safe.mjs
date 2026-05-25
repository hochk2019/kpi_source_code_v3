#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MUTATING_COMMANDS = new Set([
  "admin",
  "close",
  "comments",
  "create",
  "create-form",
  "delete",
  "defer",
  "dep",
  "duplicate",
  "edit",
  "gate",
  "hooks",
  "import",
  "label",
  "merge-slot",
  "move",
  "q",
  "refile",
  "rename",
  "reopen",
  "repair",
  "resolve-conflicts",
  "set-state",
  "ship",
  "slot",
  "supersede",
  "sync",
  "undefer",
  "update",
]);

export function extractCommandName(args) {
  for (const arg of args) {
    if (!arg.startsWith("-")) {
      return arg;
    }
  }
  return "";
}

export function isMutatingCommand(commandName) {
  return MUTATING_COMMANDS.has(commandName);
}

export function parseBdSafeArgs(rawArgs) {
  const args = [];
  let noSync = false;
  let runCheck = false;

  for (const arg of rawArgs) {
    if (arg === "--no-sync") {
      noSync = true;
      continue;
    }
    if (arg === "--check") {
      runCheck = true;
      continue;
    }
    args.push(arg);
  }

  return { args, noSync, runCheck };
}

function runCommand(bin, args, opts = {}) {
  const result = spawnSync(bin, args, {
    stdio: opts.capture ? "pipe" : "inherit",
    encoding: "utf8",
    cwd: opts.cwd ?? process.cwd(),
    env: process.env,
  });

  if (opts.capture) {
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  return { status: result.status ?? 1 };
}

function resolveRepoRoot(cwd) {
  const result = runCommand("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    capture: true,
  });
  if (result.status !== 0) {
    throw new Error("Không tìm thấy git repository từ thư mục hiện tại.");
  }
  return result.stdout.trim().replace(/\r?\n/g, "");
}

function resolveCanonicalRoot(repoRoot) {
  const result = runCommand("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    capture: true,
  });
  if (result.status !== 0) {
    return repoRoot;
  }

  const firstWorktreeLine = result.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith("worktree "));
  if (!firstWorktreeLine) {
    return repoRoot;
  }

  return firstWorktreeLine.slice("worktree ".length).trim();
}

function runBd(args, canonicalRoot) {
  const result = spawnSync("bd", args, {
    stdio: "inherit",
    encoding: "utf8",
    cwd: canonicalRoot,
    env: process.env,
    shell: true,
  });
  return result.status ?? 1;
}

function main() {
  const { args, noSync, runCheck } = parseBdSafeArgs(process.argv.slice(2));
  const commandName = extractCommandName(args);

  let canonicalRoot;
  try {
    const repoRoot = resolveRepoRoot(process.cwd());
    canonicalRoot = resolveCanonicalRoot(repoRoot);
  } catch (error) {
    console.error(`[bd-safe] ${error.message}`);
    process.exit(1);
  }

  if (runCheck) {
    const checkStatus = runCommand("node", ["scripts/check-bd-consistency.mjs"], {
      cwd: canonicalRoot,
    }).status;
    if (checkStatus !== 0) {
      process.exit(checkStatus);
    }
  }

  const status = runBd(args, canonicalRoot);
  if (status !== 0) {
    process.exit(status);
  }

  const shouldAutoSync =
    !noSync &&
    commandName !== "" &&
    commandName !== "sync" &&
    isMutatingCommand(commandName);

  if (!shouldAutoSync) {
    process.exit(0);
  }

  const syncStatus = runBd(["sync"], canonicalRoot);
  process.exit(syncStatus);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
