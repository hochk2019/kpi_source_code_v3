export const MST_ASSIGNMENT_STATUS = Object.freeze({
  PENDING: "Chưa gán nhân viên",
  ASSIGNED: "Đã gán nhân viên",
});

export function createMSTAssignmentStore({
  getItem = () => null,
  setItem = () => { },
  removeItem = () => { },
  pushAuditLog = null,
  normalizeStr = (value) => String(value ?? "").trim(),
  normalizeMST = (value) => String(value ?? "").replace(/\D/g, ""),
  normalizeName = (value) => normalizeStr(value).toLowerCase(),
  toISODate = () => "",
  pickFirstValue = (_source, _keys, fallback) => fallback,
  safeParse = (_json, fallback) => fallback,
  mstKey = "mst_rows_v2",
  legacyMstKey = "mst_rows_v1",
  mstHistoryKey = "mst_history_v1",
  historyLimit = 500,
} = {}) {
  const trackedFields = ["person_import", "person_export", "effective_from", "effective_to"];
  const mstStatusLookup = new Map(
    Object.values(MST_ASSIGNMENT_STATUS).map((label) => [normalizeName(label), label]),
  );
  let legacyMSTMigrated = false;

  function sanitizeMSTStatus(value) {
    const raw = normalizeStr(value);
    if (!raw) return "";

    const normalizedKey = normalizeName(raw);
    if (mstStatusLookup.has(normalizedKey)) {
      return mstStatusLookup.get(normalizedKey);
    }
    return raw;
  }

  function inferDefaultMSTStatus(row) {
    const hasImport = Boolean(normalizeStr(row?.person_import || ""));
    const hasExport = Boolean(normalizeStr(row?.person_export || ""));
    if (hasImport && hasExport) {
      return MST_ASSIGNMENT_STATUS.ASSIGNED;
    }
    return MST_ASSIGNMENT_STATUS.PENDING;
  }

  function compareMSTRows(a, b) {
    const byMST = a.mst.localeCompare(b.mst);
    if (byMST !== 0) return byMST;

    const fromA = a.effective_from || "";
    const fromB = b.effective_from || "";
    if (fromA !== fromB) {
      return fromA.localeCompare(fromB);
    }

    const toA = a.effective_to || "9999-12-31";
    const toB = b.effective_to || "9999-12-31";
    return toA.localeCompare(toB);
  }

  function makeMSTRowKey(row) {
    if (!row) return "";
    const mst = normalizeMST(row.mst);
    const effective = toISODate(row?.effective_from) || "";
    const effectiveTo = toISODate(row?.effective_to) || "";
    return `${mst || ""}__${effective}__${effectiveTo}`;
  }

  function createMSTHistoryEntry({ mst, field, from, to, actor, timestamp, rowKey, type }) {
    return {
      id: `mst-${rowKey || mst}-${field}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mst: normalizeMST(mst),
      field,
      from: normalizeStr(from),
      to: normalizeStr(to),
      actor: actor || "system",
      timestamp,
      rowKey: rowKey || makeMSTRowKey({ mst, effective_from: "", effective_to: "" }),
      type: type || "update",
    };
  }

  function getMSTHistoryEntries(limit = historyLimit) {
    const raw = safeParse(getItem(mstHistoryKey), []);
    const entries = Array.isArray(raw) ? raw : [];
    const normalized = entries
      .map((entry) => {
        if (!entry || !entry.mst) return null;
        const timestamp = entry.timestamp || new Date().toISOString();
        return {
          id: entry.id || `mst-${entry.mst}-${entry.field || "field"}-${timestamp}`,
          mst: normalizeMST(entry.mst),
          field: entry.field || "",
          from: normalizeStr(entry.from),
          to: normalizeStr(entry.to),
          actor: normalizeStr(entry.actor) || "system",
          timestamp,
          rowKey:
            entry.rowKey ||
            makeMSTRowKey({
              mst: entry.mst,
              effective_from: entry.effective_from || "",
              effective_to: entry.effective_to || "",
            }),
          type: entry.type || "update",
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

    if (!Number.isFinite(limit) || limit <= 0) {
      return normalized;
    }
    return normalized.slice(0, limit);
  }

  async function appendMSTHistoryEntries(entries) {
    if (!entries?.length) return;

    const existing = getMSTHistoryEntries();
    const merged = [...entries, ...existing]
      .filter(Boolean)
      .sort((a, b) => {
        const timeA = new Date(a?.timestamp || 0).getTime();
        const timeB = new Date(b?.timestamp || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, historyLimit);

    await setItem(mstHistoryKey, JSON.stringify(merged));
  }

  function sanitizeMSTRow(rowInput) {
    const row = rowInput && typeof rowInput === "object" ? rowInput : {};
    const mst = normalizeMST(
      pickFirstValue(row, ["mst", "MST", "ma_so_thue", "maSoThue", "tax_code", "taxCode"], row?.mst),
    );
    if (!mst) return null;

    const companyRaw = pickFirstValue(row, ["company", "company_name", "companyName", "tenCongTy"], row?.company);
    const personImportRaw = pickFirstValue(
      row,
      [
        "person_import",
        "personImport",
        "nguoi_phu_trach_nhap",
        "nguoiPhuTrachNhap",
        "import_person",
        "importPerson",
      ],
      row?.person_import,
    );
    const personExportRaw = pickFirstValue(
      row,
      [
        "person_export",
        "personExport",
        "nguoi_phu_trach_xuat",
        "nguoiPhuTrachXuat",
        "export_person",
        "exportPerson",
      ],
      row?.person_export,
    );
    const teamRaw = pickFirstValue(row, ["team", "team_name", "teamName"], row?.team);
    const effectiveFromRaw = pickFirstValue(
      row,
      ["effective_from", "effectiveFrom", "from", "start", "valid_from"],
      row?.effective_from,
    );
    const effectiveToRaw = pickFirstValue(
      row,
      ["effective_to", "effectiveTo", "to", "end", "valid_to"],
      row?.effective_to,
    );
    const statusRaw = pickFirstValue(row, ["status", "trang_thai"], row?.status);

    const sanitized = {
      mst,
      company: normalizeStr(companyRaw ?? ""),
      person_import: normalizeStr(personImportRaw ?? ""),
      person_export: normalizeStr(personExportRaw ?? ""),
      team: normalizeStr(teamRaw ?? ""),
      effective_from: toISODate(effectiveFromRaw) || "",
      effective_to: toISODate(effectiveToRaw) || "",
    };

    const resolvedStatus = sanitizeMSTStatus(statusRaw ?? "");
    sanitized.status = resolvedStatus || inferDefaultMSTStatus(sanitized);

    return sanitized;
  }

  function diffMSTRows(prevRows, nextRows, actor) {
    const prevMap = new Map();
    for (const row of Array.isArray(prevRows) ? prevRows : []) {
      prevMap.set(makeMSTRowKey(row), row);
    }

    const nextMap = new Map();
    for (const row of Array.isArray(nextRows) ? nextRows : []) {
      nextMap.set(makeMSTRowKey(row), row);
    }

    const timestamp = new Date().toISOString();
    const actorName = normalizeStr(actor) || "system";
    const entries = [];

    for (const [key, row] of nextMap) {
      const prev = prevMap.get(key);
      if (!prev) {
        for (const field of trackedFields) {
          const value = normalizeStr(row?.[field]);
          if (!value) continue;
          entries.push(
            createMSTHistoryEntry({
              mst: row.mst,
              field,
              from: "",
              to: value,
              actor: actorName,
              timestamp,
              rowKey: key,
              type: "create",
            }),
          );
        }
        continue;
      }

      for (const field of trackedFields) {
        const prevValue = normalizeStr(prev?.[field]);
        const nextValue = normalizeStr(row?.[field]);
        if (prevValue === nextValue) continue;
        entries.push(
          createMSTHistoryEntry({
            mst: row.mst,
            field,
            from: prevValue,
            to: nextValue,
            actor: actorName,
            timestamp,
            rowKey: key,
            type: "update",
          }),
        );
      }
    }

    for (const [key, row] of prevMap) {
      if (nextMap.has(key)) continue;
      for (const field of trackedFields) {
        const prevValue = normalizeStr(row?.[field]);
        if (!prevValue) continue;
        entries.push(
          createMSTHistoryEntry({
            mst: row.mst,
            field,
            from: prevValue,
            to: "",
            actor: actorName,
            timestamp,
            rowKey: key,
            type: "delete",
          }),
        );
      }
    }

    return entries;
  }

  async function migrateLegacyMSTRows() {
    const rawValue = getItem(legacyMstKey);
    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    try {
      const parsed = safeParse(rawValue, null);
      const legacyRows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray(parsed.rows)
          ? parsed.rows
          : [];
      const legacyTotal = Array.isArray(legacyRows) ? legacyRows.length : 0;

      if (!legacyTotal) {
        await removeItem(legacyMstKey);
        if (typeof pushAuditLog === "function") {
          pushAuditLog({
            actor: "system",
            action: "mst.migrate.v1-v2",
            detail: "Phát hiện khoá mst_rows_v1 nhưng không có bản ghi hợp lệ để chuyển đổi",
            meta: { legacyTotal: 0, converted: 0, added: 0 },
          });
        }
        return { migrated: 0, total: 0 };
      }

      const sanitizedLegacy = legacyRows.map((row) => sanitizeMSTRow(row)).filter(Boolean);
      const convertedCount = sanitizedLegacy.length;
      const skippedInvalid = legacyTotal - convertedCount;

      if (!convertedCount) {
        await removeItem(legacyMstKey);
        if (typeof pushAuditLog === "function") {
          pushAuditLog({
            actor: "system",
            action: "mst.migrate.v1-v2",
            detail: `Không thể migrate ${legacyTotal} bản ghi gán MST do dữ liệu không hợp lệ`,
            meta: { legacyTotal, converted: 0, added: 0, skippedInvalid: legacyTotal },
            result: "error",
          });
        }
        return { migrated: 0, total: legacyTotal };
      }

      const currentRaw = safeParse(getItem(mstKey), []);
      const currentSanitized = Array.isArray(currentRaw)
        ? currentRaw.map((row) => sanitizeMSTRow(row)).filter(Boolean)
        : [];
      const currentMap = new Map(currentSanitized.map((row) => [makeMSTRowKey(row), row]));

      let added = 0;
      for (const row of sanitizedLegacy) {
        const key = makeMSTRowKey(row);
        if (currentMap.has(key)) {
          continue;
        }
        currentMap.set(key, row);
        added += 1;
      }

      if (added > 0) {
        const nextRows = Array.from(currentMap.values()).sort(compareMSTRows);
        await setItem(mstKey, JSON.stringify(nextRows));
      }

      await removeItem(legacyMstKey);
      if (typeof pushAuditLog === "function") {
        pushAuditLog({
          actor: "system",
          action: "mst.migrate.v1-v2",
          detail: `Di chuyển ${added}/${legacyTotal} bản ghi gán MST từ khoá cũ sang định dạng mới`,
          meta: {
            legacyTotal,
            converted: convertedCount,
            added,
            skippedInvalid,
            skippedDuplicate: convertedCount - added,
            totalAfter: currentMap.size,
          },
        });
      }

      return { migrated: added, total: legacyTotal };
    } catch (err) {
      console.error("Không thể migrate dữ liệu mst_rows_v1 sang mst_rows_v2", err);
      if (typeof pushAuditLog === "function") {
        pushAuditLog({
          actor: "system",
          action: "mst.migrate.v1-v2",
          detail: "Lỗi khi migrate gán MST sang định dạng mới",
          result: "error",
          note: err?.message || "unknown",
        });
      }
      return null;
    }
  }

  function ensureLegacyMSTMigrated() {
    if (legacyMSTMigrated) {
      return;
    }
    legacyMSTMigrated = true;
    migrateLegacyMSTRows().catch(() => { });
  }

  function getMSTRowsRaw() {
    ensureLegacyMSTMigrated();
    return safeParse(getItem(mstKey), []);
  }

  function getMSTMap() {
    const raw = getMSTRowsRaw();
    const rows = Array.isArray(raw) ? raw : [];
    return rows.map(sanitizeMSTRow).filter(Boolean).sort(compareMSTRows);
  }

  async function upsertMSTRows(rows, { actor = "system", detail = "" } = {}) {
    const previous = getMSTMap();
    const sanitized = Array.isArray(rows) ? rows.map((row) => sanitizeMSTRow(row)).filter(Boolean) : [];
    sanitized.sort(compareMSTRows);

    const changes = diffMSTRows(previous, sanitized, actor);
    await setItem(mstKey, JSON.stringify(sanitized));

    if (changes.length) {
      await appendMSTHistoryEntries(changes);
    }

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "mst.save",
        detail: detail || `Cập nhật ${sanitized.length} dòng gán MST`,
      });
    }

    return sanitized.length;
  }

  async function saveMSTRow(rowInput, { originalKey = null, actor = "system", detail = "" } = {}) {
    const sanitized = sanitizeMSTRow(rowInput);
    if (!sanitized) {
      return { ok: false, reason: "invalid" };
    }

    const previousRows = getMSTMap();
    const prevMap = new Map(previousRows.map((row) => [makeMSTRowKey(row), row]));
    const targetKey = originalKey ? String(originalKey) : makeMSTRowKey(rowInput);
    const previous = targetKey ? prevMap.get(targetKey) : null;

    if (originalKey && !previous) {
      return { ok: false, reason: "not-found" };
    }

    const nextKey = makeMSTRowKey(sanitized);
    if (targetKey && nextKey !== targetKey && prevMap.has(nextKey)) {
      return { ok: false, reason: "conflict" };
    }

    if (previous && nextKey === targetKey) {
      const same =
        previous.mst === sanitized.mst &&
        previous.company === sanitized.company &&
        previous.person_import === sanitized.person_import &&
        previous.person_export === sanitized.person_export &&
        previous.team === sanitized.team &&
        previous.effective_from === sanitized.effective_from &&
        previous.effective_to === sanitized.effective_to &&
        previous.status === sanitized.status;
      if (same) {
        return { ok: false, reason: "no-change", row: previous, key: targetKey };
      }
    }

    if (previous && targetKey && prevMap.has(targetKey)) {
      prevMap.delete(targetKey);
    }
    prevMap.set(nextKey, sanitized);

    const nextRows = Array.from(prevMap.values()).sort(compareMSTRows);
    const changes = diffMSTRows(previousRows, nextRows, actor);
    if (!changes.length) {
      return { ok: false, reason: "no-change", row: sanitized, key: nextKey };
    }

    await setItem(mstKey, JSON.stringify(nextRows));
    await appendMSTHistoryEntries(changes);

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "mst.save-row",
        detail:
          detail ||
          (previous ? `Cập nhật gán MST cho ${sanitized.mst}` : `Thêm mới gán MST ${sanitized.mst}`),
      });
    }

    return {
      ok: true,
      row: sanitized,
      key: nextKey,
      previousKey: previous ? targetKey : null,
    };
  }

  function getMSTHistoryFor(mst, limit = 20) {
    const normalizedMST = normalizeMST(mst);
    if (!normalizedMST) return [];

    const entries = getMSTHistoryEntries();
    const filtered = entries.filter((entry) => entry.mst === normalizedMST);
    if (!Number.isFinite(limit) || limit <= 0) {
      return filtered;
    }
    return filtered.slice(0, limit);
  }

  function getMSTFor(mst, isoDate) {
    const normalizedTarget = normalizeMST(mst);
    const rows = getMSTMap().filter((row) => normalizeMST(row.mst) === normalizedTarget);
    if (rows.length === 0) return null;

    if (!isoDate) {
      return rows[rows.length - 1];
    }

    const target = new Date(isoDate);
    const targetTime = Number.isNaN(target.getTime()) ? null : target.getTime();
    if (targetTime == null) {
      return rows[rows.length - 1];
    }

    const resolveTime = (value, fallbackInfinity = false) => {
      if (!value) {
        return fallbackInfinity ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      }
      const date = new Date(value);
      const time = date.getTime();
      if (Number.isNaN(time)) {
        return fallbackInfinity ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      }
      return time;
    };

    const candidates = rows
      .map((row) => {
        const from = resolveTime(row.effective_from);
        const to = resolveTime(row.effective_to, true);
        const isWithin = targetTime >= from && targetTime <= to;
        const distance = targetTime - from;
        return { row, from, to, isWithin, distance };
      })
      .sort((a, b) => {
        if (a.from !== b.from) {
          return a.from - b.from;
        }
        return a.to - b.to;
      });

    const active = candidates.filter((entry) => entry.isWithin);
    if (active.length) {
      return active.sort((a, b) => b.from - a.from)[0]?.row ?? rows[0];
    }

    const before = candidates.filter((entry) => entry.from <= targetTime);
    if (before.length) {
      return before.sort((a, b) => b.from - a.from)[0]?.row ?? rows[0];
    }

    return candidates[0]?.row ?? rows[0];
  }

  return {
    sanitizeMSTRow,
    getMSTRowsRaw,
    getMSTMap,
    upsertMSTRows,
    saveMSTRow,
    getMSTHistoryEntries,
    getMSTHistoryFor,
    getMSTFor,
  };
}
