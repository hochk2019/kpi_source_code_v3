import {
  normalizeDeclarationNumber as defaultNormalizeDeclarationNumber,
  normalizeStr as defaultNormalizeStr,
} from "./storeCoreHelpers.js";

export function createDeclWriteStore({
  normalizeStr = defaultNormalizeStr,
  normalizeDeclRows = (rows) => (Array.isArray(rows) ? rows : []),
  getDeclRowsRaw = () => [],
  getDeclarationKey = () => "",
  extractMSTFromDeclRow = () => "",
  extractCompanyNameFromDeclRow = () => "",
  extractEffectiveDateFromDeclRow = () => "",
  getMSTMap = () => [],
  upsertMSTRows = () => {},
  mstAssignmentStatusPending = "pending",
  persistAndAnnotateDeclRows = (rows) => rows,
  pushAuditLog = () => {},
  normalizeDeclarationNumber = defaultNormalizeDeclarationNumber,
  mergeDeclarationRowClient = (_existing, incoming) => incoming,
} = {}) {
  function computeMSTAdditionsForDeclRows(declRows) {
    const list = Array.isArray(declRows) ? declRows : [];
    if (!list.length) {
      return { existingRows: [], additions: [], loggedAdditions: [], total: 0 };
    }

    const existingRows = getMSTMap();
    const knownMSTs = new Set(existingRows.map((row) => row.mst));
    const additions = [];
    const seen = new Set();

    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const declKey = getDeclarationKey(row);
      if (!declKey) continue;

      const mst = extractMSTFromDeclRow(row);
      if (!mst || knownMSTs.has(mst) || seen.has(mst)) continue;

      additions.push({
        mst,
        company: extractCompanyNameFromDeclRow(row),
        person_import: "",
        person_export: "",
        team: "",
        effective_from: extractEffectiveDateFromDeclRow(row),
        effective_to: "",
        status: mstAssignmentStatusPending,
      });
      seen.add(mst);
    }

    const loggedAdditions = additions.map((item) => ({
      mst: item.mst,
      company: item.company,
      effective_from: item.effective_from,
    }));

    return {
      existingRows,
      additions,
      loggedAdditions,
      total: additions.length,
    };
  }

  function previewMSTEntriesForDeclRows(declRows) {
    const { loggedAdditions, total } = computeMSTAdditionsForDeclRows(declRows);
    return { additions: loggedAdditions, total };
  }

  async function ensureMSTEntriesForDeclRows(declRows, { actor = "system", dryRun = false } = {}) {
    const { existingRows, additions, loggedAdditions, total } = computeMSTAdditionsForDeclRows(declRows);

    if (!total) {
      return { additions: [], total: 0 };
    }

    if (dryRun) {
      return { additions: loggedAdditions, total };
    }

    const actorName = normalizeStr(actor) || "system";
    const merged = existingRows.concat(additions);
    const sample = additions
      .slice(0, 3)
      .map((item) => item.mst)
      .join(", ");
    const suffix = additions.length > 3 ? "…" : "";
    const detailSample = sample ? ` (${sample}${suffix})` : "";

    await upsertMSTRows(merged, {
      actor: actorName,
      detail: `Tự động thêm ${additions.length} MST mới từ dữ liệu tờ khai${detailSample}`,
    });

    return { additions: loggedAdditions, total };
  }

  function isEqualDeclValue(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i += 1) {
        if (!isEqualDeclValue(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }

    if (a && b && typeof a === "object" && typeof b === "object") {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys) {
        if (!isEqualDeclValue(a[key], b[key])) {
          return false;
        }
      }
      return true;
    }

    if (a === null || a === undefined) {
      return b === null || b === undefined;
    }

    if (b === null || b === undefined) {
      return false;
    }

    return Object.is(a, b);
  }

  function mergeDeclRowWithSummary(existing, incoming) {
    if (!existing) {
      return {
        row: incoming,
        changed: true,
        changedFields: Object.keys(incoming || {}),
        locked: false,
      };
    }

    if (existing?.reviewed && incoming?.__forceReviewedOverride !== true) {
      return { row: existing, changed: false, changedFields: [], locked: true };
    }

    const merged = mergeDeclarationRowClient(existing, incoming);
    const keys = new Set([...Object.keys(existing || {}), ...Object.keys(merged || {})]);
    const changedFields = [];
    for (const field of keys) {
      if (!isEqualDeclValue(existing?.[field], merged?.[field])) {
        changedFields.push(field);
      }
    }

    return {
      row: merged,
      changed: changedFields.length > 0,
      changedFields,
      locked: false,
    };
  }

  function buildImportLogEntry(row, changedFields = []) {
    if (!row || typeof row !== "object") return null;

    const soTk = normalizeDeclarationNumber(row.so_tk ?? row.so_tk_full ?? "");
    if (!soTk) return null;

    const full = (row.so_tk_full ?? row.so_tk ?? "").toString();
    const nhanh = normalizeStr(row.nhanh ?? row.branch ?? "");
    const entry = {
      so_tk: soTk,
      so_tk_full: full || undefined,
      nhanh: nhanh || undefined,
    };

    if (Array.isArray(changedFields) && changedFields.length) {
      const unique = Array.from(
        new Set(
          changedFields
            .map((field) => (field == null ? "" : String(field).trim()))
            .filter(Boolean),
        ),
      );
      if (unique.length) {
        entry.fields = unique;
      }
    }

    return entry;
  }

  function normalizeImportErrorRow(row, reason = "unknown") {
    if (!row || typeof row !== "object") {
      return { reason };
    }

    const soTk = normalizeDeclarationNumber(row.so_tk ?? row.so_tk_full ?? "");
    const nhanh = normalizeStr(row.nhanh ?? row.branch ?? "");
    const mst = extractMSTFromDeclRow(row) || "";
    const company = extractCompanyNameFromDeclRow(row) || "";

    return {
      reason,
      so_tk: soTk,
      nhanh,
      mst: mst || undefined,
      company: company || undefined,
    };
  }

  function computeDeclImportDiff(currentRows, normalizedIncoming, { sampleLimit = 20 } = {}) {
    const fallbackRows = [];
    const currentMap = new Map();

    for (const row of Array.isArray(currentRows) ? currentRows : []) {
      if (!row || typeof row !== "object") continue;
      const key = getDeclarationKey(row);
      if (!key) {
        fallbackRows.push(row);
        continue;
      }
      if (!currentMap.has(key)) {
        currentMap.set(key, row);
      }
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let locked = 0;
    const insertedDeclarations = [];
    const updatedDeclarations = [];
    const lockedDeclarations = [];
    const errorEntries = [];
    const insertedRows = [];
    const updatedRows = [];
    const lockedRows = [];

    for (const row of normalizedIncoming) {
      const key = getDeclarationKey(row);
      if (!key) {
        errorEntries.push(normalizeImportErrorRow(row, "missing-key"));
        continue;
      }

      const existing = currentMap.get(key);
      if (!existing) {
        currentMap.set(key, row);
        inserted += 1;
        insertedRows.push(row);
        const entry = buildImportLogEntry(row);
        if (entry) {
          insertedDeclarations.push(entry);
        }
        continue;
      }

      const {
        row: mergedRow,
        changed,
        changedFields,
        locked: isLocked,
      } = mergeDeclRowWithSummary(existing, row);

      if (isLocked) {
        locked += 1;
        lockedRows.push(existing);
        const entry = buildImportLogEntry(existing);
        if (entry) {
          lockedDeclarations.push(entry);
        }
        continue;
      }

      currentMap.set(key, mergedRow);
      if (changed) {
        updated += 1;
        updatedRows.push({ before: existing, after: mergedRow, changedFields });
        const entry = buildImportLogEntry(mergedRow, changedFields);
        if (entry) {
          updatedDeclarations.push(entry);
        }
      } else {
        skipped += 1;
      }
    }

    const mergedRows = fallbackRows.concat(Array.from(currentMap.values()));

    return {
      mergedRows,
      summary: {
        inserted,
        updated,
        skipped,
        locked,
        invalid: errorEntries.length,
        insertedDeclarations,
        updatedDeclarations,
        lockedDeclarations,
        errors: errorEntries,
      },
      samples: {
        inserted: insertedRows.slice(0, sampleLimit),
        updated: updatedRows.slice(0, sampleLimit),
        locked: lockedRows.slice(0, sampleLimit),
        errors: errorEntries.slice(0, sampleLimit),
      },
    };
  }

  function previewDeclRows(newRows, { overwrite = false } = {}) {
    const incoming = Array.isArray(newRows) ? newRows : [];
    const normalizedIncoming = normalizeDeclRows(incoming);
    const currentRows = getDeclRowsRaw();

    if (overwrite) {
      const validRows = normalizedIncoming.filter((row) => !!getDeclarationKey(row));
      const invalidRows = normalizedIncoming.filter((row) => !getDeclarationKey(row));
      const mstSummary = previewMSTEntriesForDeclRows(normalizedIncoming) || {
        additions: [],
        total: 0,
      };

      return {
        mode: "overwrite",
        totalBefore: currentRows.length,
        totalAfter: validRows.length,
        totalStored: validRows.length,
        totalIncoming: normalizedIncoming.length,
        inserted: validRows.length,
        updated: 0,
        skipped: 0,
        locked: 0,
        invalid: invalidRows.length,
        errors: invalidRows.map((row) => normalizeImportErrorRow(row, "missing-key")),
        insertedDeclarations: validRows.map((row) => buildImportLogEntry(row)).filter(Boolean),
        updatedDeclarations: [],
        lockedDeclarations: [],
        samples: {
          inserted: validRows.slice(0, 20),
          updated: [],
          locked: [],
          errors: invalidRows
            .slice(0, 20)
            .map((row) => normalizeImportErrorRow(row, "missing-key")),
        },
        newBusinessCount: mstSummary.total || 0,
        newBusinesses: mstSummary.additions || [],
      };
    }

    const { mergedRows, summary, samples } = computeDeclImportDiff(currentRows, normalizedIncoming, {
      sampleLimit: 20,
    });
    const mstSummary = previewMSTEntriesForDeclRows(normalizedIncoming) || {
      additions: [],
      total: 0,
    };

    return {
      mode: "merge",
      totalBefore: currentRows.length,
      totalAfter: mergedRows.length,
      totalStored: mergedRows.length,
      totalIncoming: normalizedIncoming.length,
      ...summary,
      samples,
      newBusinessCount: mstSummary.total || 0,
      newBusinesses: mstSummary.additions || [],
    };
  }

  async function saveDeclRows(
    newRows,
    { overwrite = false, actor = "system", detail = "", allowReviewedOverride = false } = {},
  ) {
    const incoming = Array.isArray(newRows) ? newRows : [];
    const normalizedIncomingBase = normalizeDeclRows(incoming);
    const normalizedIncoming = allowReviewedOverride
      ? normalizedIncomingBase.map((row) => ({ ...row, __forceReviewedOverride: true }))
      : normalizedIncomingBase;
    const actorName = normalizeStr(actor) || "system";
    const currentRows = getDeclRowsRaw();

    if (overwrite) {
      const stored = await persistAndAnnotateDeclRows(normalizedIncoming);
      pushAuditLog({
        actor: actorName,
        action: "decl.overwrite",
        detail: detail || `Ghi đè ${stored.length} tờ khai`,
      });

      const mstSummary =
        (await ensureMSTEntriesForDeclRows(normalizedIncoming, { actor: actorName })) || {
          additions: [],
          total: 0,
        };

      return {
        mode: "overwrite",
        totalBefore: currentRows.length,
        totalAfter: stored.length,
        totalStored: stored.length,
        totalIncoming: normalizedIncoming.length,
        inserted: stored.length,
        updated: 0,
        skipped: 0,
        locked: 0,
        invalid: 0,
        insertedDeclarations: normalizedIncoming.map((row) => buildImportLogEntry(row)).filter(Boolean),
        updatedDeclarations: [],
        lockedDeclarations: [],
        errors: [],
        newBusinessCount: mstSummary.total || 0,
        newBusinesses: mstSummary.additions || [],
      };
    }

    const { mergedRows, summary } = computeDeclImportDiff(currentRows, normalizedIncoming, {
      sampleLimit: 0,
    });
    const stored = await persistAndAnnotateDeclRows(mergedRows);
    const mstSummary =
      (await ensureMSTEntriesForDeclRows(normalizedIncoming, { actor: actorName })) || {
        additions: [],
        total: 0,
      };

    const skipLabel =
      summary.locked > 0
        ? `${summary.skipped.toLocaleString("vi-VN")} bỏ qua (khóa ${summary.locked.toLocaleString(
            "vi-VN",
          )})`
        : `${summary.skipped.toLocaleString("vi-VN")} bỏ qua`;
    const auditDetail =
      detail && detail.trim()
        ? detail
        : `Hợp nhất ${normalizedIncoming.length.toLocaleString("vi-VN")} tờ khai (+${summary.inserted.toLocaleString("vi-VN")} / cập nhật ${summary.updated.toLocaleString("vi-VN")} / ${skipLabel} -> tổng ${stored.length.toLocaleString("vi-VN")})`;

    pushAuditLog({
      actor: actorName,
      action: "decl.merge",
      detail: auditDetail,
    });

    return {
      mode: "merge",
      totalBefore: currentRows.length,
      totalAfter: stored.length,
      totalStored: stored.length,
      totalIncoming: normalizedIncoming.length,
      inserted: summary.inserted,
      updated: summary.updated,
      skipped: summary.skipped,
      locked: summary.locked,
      invalid: summary.invalid,
      insertedDeclarations: summary.insertedDeclarations,
      updatedDeclarations: summary.updatedDeclarations,
      lockedDeclarations: summary.lockedDeclarations,
      errors: summary.errors,
      newBusinessCount: mstSummary.total || 0,
      newBusinesses: mstSummary.additions || [],
    };
  }

  return {
    previewDeclRows,
    saveDeclRows,
  };
}
