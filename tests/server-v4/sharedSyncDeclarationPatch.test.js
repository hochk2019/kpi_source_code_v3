import { describe, expect, it, vi } from 'vitest';

import { patchSharedSyncDeclarations } from '../../server-v4/src/app/shared-sync/sharedSyncDeclarationPatch.ts';

function createActor() {
  return {
    username: 'tester',
    role: 'admin',
    name: 'Tester',
    permissions: { accountManage: true },
    memberId: null,
    memberName: null,
    teamId: null,
    teamName: null,
  };
}

describe('patchSharedSyncDeclarations', () => {
  it('uu tien batch patch path khi declarationsStore co ho tro', async () => {
    const patchDeclarationsBatch = vi.fn(async (entries) =>
      entries.map((entry) => ({
        key: entry.target.key,
        nextRecord: {
          ...entry.target.current,
          nhan_vien: `${entry.normalizedPatch.patch.nhan_vien ?? ''}`,
          staff_name_snapshot: `${entry.normalizedPatch.patch.staff_name_snapshot ?? ''}`,
        },
      })),
    );
    const patchDeclaration = vi.fn();
    const persistence = {
      declarationsReader: {
        readDeclarationRows: () => [
          { declaration_id: 'decl-1', so_tk: 'TK-001', nhanh: 'CN1', nhan_vien: 'Old 1' },
          { declaration_id: 'decl-2', so_tk: 'TK-002', nhanh: 'CN2', nhan_vien: 'Old 2' },
        ],
      },
      declarationsStore: {
        patchDeclarationsBatch,
        patchDeclaration,
      },
    };

    const result = await patchSharedSyncDeclarations(
      persistence,
      [
        { key: 'TK-001_CN1', updates: { nhan_vien: 'New 1' } },
        { key: 'TK-002_CN2', updates: { nhan_vien: 'New 2' } },
      ],
      createActor(),
    );

    expect(result).toEqual({
      updated: 2,
      totalStored: 2,
      skippedKeys: [],
    });
    expect(patchDeclarationsBatch).toHaveBeenCalledTimes(1);
    expect(patchDeclarationsBatch).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          target: expect.objectContaining({ key: 'TK-001_CN1' }),
          normalizedPatch: expect.objectContaining({
            patch: expect.objectContaining({
              nhan_vien: 'New 1',
              staff_name_snapshot: 'New 1',
            }),
          }),
        }),
        expect.objectContaining({
          target: expect.objectContaining({ key: 'TK-002_CN2' }),
          normalizedPatch: expect.objectContaining({
            patch: expect.objectContaining({
              nhan_vien: 'New 2',
              staff_name_snapshot: 'New 2',
            }),
          }),
        }),
      ],
      expect.objectContaining({ username: 'tester' }),
    );
    expect(patchDeclaration).not.toHaveBeenCalled();
  });

  it('fallback ve patchDeclaration theo tung row khi store khong co batch path', async () => {
    const patchDeclaration = vi.fn(async (target, normalizedPatch) => ({
      ...target.current,
      agency: `${normalizedPatch.patch.agency ?? ''}`,
      agency_text: `${normalizedPatch.patch.agency_text ?? ''}`,
    }));
    const persistence = {
      declarationsReader: {
        readDeclarationRows: () => [
          { declaration_id: 'decl-1', so_tk: 'TK-003', nhanh: 'CN3', agency: 'Old Agency' },
        ],
      },
      declarationsStore: {
        patchDeclaration,
      },
    };

    const result = await patchSharedSyncDeclarations(
      persistence,
      [
        { key: 'TK-003_CN3', updates: { agency: 'New Agency' } },
        { key: 'missing', updates: { agency: 'Skipped' } },
      ],
      createActor(),
    );

    expect(result).toEqual({
      updated: 1,
      totalStored: 1,
      skippedKeys: ['missing'],
    });
    expect(patchDeclaration).toHaveBeenCalledTimes(1);
    expect(patchDeclaration).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'TK-003_CN3' }),
      expect.objectContaining({
        patch: expect.objectContaining({
          agency: 'New Agency',
          agency_text: 'New Agency',
        }),
      }),
      expect.objectContaining({ username: 'tester' }),
    );
  });
});
