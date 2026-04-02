import { describe, expect, it, vi } from 'vitest';

import {
  collectSnapshots,
  isGitFileClean,
  refreshGitNexus,
  restoreSnapshots,
} from '../scripts/gitnexus-refresh.mjs';

describe('gitnexus-refresh', () => {
  it('treats files as clean only when staged and unstaged diffs are empty', () => {
    const runner = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 });

    expect(isGitFileClean('AGENTS.md', 'repo', runner)).toBe(true);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('captures snapshots only for existing clean context files', () => {
    const exists = vi.fn((filePath) => filePath !== 'CLAUDE.md');
    const read = vi.fn(() => Buffer.from('original'));
    const runner = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 });

    const snapshots = collectSnapshots(['AGENTS.md', 'CLAUDE.md'], 'repo', {
      existsSync: exists,
      readFileSync: read,
      runner,
    });

    expect(snapshots).toEqual([{ filePath: 'AGENTS.md', contents: Buffer.from('original') }]);
    expect(read).toHaveBeenCalledOnce();
  });

  it('restores context files when analyze changed them', () => {
    const exists = vi.fn(() => true);
    const read = vi.fn(() => Buffer.from('updated'));
    const write = vi.fn();

    restoreSnapshots([{ filePath: 'AGENTS.md', contents: Buffer.from('original') }], {
      existsSync: exists,
      readFileSync: read,
      writeFileSync: write,
      unlinkSync: vi.fn(),
    });

    expect(write).toHaveBeenCalledWith('AGENTS.md', Buffer.from('original'));
  });

  it('runs analyze and restores tracked context files after success', () => {
    const runner = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 });
    const write = vi.fn();

    const exitCode = refreshGitNexus('repo', {
      runner,
      existsSync: vi.fn(() => true),
      readFileSync: vi
        .fn()
        .mockReturnValueOnce(Buffer.from('agents-before'))
        .mockReturnValueOnce(Buffer.from('claude-before'))
        .mockReturnValueOnce(Buffer.from('agents-after'))
        .mockReturnValueOnce(Buffer.from('claude-after')),
      writeFileSync: write,
      unlinkSync: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(runner).toHaveBeenLastCalledWith(
      'npx',
      ['-y', 'gitnexus@latest', 'analyze'],
      expect.objectContaining({ cwd: 'repo', stdio: 'inherit' }),
    );
    expect(write).toHaveBeenCalledTimes(2);
  });
});
