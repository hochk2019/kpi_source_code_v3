function toNormalizedList(normalizeEcusTaxCodeList, value) {
  if (typeof normalizeEcusTaxCodeList === 'function') {
    return normalizeEcusTaxCodeList(value);
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => `${entry ?? ''}`.trim()).filter(Boolean);
}

function normalizeText(normalizeStr, value, fallback = '') {
  if (typeof normalizeStr === 'function') {
    const normalized = normalizeStr(value);
    return normalized || fallback;
  }
  const trimmed = `${value ?? ''}`.trim();
  return trimmed || fallback;
}

function buildTaxCodeSets({
  config,
  options,
  normalizeEcusTaxCodeList,
}) {
  const includeList = toNormalizedList(
    normalizeEcusTaxCodeList,
    options?.includeTaxCodes ?? config?.includeTaxCodes,
  );
  const excludeList = toNormalizedList(
    normalizeEcusTaxCodeList,
    options?.excludeTaxCodes ?? config?.excludeTaxCodes,
  );
  return {
    includeList,
    excludeList,
    includeSet: new Set(includeList),
    excludeSet: new Set(excludeList),
  };
}

function prepareMappedRows({
  rawRows,
  config,
  context,
  includeSet,
  excludeSet,
  shouldSkipByMst,
  mapEcusRow,
}) {
  const prepared = [];
  for (const rawRow of Array.isArray(rawRows) ? rawRows : []) {
    if (typeof shouldSkipByMst === 'function' && shouldSkipByMst(rawRow, includeSet, excludeSet)) {
      prepared.push({ skipped: true, reason: 'mst-filtered', rawRow });
      continue;
    }
    const mappedRow = typeof mapEcusRow === 'function' ? mapEcusRow(rawRow, config, context) : rawRow;
    if (!mappedRow) {
      prepared.push({ skipped: true, reason: 'invalid-row', rawRow });
      continue;
    }
    prepared.push({ skipped: false, rawRow, mappedRow });
  }
  return prepared;
}

function buildExistingMap(rows, getDeclarationKey) {
  const byKey = new Map();
  const indexedRows = Array.isArray(rows) ? rows.slice() : [];
  indexedRows.forEach((row, index) => {
    byKey.set(getDeclarationKey(row), { row, index });
  });
  return { indexedRows, byKey };
}

function summarizePreviewRows({
  preparedRows,
  existingByKey,
  getDeclarationKey,
  mergeDeclarationRow,
}) {
  const rows = [];
  for (const prepared of preparedRows) {
    if (prepared.skipped) {
      continue;
    }
    const key = getDeclarationKey(prepared.mappedRow);
    const existing = existingByKey.get(key)?.row ?? null;
    const mergeResult = existing && typeof mergeDeclarationRow === 'function'
      ? mergeDeclarationRow(existing, prepared.mappedRow)
      : null;
    rows.push({
      ...prepared.mappedRow,
      status: existing ? 'existing' : 'new',
      locked: Boolean(mergeResult?.locked),
      changedFields: Array.isArray(mergeResult?.changedFields) ? mergeResult.changedFields : [],
    });
  }
  return rows;
}

function buildSuccessNotification(summary) {
  return {
    type: 'success',
    message: `ECUS bridge sync completed: ${summary.imported} imported, ${summary.updated} updated`,
    summary,
  };
}

