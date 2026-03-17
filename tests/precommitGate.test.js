import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(testsDir, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

describe('commit-time quality gates', () => {
  it('runs server-v4 verification during precommit', () => {
    expect(packageJson.scripts?.precommit).toContain('pnpm run verify:server-v4');
  });

  it('keeps the git pre-commit hook wired to the precommit script', () => {
    expect(packageJson['simple-git-hooks']?.['pre-commit']).toBe('pnpm precommit');
  });
});
