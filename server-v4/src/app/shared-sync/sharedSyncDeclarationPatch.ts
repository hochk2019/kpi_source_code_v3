import type { RuntimePersistence } from '../../persistence/runtimePersistence.js';
import {
  createDeclarationRowKey,
  normalizeDeclarationPatch,
  type DeclarationActor,
  type DeclarationBatchPatchEntry,
  type DeclarationBatchPatchResult,
  type DeclarationStoreTarget,
  type DeclarationsStore,
} from '../../modules/declarations/declarationsStore.js';

type SharedSyncDeclarationUpdate = {
  key?: unknown;
  row?: unknown;
  updates?: unknown;
};

export type SharedSyncDeclarationPatchResult = {
  updated: number;
  totalStored: number;
  skippedKeys: string[];
};

export async function patchSharedSyncDeclarations(
  persistence: RuntimePersistence,
  updates: readonly SharedSyncDeclarationUpdate[],
  actor: DeclarationActor,
): Promise<SharedSyncDeclarationPatchResult> {
  const currentRows = await persistence.declarationsReader.readDeclarationRows();
  const rows = Array.isArray(currentRows) ? currentRows : [];
  const rowsByKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = createDeclarationRowKey(
      (row as Record<string, unknown>)?.so_tk,
      (row as Record<string, unknown>)?.nhanh ?? (row as Record<string, unknown>)?.branch,
    );
    if (key) {
      rowsByKey.set(key, row as Record<string, unknown>);
    }
  }

  let updated = 0;
  const skippedKeys: string[] = [];
  const patchEntries: DeclarationBatchPatchEntry[] = [];

  for (const entry of Array.isArray(updates) ? updates : []) {
    const key = typeof entry?.key === 'string' ? entry.key.trim() : '';
    if (!key) {
      continue;
    }

    const current = rowsByKey.get(key);
    if (!current) {
      skippedKeys.push(key);
      continue;
    }

    const normalizedPatch = normalizeDeclarationPatch(
      entry?.updates && typeof entry.updates === 'object' && !Array.isArray(entry.updates)
        ? (entry.updates as Record<string, unknown>)
        : null,
    );
    if (normalizedPatch.requestedFields.length === 0) {
      skippedKeys.push(key);
      continue;
    }

    patchEntries.push({
      target: buildDeclarationTarget(key, current),
      normalizedPatch,
    });
  }

  if (patchEntries.length === 0) {
    return {
      updated,
      totalStored: rows.length,
      skippedKeys,
    };
  }

  const store = persistence.declarationsStore as DeclarationsStore & {
    patchDeclarationsBatch?: (
      entries: readonly DeclarationBatchPatchEntry[],
      actor: DeclarationActor,
    ) => Promise<DeclarationBatchPatchResult[]>;
  };

  if (typeof store.patchDeclarationsBatch === 'function') {
    const batchResults = await store.patchDeclarationsBatch(patchEntries, actor);
    for (const result of Array.isArray(batchResults) ? batchResults : []) {
      rowsByKey.set(result.key, result.nextRecord);
      updated += 1;
    }
  } else {
    for (const entry of patchEntries) {
      const nextRecord = await persistence.declarationsStore.patchDeclaration(
        entry.target,
        entry.normalizedPatch,
        actor,
      );
      rowsByKey.set(entry.target.key, nextRecord);
      updated += 1;
    }
  }

  return {
    updated,
    totalStored: rows.length,
    skippedKeys,
  };
}

function buildDeclarationTarget(key: string, current: Record<string, unknown>): DeclarationStoreTarget {
  return {
    id: `${current.declaration_id ?? current.id ?? key}`,
    key,
    declarationId:
      typeof current.declaration_id === 'string'
        ? current.declaration_id
        : typeof current.id === 'string'
          ? current.id
          : null,
    soTk: `${current.so_tk ?? current.declaration_no ?? ''}`,
    nhanh: `${current.nhanh ?? current.branch ?? current.branch_code ?? ''}`,
    current,
  };
}
