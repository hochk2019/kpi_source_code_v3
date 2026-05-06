import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const CONTEXT_FILES = ['AGENTS.md', 'CLAUDE.md'];

// Get the pnpm command based on platform
function getPnpmCommand() {
  if (process.platform === 'win32') {
    // Use absolute path to pnpm.cmd on Windows
    return 'C:\\Users\\PC\\AppData\\Roaming\\npm\\pnpm.cmd';
  }
  return 'pnpm';
}

// Run gitnexus analyze via pnpm exec
function runNpmCommand(args, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const pnpmCmd = getPnpmCommand();

  // On Windows, use shell: true to properly handle .cmd files
  const result = spawnSync(pnpmCmd, ['exec', 'gitnexus', ...args], {
    cwd,
    stdio: options.stdio ?? 'inherit',
    encoding: options.encoding ?? 'utf8',
    shell: true,
    ...options
  });

  return result;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    stdio: options.stdio ?? 'pipe',
    encoding: options.encoding ?? 'utf8',
    shell: options.shell ?? false,
  });
}

export function isGitFileClean(filePath, cwd, runner = run) {
  const unstaged = runner('git', ['diff', '--quiet', '--', filePath], { cwd });
  const staged = runner('git', ['diff', '--cached', '--quiet', '--', filePath], { cwd });
  return unstaged.status === 0 && staged.status === 0;
}

export function collectSnapshots(files, cwd, deps = {}) {
  const exists = deps.existsSync ?? existsSync;
  const read = deps.readFileSync ?? readFileSync;
  const gitRunner = deps.runner ?? run;

  return files
    .filter((filePath) => exists(filePath) && isGitFileClean(filePath, cwd, gitRunner))
    .map((filePath) => ({
      filePath,
      contents: read(filePath),
    }));
}

export function restoreSnapshots(snapshots, deps = {}) {
  const exists = deps.existsSync ?? existsSync;
  const read = deps.readFileSync ?? readFileSync;
  const write = deps.writeFileSync ?? writeFileSync;

  for (const snapshot of snapshots) {
    if (!exists(snapshot.filePath)) {
      continue;
    }

    const currentContents = read(snapshot.filePath);
    if (Buffer.compare(currentContents, snapshot.contents) !== 0) {
      write(snapshot.filePath, snapshot.contents);
    }
  }
}

export function refreshGitNexus(cwd = process.cwd(), deps = {}) {
  const runner = deps.runner ?? runNpmCommand;
  const snapshots = collectSnapshots(CONTEXT_FILES, cwd, deps);
  const result = runner(['analyze'], { cwd });

  if (result.status === 0) {
    restoreSnapshots(snapshots, deps);
  }

  return result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(refreshGitNexus());
}
