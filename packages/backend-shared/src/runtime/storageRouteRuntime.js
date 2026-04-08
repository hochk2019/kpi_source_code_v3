function getDeclRowSimpleKey(row) {
  if (!row || typeof row !== 'object') {
    return '';
  }

  const soTk = (row.so_tk ?? '').toString();
  const nhanh = (row.nhanh ?? '').toString();
  return `${soTk}_${nhanh}`.trim();
}

export function createStorageRouteRuntime({
  getValue,
  upsertValue,
  deleteValue,
  safeParse,
  evaluateDeclarationAlerts,
  refreshEcusSchedule,
  applyCoCodeConfig,
  getCoCodeConfig,
  refreshCoDiscrepancySchedule,
  defaultCoCodeConfig,
}) {
  return {
    putStorageValue(key, value, { actor = 'system', source = 'api' } = {}) {
      if (value === null || value === undefined) {
        deleteValue(key, { actor, source });
      } else {
        upsertValue(key, value, { actor, source });
      }

      if (key === 'decl_rows_v1') {
        evaluateDeclarationAlerts({ actor, reason: 'storage-put' });
      }

      if (key === 'ecus_sync_config_v1') {
        refreshEcusSchedule();
      }

      if (key === 'co_tax_code_config_v1') {
        applyCoCodeConfig(getCoCodeConfig());
      }

      if (key === 'co_discrepancy_config_v1') {
        refreshCoDiscrepancySchedule();
      }

      return { ok: true };
    },

    patchDeclarationRows(updates, { actor = 'system', source = 'api-patch' } = {}) {
      const rawValue = getValue('decl_rows_v1') ?? '[]';
      const rows = safeParse(rawValue, []);

      if (!Array.isArray(rows)) {
        return {
          ok: false,
          invalidCurrentData: true,
        };
      }

      const indexByKey = new Map();
      rows.forEach((row, idx) => {
        const rowKey = getDeclRowSimpleKey(row);
        if (rowKey) {
          indexByKey.set(rowKey, idx);
        }
      });

      let updated = 0;
      for (const entry of updates) {
        const rowKey = typeof entry?.key === 'string' ? entry.key.trim() : '';
        const nextRow = entry && typeof entry.row === 'object' && entry.row !== null ? entry.row : null;
        if (!rowKey || !nextRow) {
          continue;
        }

        const index = indexByKey.has(rowKey) ? indexByKey.get(rowKey) : -1;
        if (typeof index !== 'number' || index < 0) {
          continue;
        }

        rows[index] = nextRow;
        updated += 1;
      }

      if (!updated) {
        return {
          ok: true,
          updated: 0,
          totalStored: rows.length,
        };
      }

      upsertValue('decl_rows_v1', JSON.stringify(rows), { actor, source });
      evaluateDeclarationAlerts({ actor, reason: 'storage-patch' });

      return {
        ok: true,
        updated,
        totalStored: rows.length,
      };
    },

    deleteStorageValue(key, { actor = 'system', source = 'api-delete' } = {}) {
      deleteValue(key, { actor, source });

      if (key === 'co_tax_code_config_v1') {
        applyCoCodeConfig(defaultCoCodeConfig);
      }

      if (key === 'co_discrepancy_config_v1') {
        refreshCoDiscrepancySchedule();
      }

      return { ok: true };
    },
  };
}