export function createEcusBridgeMutations({
  getEcusConfig,
  computeRangeWindow,
  normalizeEcusTaxCodeList,
  buildEcusSyncContext,
  shouldSkipByMst,
  mapEcusRow,
  getDeclRows,
  getDeclarationKey,
  mergeDeclarationRow,
  writeDeclRows,
  ensureMSTEntriesForDeclRows,
  pushAuditLog,
  evaluateDeclarationAlerts,
  pushImportLog,
  saveEcusConfig,
  pushNotification,
  recordEcusMonitorSyncSuccess,
  recordEcusMonitorSyncFailure,
  normalizeStr,
} = {}) {
  if (typeof getEcusConfig !== 'function') {
    throw new Error('createEcusBridgeMutations requires getEcusConfig()');
  }
  if (typeof computeRangeWindow !== 'function') {
    throw new Error('createEcusBridgeMutations requires computeRangeWindow()');
  }
  if (typeof getDeclRows !== 'function') {
    throw new Error('createEcusBridgeMutations requires getDeclRows()');
  }
  if (typeof getDeclarationKey !== 'function') {
    throw new Error('createEcusBridgeMutations requires getDeclarationKey()');
  }
  if (typeof writeDeclRows !== 'function') {
    throw new Error('createEcusBridgeMutations requires writeDeclRows()');
  }

  async function previewFetchedRows(rawRows, options = {}) {
    const config = getEcusConfig() || {};
    const range = computeRangeWindow(config, options.rangeInput);
    const { includeList, excludeList, includeSet, excludeSet } = buildTaxCodeSets({
      config,
      options,
      normalizeEcusTaxCodeList,
    });
    const context = typeof buildEcusSyncContext === 'function'
      ? buildEcusSyncContext({
          ...config,
          includeTaxCodes: includeList,
          excludeTaxCodes: excludeList,
        })
      : {};
    const existingRows = getDeclRows() || [];
    const { byKey: existingByKey } = buildExistingMap(existingRows, getDeclarationKey);
    const preparedRows = prepareMappedRows({
      rawRows,
      config,
      context,
      includeSet,
      excludeSet,
      shouldSkipByMst,
      mapEcusRow,
    });
    const previewRows = summarizePreviewRows({
      preparedRows,
      existingByKey,
      getDeclarationKey,
      mergeDeclarationRow,
    });
    const previewLimit = Number(options.limit);
    const limited = Number.isFinite(previewLimit) && previewLimit > 0 && previewRows.length > previewLimit;
    return {
      rows: limited ? previewRows.slice(0, Math.floor(previewLimit)) : previewRows,
      totalFetched: previewRows.length,
      limited,
      range,
    };
  }

  async function commitFetchedRows(rawRows, options = {}) {
    const actor = normalizeText(normalizeStr, options.actor, 'bridge-service');
    const reason = normalizeText(normalizeStr, options.reason, 'manual');
    const runAt = new Date().toISOString();
    const config = getEcusConfig() || {};
    const range = computeRangeWindow(config, options.rangeInput);
    const { includeList, excludeList, includeSet, excludeSet } = buildTaxCodeSets({
      config,
      options,
      normalizeEcusTaxCodeList,
    });
    const context = typeof buildEcusSyncContext === 'function'
      ? buildEcusSyncContext({
          ...config,
          includeTaxCodes: includeList,
          excludeTaxCodes: excludeList,
        })
      : {};

    const preparedRows = prepareMappedRows({
      rawRows,
      config,
      context,
      includeSet,
      excludeSet,
      shouldSkipByMst,
      mapEcusRow,
    });

    const existingRows = getDeclRows() || [];
    const { indexedRows, byKey } = buildExistingMap(existingRows, getDeclarationKey);
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let reviewLocked = 0;

    try {
      for (const prepared of preparedRows) {
        if (prepared.skipped) {
          skipped += 1;
          continue;
        }

        const key = getDeclarationKey(prepared.mappedRow);
        const existingEntry = byKey.get(key);
        if (!existingEntry) {
          indexedRows.push(prepared.mappedRow);
          byKey.set(key, { row: prepared.mappedRow, index: indexedRows.length - 1 });
          imported += 1;
          continue;
        }

        const mergeResult = typeof mergeDeclarationRow === 'function'
          ? mergeDeclarationRow(existingEntry.row, prepared.mappedRow)
          : { row: { ...existingEntry.row, ...prepared.mappedRow }, changed: true, changedFields: [] };

        if (mergeResult?.locked) {
          reviewLocked += 1;
          continue;
        }

        const nextRow = mergeResult?.row || existingEntry.row;
        indexedRows[existingEntry.index] = nextRow;
        byKey.set(key, { row: nextRow, index: existingEntry.index });

        if (mergeResult?.changed) {
          updated += 1;
        } else {
          skipped += 1;
        }
      }

      writeDeclRows(indexedRows);
      if (typeof ensureMSTEntriesForDeclRows === 'function') {
        ensureMSTEntriesForDeclRows(indexedRows);
      }

      const fetched = Number.isFinite(Number(options.fetchedTotal))
        ? Number(options.fetchedTotal)
        : Array.isArray(rawRows)
          ? rawRows.length
          : 0;

      const summary = {
        fetched,
        imported,
        updated,
        skipped,
        reviewLocked,
        runAt,
        actor,
        reason,
        range,
      };

      const alerts = typeof evaluateDeclarationAlerts === 'function'
        ? evaluateDeclarationAlerts(indexedRows)
        : null;

      if (typeof saveEcusConfig === 'function') {
        saveEcusConfig({
          lastBridgeSyncAt: new Date().toISOString(),
          lastBridgeSyncRange: range,
          lastBridgeSyncActor: actor,
          lastBridgeSyncReason: reason,
          lastBridgeSyncSummary: summary,
        });
      }
      if (typeof pushAuditLog === 'function') {
        pushAuditLog({
          type: 'ecus-bridge-sync',
          actor,
          reason,
          summary,
        });
      }
      if (typeof pushImportLog === 'function') {
        pushImportLog({
          type: 'ecus-bridge-sync',
          actor,
          reason,
          summary,
          alerts,
        });
      }
      if (typeof pushNotification === 'function') {
        pushNotification(buildSuccessNotification(summary));
      }
      if (typeof recordEcusMonitorSyncSuccess === 'function') {
        recordEcusMonitorSyncSuccess({ runAt, actor });
      }

      return summary;
    } catch (error) {
      if (typeof recordEcusMonitorSyncFailure === 'function') {
        recordEcusMonitorSyncFailure(error, { actor, reason, range });
      }
      throw error;
    }
  }

  return {
    previewFetchedRows,
    commitFetchedRows,
  };
}
