/**
 * @deprecated Legacy alerts domain — retained for backward compatibility.
 * Migration tracked under CQ-007.
 */
export const DEFAULT_ALERT_CONFIG = {
  enabled: true,
  thresholdDays: 2,
  autoResolveReviewed: true,
  channel: 'audit',
};

export const DEFAULT_ALERT_STATE = {
  entries: {},
  lastEvaluatedAt: null,
};

export function createLegacyAlertsDomain({
  getJSONValue,
  setJSONValue,
  getDeclRows,
  getDeclarationKey,
  writeDeclRows,
  pushAuditLog,
  pushNotification,
  normalizeStr,
}) {
  function getAlertConfig() {
    const stored = getJSONValue('decl_alert_config_v1', DEFAULT_ALERT_CONFIG);
    return { ...DEFAULT_ALERT_CONFIG, ...stored };
  }

  function saveAlertConfig(config) {
    const next = { ...getAlertConfig(), ...(config || {}) };
    setJSONValue('decl_alert_config_v1', next);
    return next;
  }

  function getAlertState() {
    const stored = getJSONValue('decl_alert_state_v1', DEFAULT_ALERT_STATE);
    const entries = stored?.entries && typeof stored.entries === 'object' ? stored.entries : {};
    return {
      entries,
      lastEvaluatedAt: stored?.lastEvaluatedAt || null,
    };
  }

  function saveAlertState(state) {
    const normalized = {
      entries: state?.entries && typeof state.entries === 'object' ? state.entries : {},
      lastEvaluatedAt: state?.lastEvaluatedAt || new Date().toISOString(),
    };
    setJSONValue('decl_alert_state_v1', normalized);
    return normalized;
  }

  function markDeclarationsReviewed(keys, { actor = 'system' } = {}) {
    if (!Array.isArray(keys) || keys.length === 0) return 0;
    const keySet = new Set(keys);
    let updatedCount = 0;

    const nextRows = getDeclRows().map((row) => {
      const key = getDeclarationKey(row);
      if (!keySet.has(key)) return row;
      if (row?.reviewed) return row;
      updatedCount += 1;
      return {
        ...row,
        reviewed: true,
        reviewed_at: new Date().toISOString(),
      };
    });

    if (updatedCount > 0) {
      writeDeclRows(nextRows);
      pushAuditLog({
        actor,
        action: 'decl.review',
        detail: `Đánh dấu đã rà soát ${updatedCount} tờ khai`,
        meta: { keys: Array.from(keySet) },
      });
      pushNotification({
        type: 'import.alerts.reviewed',
        severity: 'info',
        title: 'Đánh dấu đã rà soát tờ khai',
        message: `Đã cập nhật trạng thái cho ${updatedCount} tờ khai.`,
        meta: { actor, count: updatedCount },
      });
    }

    return updatedCount;
  }

  function unmarkDeclarationsReviewed(keys, { actor = 'system' } = {}) {
    if (!Array.isArray(keys) || keys.length === 0) return 0;
    const keySet = new Set(keys);
    let updatedCount = 0;

    const nextRows = getDeclRows().map((row) => {
      const key = getDeclarationKey(row);
      if (!keySet.has(key)) return row;
      if (!row?.reviewed) return row;
      updatedCount += 1;
      const next = { ...row };
      delete next.reviewed;
      delete next.reviewed_at;
      delete next.reviewed_by;
      return next;
    });

    if (updatedCount > 0) {
      writeDeclRows(nextRows);
      pushAuditLog({
        actor,
        action: 'decl.unreview',
        detail: `Bo danh dau da ra soat ${updatedCount} to khai`,
        meta: { keys: Array.from(keySet) },
      });
      pushNotification({
        type: 'import.alerts.unreviewed',
        severity: 'info',
        title: 'Bo danh dau da ra soat',
        message: `Da bo khoa ${updatedCount} to khai.`,
        meta: { actor, count: updatedCount },
      });
    }

    return updatedCount;
  }

  function evaluateDeclarationAlerts({ actor = 'system', reason = 'auto' } = {}) {
    const config = getAlertConfig();
    const state = getAlertState();
    const previousOutstanding = Object.values(state.entries || {}).filter(
      (entry) => entry && entry.resolved !== true,
    ).length;
    const entries = state.entries;

    if (!config.enabled) {
      return { total: getDeclRows().length, outstanding: 0, triggered: 0 };
    }

    const rows = getDeclRows();
    const thresholdDays = Number.isFinite(Number(config.thresholdDays)) ? Number(config.thresholdDays) : 0;
    const thresholdMs = Math.max(0, thresholdDays) * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const seenKeys = new Set();
    let triggered = 0;

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const soTk = (row.so_tk ?? '').toString();
      const key = `${soTk}_${normalizeStr(row.nhanh || '')}`;
      seenKeys.add(key);

      const hasStaff = !!normalizeStr(row.nhan_vien);
      const hasTeam = !!normalizeStr(row.team);
      const reviewed = !!row.reviewed;

      if ((hasStaff && hasTeam) || (reviewed && config.autoResolveReviewed !== false)) {
        if (entries[key]) {
          entries[key].resolved = true;
          entries[key].resolvedAt = nowIso;
        }
        continue;
      }

      const missing = [];
      if (!hasStaff) missing.push('nhân viên');
      if (!hasTeam) missing.push('tổ đội');
      if (!missing.length) continue;

      const dateISO = row.date || row.raw_date || '';
      const ts = dateISO ? new Date(dateISO).getTime() : Number.NaN;
      const overdue = Number.isNaN(ts) ? true : now - ts >= thresholdMs;
      if (!overdue) {
        continue;
      }

      const existing = entries[key] || {};
      const lastAlertAtTs = existing.lastAlertAt ? new Date(existing.lastAlertAt).getTime() : 0;
      const shouldAlert = !existing.lastAlertAt || now - lastAlertAtTs >= 60 * 60 * 1000;

      entries[key] = {
        key,
        so_tk: soTk,
        mst: normalizeStr(row.mst || ''),
        company: normalizeStr(row.cong_ty || ''),
        date: dateISO,
        team: row.team || '',
        staff: row.nhan_vien || '',
        missing,
        firstDetected: existing.firstDetected || nowIso,
        lastUpdated: nowIso,
        lastAlertAt: shouldAlert ? nowIso : existing.lastAlertAt,
        resolved: false,
      };

      if (shouldAlert) {
        triggered += 1;
        if (config.channel === 'audit') {
          pushAuditLog({
            actor,
            action: 'decl.alert',
            detail: `Tờ khai ${soTk} thiếu ${missing.join(' & ')}`,
            meta: {
              mst: row.mst || '',
              company: row.cong_ty || '',
              reason,
            },
          });
        }
      }
    }

    for (const key of Object.keys(entries)) {
      if (!seenKeys.has(key)) {
        delete entries[key];
        continue;
      }
      const entry = entries[key];
      if (!entry) continue;
      if (entry.resolved) continue;
      if (!entry.missing || entry.missing.length === 0) {
        entry.resolved = true;
        entry.resolvedAt = nowIso;
      }
    }

    if (config.autoResolveReviewed !== false) {
      for (const key of Object.keys(entries)) {
        const entry = entries[key];
        if (entry?.resolved) {
          delete entries[key];
        }
      }
    }

    const outstanding = Object.values(entries).filter((entry) => entry && entry.resolved !== true).length;
    saveAlertState({ entries, lastEvaluatedAt: nowIso });
    const summary = { total: rows.length, outstanding, triggered };

    if (triggered > 0) {
      pushNotification({
        type: 'import.alerts.triggered',
        severity: 'warning',
        title: `${triggered} cảnh báo dữ liệu tờ khai`,
        message: `Có ${triggered} tờ khai thiếu thông tin cần xử lý (${reason}).`,
        meta: {
          actor,
          reason,
          triggered,
          outstanding,
        },
      });
    } else if (previousOutstanding > 0 && outstanding === 0) {
      pushNotification({
        type: 'import.alerts.cleared',
        severity: 'success',
        title: 'Đã xử lý toàn bộ cảnh báo tờ khai',
        message: 'Tất cả cảnh báo thiếu thông tin đã được giải quyết.',
        meta: { actor, reason },
      });
    }

    return summary;
  }

  function formatAlertEntries(entries) {
    return Object.values(entries || {})
      .map((entry) => ({
        key: entry.key,
        so_tk: entry.so_tk,
        mst: entry.mst,
        company: entry.company,
        date: entry.date,
        team: entry.team,
        staff: entry.staff,
        missing: entry.missing,
        firstDetected: entry.firstDetected,
        lastUpdated: entry.lastUpdated,
        lastAlertAt: entry.lastAlertAt,
        resolved: entry.resolved || false,
        resolvedAt: entry.resolvedAt || null,
      }))
      .sort((a, b) => {
        const timeA = a.lastAlertAt ? new Date(a.lastAlertAt).getTime() : 0;
        const timeB = b.lastAlertAt ? new Date(b.lastAlertAt).getTime() : 0;
        return timeB - timeA;
      });
  }

  function buildAlertPayload() {
    const config = getAlertConfig();
    const state = getAlertState();
    const alerts = formatAlertEntries(state.entries);
    const outstanding = alerts.filter((alert) => !alert.resolved).length;
    return {
      config,
      alerts,
      summary: {
        outstanding,
        totalTracked: alerts.length,
        lastEvaluatedAt: state.lastEvaluatedAt,
      },
    };
  }

  return {
    getAlertConfig,
    saveAlertConfig,
    getAlertState,
    saveAlertState,
    markDeclarationsReviewed,
    unmarkDeclarationsReviewed,
    evaluateDeclarationAlerts,
    formatAlertEntries,
    buildAlertPayload,
  };
}
