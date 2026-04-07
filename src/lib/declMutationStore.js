import {
  applyPartialUpdatesToRow as defaultApplyPartialUpdatesToRow,
  getDeclRowSimpleKey as defaultGetDeclRowSimpleKey,
  sanitizePartialDeclUpdates as defaultSanitizePartialDeclUpdates,
} from "./declMutationHelpers.js";
import { normalizeStr as defaultNormalizeStr } from "./storeCoreHelpers.js";

export function createDeclMutationStore({
  normalizeStr = defaultNormalizeStr,
  getDeclRowsRaw = () => [],
  getDeclRowSimpleKey = defaultGetDeclRowSimpleKey,
  sanitizePartialDeclUpdates = defaultSanitizePartialDeclUpdates,
  applyPartialUpdatesToRow = defaultApplyPartialUpdatesToRow,
  patchDeclRows = async () => {},
  applyAgenciesToDeclRows = (rows) => (Array.isArray(rows) ? rows : []),
  updateCachedItem = () => {},
  declKey = "",
  pushAuditLog = () => {},
  pushImportLog = () => {},
  persistAndAnnotateDeclRows = (rows) => rows,
  writeDeclRows = (rows) => rows,
  buildDeclHistoryChanges = () => [],
  appendDeclHistoryEntry = () => null,
  buildDeletedDeclLogEntryFromRow = () => null,
  appendDeletedDeclLogEntries = () => {},
} = {}) {
  function normalizeKeyList(keys) {
    return Array.isArray(keys)
      ? keys.map((key) => String(key || "").trim()).filter(Boolean)
      : [];
  }

  async function saveDeclRowDiffs(
    deltas,
    { actor = "system", detail = "", allowReviewedOverride = false } = {},
  ) {
    const list = Array.isArray(deltas) ? deltas : [];
    const total = list.length;

    const rows = getDeclRowsRaw();
    const totalStored = Array.isArray(rows) ? rows.length : 0;

    if (!total || !Array.isArray(rows) || rows.length === 0) {
      return {
        success: false,
        total,
        updated: 0,
        locked: 0,
        missing: total,
        noChange: 0,
        invalid: 0,
        totalStored,
        lockedKeys: [],
        missingKeys: list.map((item) => (item && typeof item.key === "string" ? item.key : "")),
        noChangeKeys: [],
        invalidKeys: [],
      };
    }

    const actorName = normalizeStr(actor) || "system";
    const indexByKey = new Map();
    rows.forEach((row, idx) => {
      const key = getDeclRowSimpleKey(row);
      if (key) {
        indexByKey.set(key, idx);
      }
    });

    const lockedKeys = [];
    const missingKeys = [];
    const noChangeKeys = [];
    const invalidKeys = [];
    const changeRecords = [];

    for (const entry of list) {
      const key = typeof entry?.key === "string" ? entry.key.trim() : String(entry?.key || "").trim();
      if (!key) {
        invalidKeys.push("");
        continue;
      }
      const updates = entry && typeof entry === "object" ? entry.updates : null;
      const sanitizedUpdates = sanitizePartialDeclUpdates(updates);
      const changedFields = Object.keys(sanitizedUpdates);
      if (changedFields.length === 0) {
        noChangeKeys.push(key);
        continue;
      }
      const index = indexByKey.has(key) ? indexByKey.get(key) : -1;
      if (typeof index !== "number" || index < 0) {
        missingKeys.push(key);
        continue;
      }
      const current = rows[index] || {};
      if (current?.reviewed && !allowReviewedOverride) {
        lockedKeys.push(key);
        const actionDetail =
          detail && detail.trim().length > 0
            ? detail
            : `Chặn cập nhật tờ khai ${current.so_tk || "?"} do đã rà soát`;
        pushAuditLog({
          actor: actorName,
          action: "decl.update.blocked",
          detail: actionDetail,
          meta: { key, fields: changedFields, reason: "review lock" },
        });
        continue;
      }
      const { changed, nextRow } = applyPartialUpdatesToRow(current, sanitizedUpdates, {
        sanitized: true,
      });
      if (!changed) {
        noChangeKeys.push(key);
        continue;
      }
      changeRecords.push({
        key,
        index,
        updates: sanitizedUpdates,
        changedFields,
        previous: current,
        nextRow,
      });
    }

    if (!changeRecords.length) {
      return {
        success: false,
        total,
        updated: 0,
        locked: lockedKeys.length,
        missing: missingKeys.length,
        noChange: noChangeKeys.length,
        invalid: invalidKeys.length,
        totalStored,
        lockedKeys,
        missingKeys,
        noChangeKeys,
        invalidKeys,
      };
    }

    const nextRows = rows.slice();
    for (const record of changeRecords) {
      nextRows[record.index] = record.nextRow;
    }

    const annotatedRows = applyAgenciesToDeclRows(nextRows);
    const patchPayload = [];
    const historyQueue = [];

    for (const record of changeRecords) {
      const finalRow = annotatedRows[record.index] || record.nextRow;
      patchPayload.push({ key: record.key, updates: record.updates, row: finalRow });
      const historyChanges = buildDeclHistoryChanges(record.previous, finalRow, record.changedFields);
      if (historyChanges.length) {
        historyQueue.push({ key: record.key, changes: historyChanges });
      }
    }

    const summaryDetail =
      detail && detail.trim().length > 0
        ? detail.trim()
        : `Cập nhật ${changeRecords.length.toLocaleString("vi-VN")} tờ khai (patch)`;

    await patchDeclRows(patchPayload, {
      actor: actorName,
      detail: summaryDetail,
    });

    for (const entry of historyQueue) {
      appendDeclHistoryEntry(entry.key, {
        actor: actorName,
        ts: new Date().toISOString(),
        changes: entry.changes,
      });
    }

    updateCachedItem(declKey, JSON.stringify(annotatedRows));

    pushAuditLog({
      actor: actorName,
      action: "decl.patch",
      detail: summaryDetail,
      meta: {
        total,
        updated: changeRecords.length,
        locked: lockedKeys.length,
        missing: missingKeys.length,
      },
    });

    return {
      success: true,
      total,
      updated: changeRecords.length,
      locked: lockedKeys.length,
      missing: missingKeys.length,
      noChange: noChangeKeys.length,
      invalid: invalidKeys.length,
      totalStored: annotatedRows.length,
      lockedKeys,
      missingKeys,
      noChangeKeys,
      invalidKeys,
    };
  }

  function updateDeclRowFields(
    rowKey,
    updates,
    { actor = "system", detail = "", allowReviewedOverride = false } = {},
  ) {
    const key = typeof rowKey === "string" ? rowKey.trim() : String(rowKey || "").trim();

    if (!key) {
      return { success: false, reason: "invalid-key" };
    }

    const rows = getDeclRowsRaw();

    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, reason: "empty" };
    }

    const index = rows.findIndex((row) => getDeclRowSimpleKey(row) === key);

    if (index === -1) {
      return { success: false, reason: "not-found" };
    }

    const current = rows[index] || {};
    const sanitizedUpdates = sanitizePartialDeclUpdates(updates);
    const changedFields = Object.keys(sanitizedUpdates);

    if (changedFields.length === 0) {
      return { success: false, reason: "no-change" };
    }

    if (current?.reviewed && !allowReviewedOverride) {
      const actorName = normalizeStr(actor) || "system";
      const actionDetail =
        detail && detail.trim().length > 0
          ? detail
          : `Chặn cập nhật tờ khai ${current.so_tk || "?"} do đã rà soát`;

      pushAuditLog({
        actor: actorName,
        action: "decl.update.blocked",
        detail: actionDetail,
        meta: { key, fields: changedFields, reason: "review lock" },
      });

      return { success: false, reason: "review-locked" };
    }

    const { changed, nextRow } = applyPartialUpdatesToRow(current, sanitizedUpdates, {
      sanitized: true,
    });

    if (!changed) {
      return { success: false, reason: "no-change" };
    }

    const nextRows = rows.slice();
    nextRows[index] = nextRow;
    const stored = persistAndAnnotateDeclRows(nextRows);
    const updated = stored[index] || nextRow;

    const actorName = normalizeStr(actor) || "system";
    const actionDetail =
      detail && detail.trim().length > 0
        ? detail
        : `Cập nhật ${changedFields.join(", ")} của tờ khai ${current.so_tk || "?"}`;

    const historyChanges = buildDeclHistoryChanges(current, updated, changedFields);
    const historyEntry = historyChanges.length
      ? appendDeclHistoryEntry(key, {
          actor: actorName,
          ts: new Date().toISOString(),
          changes: historyChanges,
        })
      : null;

    pushAuditLog({
      actor: actorName,
      action: "decl.update.partial",
      detail: actionDetail,
      meta: historyEntry
        ? { key, fields: changedFields, historyEntryId: historyEntry.id }
        : { key, fields: changedFields },
    });

    return { success: true, row: updated };
  }

  function softDeleteDeclRows(keys, { actor = "system", detail = "" } = {}) {
    const list = normalizeKeyList(keys);
    if (list.length === 0) {
      return { deleted: 0, alreadyDeleted: 0, missing: 0, keys: [], alreadyDeletedKeys: [], missingKeys: list };
    }

    const actorName = normalizeStr(actor) || "system";
    const timestamp = new Date().toISOString();
    const rows = getDeclRowsRaw();
    const keySet = new Set(list);
    const seenKeys = new Set();
    const deletedKeys = [];
    const alreadyDeletedKeys = [];
    let deleted = 0;
    let alreadyDeleted = 0;
    const logEntries = [];

    const nextRows = rows.map((row) => {
      if (!row || typeof row !== "object") {
        return row;
      }
      const key = getDeclRowSimpleKey(row);
      if (!keySet.has(key)) {
        return row;
      }
      seenKeys.add(key);
      if (row.deleted_at) {
        alreadyDeleted += 1;
        alreadyDeletedKeys.push(key);
        return row;
      }
      deleted += 1;
      deletedKeys.push(key);
      const logEntry = buildDeletedDeclLogEntryFromRow(row, {
        actor: actorName,
        type: "soft",
        timestamp,
      });
      if (logEntry) {
        logEntries.push(logEntry);
      }
      return {
        ...row,
        deleted_at: timestamp,
        deleted_by: actorName,
      };
    });

    const missingKeys = list.filter((key) => !seenKeys.has(key));

    if (deleted > 0) {
      if (logEntries.length > 0) {
        appendDeletedDeclLogEntries(logEntries);
      }
      persistAndAnnotateDeclRows(nextRows);
      const actionDetail =
        detail && detail.trim().length > 0
          ? detail
          : `Đánh dấu xóa ${deleted.toLocaleString("vi-VN")} tờ khai từ giao diện Import Data`;
      pushAuditLog({
        actor: actorName,
        action: "decl.delete.soft",
        detail: actionDetail,
        meta: { count: deleted, keys: deletedKeys.slice() },
      });
      pushImportLog({
        actor: actorName,
        kind: "warn",
        message: actionDetail,
        meta: { count: deleted, keys: deletedKeys.slice() },
      });
    }

    return {
      deleted,
      alreadyDeleted,
      missing: missingKeys.length,
      keys: deletedKeys,
      alreadyDeletedKeys,
      missingKeys,
    };
  }

  function hardDeleteDeclRows(keys, { actor = "system", detail = "" } = {}) {
    const list = normalizeKeyList(keys);
    if (list.length === 0) {
      return { removed: 0, missing: 0, keys: [], missingKeys: list };
    }

    const actorName = normalizeStr(actor) || "system";
    const timestamp = new Date().toISOString();
    const rows = getDeclRowsRaw();
    const keySet = new Set(list);
    const seenKeys = new Set();
    const removedKeys = [];
    const logEntries = [];

    const nextRows = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        nextRows.push(row);
        continue;
      }
      const key = getDeclRowSimpleKey(row);
      if (!keySet.has(key)) {
        nextRows.push(row);
        continue;
      }
      seenKeys.add(key);
      removedKeys.push(key);
      const logEntry = buildDeletedDeclLogEntryFromRow(row, {
        actor: actorName,
        type: "hard",
        timestamp: normalizeStr(row.deleted_at) || timestamp,
      });
      if (logEntry) {
        logEntries.push(logEntry);
      }
    }

    const removed = removedKeys.length;
    const missingKeys = list.filter((key) => !seenKeys.has(key));

    if (removed > 0) {
      if (logEntries.length > 0) {
        appendDeletedDeclLogEntries(logEntries);
      }
      persistAndAnnotateDeclRows(nextRows);
      const actionDetail =
        detail && detail.trim().length > 0
          ? detail
          : `Xóa vĩnh viễn ${removed.toLocaleString("vi-VN")} tờ khai từ giao diện Import Data`;
      pushAuditLog({
        actor: actorName,
        action: "decl.delete.hard",
        detail: actionDetail,
        meta: { count: removed, keys: removedKeys.slice() },
      });
      pushImportLog({
        actor: actorName,
        kind: "error",
        message: actionDetail,
        meta: { count: removed, keys: removedKeys.slice() },
      });
    }

    return {
      removed,
      missing: missingKeys.length,
      keys: removedKeys,
      missingKeys,
    };
  }

  function restoreDeclRows(keys, { actor = "system", detail = "" } = {}) {
    const list = normalizeKeyList(keys);
    if (list.length === 0) {
      return { restored: 0, skipped: 0, failed: 0, restoredKeys: [], skippedKeys: [], failedKeys: [] };
    }

    const actorName = normalizeStr(actor) || "system";
    const baseDetail =
      detail && detail.trim().length > 0
        ? detail.trim()
        : "Khôi phục trạng thái xóa mềm từ giao diện Import Data";
    const restoredKeys = [];
    const skippedKeys = [];
    const failed = [];

    for (const key of list) {
      const result = updateDeclRowFields(
        key,
        { deleted_at: null, deleted_by: null },
        { actor: actorName, detail: baseDetail, allowReviewedOverride: true },
      );

      if (result.success) {
        restoredKeys.push(key);
      } else if (result.reason === "no-change") {
        skippedKeys.push(key);
      } else {
        failed.push({ key, reason: result.reason });
      }
    }

    const restored = restoredKeys.length;

    if (restored > 0) {
      const message = baseDetail.includes("Khôi phục")
        ? `${baseDetail} (${restored.toLocaleString("vi-VN")} tờ khai)`
        : `${baseDetail} - khôi phục ${restored.toLocaleString("vi-VN")} tờ khai`;
      pushImportLog({
        actor: actorName,
        kind: "info",
        message,
        meta: { count: restored, keys: restoredKeys.slice() },
      });
    }

    return {
      restored,
      skipped: skippedKeys.length,
      failed: failed.length,
      restoredKeys,
      skippedKeys,
      failedKeys: failed,
    };
  }

  function markDeclRowsReviewed(keys, { actor = "system", note = "Đánh dấu rà soát" } = {}) {
    const list = normalizeKeyList(keys);
    if (list.length === 0) {
      return 0;
    }

    const keySet = new Set(list);
    const actorName = normalizeStr(actor) || "system";
    const timestamp = new Date().toISOString();
    const rows = getDeclRowsRaw();
    let changed = 0;

    const nextRows = rows.map((row) => {
      if (!row || typeof row !== "object") return row;
      const key = getDeclRowSimpleKey(row);
      if (!keySet.has(key)) {
        return row;
      }
      if (row.reviewed && row.reviewed_by && row.reviewed_at) {
        return row;
      }
      changed += 1;
      return {
        ...row,
        reviewed: true,
        reviewed_by: actorName,
        reviewed_at: timestamp,
      };
    });

    if (changed === 0) {
      return 0;
    }

    writeDeclRows(nextRows);

    pushAuditLog({
      actor: actorName,
      action: "decl.review",
      detail: `${note} ${changed} tờ khai`,
      meta: { count: changed },
    });

    return changed;
  }

  function unmarkDeclRowsReviewed(keys, { actor = "system", note = "Bỏ đánh dấu rà soát" } = {}) {
    const list = normalizeKeyList(keys);
    if (list.length === 0) {
      return 0;
    }

    const keySet = new Set(list);
    const actorName = normalizeStr(actor) || "system";
    const rows = getDeclRowsRaw();
    let changed = 0;

    const nextRows = rows.map((row) => {
      if (!row || typeof row !== "object") return row;
      const key = getDeclRowSimpleKey(row);
      if (!keySet.has(key)) {
        return row;
      }
      if (!row.reviewed) {
        return row;
      }
      changed += 1;
      const next = { ...row };
      delete next.reviewed;
      delete next.reviewed_at;
      delete next.reviewed_by;
      return next;
    });

    if (changed === 0) {
      return 0;
    }

    writeDeclRows(nextRows);

    pushAuditLog({
      actor: actorName,
      action: "decl.unreview",
      detail: `${note} ${changed} tờ khai`,
      meta: { count: changed },
    });

    return changed;
  }

  return {
    saveDeclRowDiffs,
    updateDeclRowFields,
    softDeleteDeclRows,
    hardDeleteDeclRows,
    restoreDeclRows,
    markDeclRowsReviewed,
    unmarkDeclRowsReviewed,
  };
}
