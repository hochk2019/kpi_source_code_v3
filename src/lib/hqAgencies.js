export const HQ_HISTORY_LIMIT = 500;

const AGENCY_SPLIT_REGEX = /[\s,;|\n]+/;

export function createHQAgencyStore({
  getItem = () => null,
  setItem = () => { },
  pushAuditLog = null,
  normalizeStr = (value) => String(value ?? "").trim(),
  normalizeMST = (value) => String(value ?? "").replace(/\D/g, ""),
  safeParse = (_json, fallback) => fallback,
  getMSTMap = () => [],
  upsertMSTRows = () => [],
  getDeclRows = () => [],
  saveDeclRows = (rows) => rows,
  hqKey = "hq_agencies_v1",
  hqHistoryKey = "hq_history_v1",
  historyLimit = HQ_HISTORY_LIMIT,
} = {}) {
  function getHQAgenciesRaw() {
    return safeParse(getItem(hqKey), []);
  }

  function parseAgencyList(value) {
    if (Array.isArray(value)) {
      return Array.from(
        new Set(value.map((item) => normalizeStr(item)).filter(Boolean)),
      );
    }

    const text = normalizeStr(value);
    if (!text) return [];

    return Array.from(
      new Set(
        text
          .split(AGENCY_SPLIT_REGEX)
          .map((item) => normalizeStr(item))
          .filter(Boolean),
      ),
    );
  }

  function formatAgencyList(list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    return list.join(", ");
  }

  function sanitizeAgencyRow(row) {
    const record = row && typeof row === "object" ? row : {};
    const mst = normalizeMST(record?.mst);
    if (!mst) return null;

    const company = normalizeStr(
      record?.company ?? record?.cong_ty ?? record?.customer ?? "",
    );
    const agents = parseAgencyList(
      record?.agents ??
      record?.agent ??
      record?.agency ??
      record?.dai_ly ??
      record?.dai_ly_hq ??
      record?.["Đại lý HQ"] ??
      record?.["Dai ly HQ"],
    );

    return {
      mst,
      company,
      agent: formatAgencyList(agents),
      agents,
    };
  }

  function getHQAgencies() {
    const raw = getHQAgenciesRaw();
    const rows = Array.isArray(raw) ? raw : [];
    const sanitized = rows.map(sanitizeAgencyRow).filter(Boolean);
    sanitized.sort((a, b) => {
      const byCompany = a.company.localeCompare(b.company, "vi", { sensitivity: "base" });
      if (byCompany !== 0) return byCompany;
      return a.mst.localeCompare(b.mst);
    });
    return sanitized;
  }

  function mapHQAgenciesByMST() {
    const map = new Map();
    for (const row of getHQAgencies()) {
      if (!row) continue;
      map.set(row.mst, row);
    }
    return map;
  }

  function mergeAgencyEntries(target = [], incoming = []) {
    const merged = new Set();

    for (const value of Array.isArray(target) ? target : []) {
      const normalized = normalizeStr(value);
      if (normalized) merged.add(normalized);
    }

    for (const value of Array.isArray(incoming) ? incoming : []) {
      const normalized = normalizeStr(value);
      if (normalized) merged.add(normalized);
    }

    return Array.from(merged);
  }

  function formatAgencyHistoryValue(list) {
    return formatAgencyList(Array.isArray(list) ? list : parseAgencyList(list));
  }

  function createHQHistoryEntry({
    mst,
    field,
    from = "",
    to = "",
    actor = "system",
    timestamp,
    type = "update",
  }) {
    return {
      id: `hq-${mst}-${field}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mst: normalizeMST(mst),
      field,
      from: field === "agents" ? formatAgencyHistoryValue(from) : normalizeStr(from),
      to: field === "agents" ? formatAgencyHistoryValue(to) : normalizeStr(to),
      actor: actor || "system",
      timestamp,
      type,
    };
  }

  function diffHQAgencyRows(prevRows, nextRows, actor) {
    const prevMap = new Map();
    for (const row of Array.isArray(prevRows) ? prevRows : []) {
      if (!row?.mst) continue;
      prevMap.set(row.mst, row);
    }

    const nextMap = new Map();
    for (const row of Array.isArray(nextRows) ? nextRows : []) {
      if (!row?.mst) continue;
      nextMap.set(row.mst, row);
    }

    const timestamp = new Date().toISOString();
    const actorName = normalizeStr(actor) || "system";
    const entries = [];

    const recordChange = (mst, field, fromValue, toValue, type) => {
      entries.push(
        createHQHistoryEntry({
          mst,
          field,
          from: fromValue,
          to: toValue,
          actor: actorName,
          timestamp,
          type,
        }),
      );
    };

    for (const [mst, row] of nextMap.entries()) {
      const prev = prevMap.get(mst);
      if (!prev) {
        const company = normalizeStr(row?.company);
        if (company) recordChange(mst, "company", "", company, "create");

        const agents = formatAgencyHistoryValue(row?.agents ?? row?.agent);
        if (agents) recordChange(mst, "agents", "", agents, "create");
        continue;
      }

      const prevCompany = normalizeStr(prev?.company);
      const nextCompany = normalizeStr(row?.company);
      if (prevCompany !== nextCompany) {
        recordChange(mst, "company", prevCompany, nextCompany, "update");
      }

      const prevAgents = formatAgencyHistoryValue(prev?.agents ?? prev?.agent);
      const nextAgents = formatAgencyHistoryValue(row?.agents ?? row?.agent);
      if (prevAgents !== nextAgents) {
        recordChange(mst, "agents", prevAgents, nextAgents, "update");
      }
    }

    for (const [mst, row] of prevMap.entries()) {
      if (nextMap.has(mst)) continue;

      const prevCompany = normalizeStr(row?.company);
      if (prevCompany) recordChange(mst, "company", prevCompany, "", "delete");

      const prevAgents = formatAgencyHistoryValue(row?.agents ?? row?.agent);
      if (prevAgents) recordChange(mst, "agents", prevAgents, "", "delete");
    }

    return entries;
  }

  function getHQHistoryEntries(limit = historyLimit) {
    const raw = safeParse(getItem(hqHistoryKey), []);
    const list = Array.isArray(raw) ? raw.filter((entry) => entry && entry.mst) : [];
    if (!Number.isFinite(limit) || limit <= 0) return list;
    return list.slice(0, limit);
  }

  async function appendHQHistoryEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;

    const existing = getHQHistoryEntries();
    const merged = [...entries, ...existing]
      .filter((entry) => entry && entry.mst)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, historyLimit);

    await setItem(hqHistoryKey, JSON.stringify(merged));
  }

  function getHQHistoryForMST(mst, limit = 50) {
    const target = normalizeMST(mst);
    if (!target) return [];

    const entries = getHQHistoryEntries(historyLimit).filter((entry) => entry.mst === target);
    if (!Number.isFinite(limit) || limit <= 0) return entries;
    return entries.slice(0, limit);
  }

  function applyAgenciesToDeclRows(rows, agencyMapParam = null) {
    const list = Array.isArray(rows) ? rows : [];
    const agencyMap =
      agencyMapParam instanceof Map ? agencyMapParam : mapHQAgenciesByMST();
    if (!agencyMap || agencyMap.size === 0) return list;

    return list.map((row) => {
      const mst = normalizeMST(row?.mst);
      if (!mst) return row;

      const info = agencyMap.get(mst);
      if (!info) return row;

      const desiredCompany = normalizeStr(info?.company ?? "");
      const desiredAgents = Array.isArray(info?.agents)
        ? info.agents.map((value) => normalizeStr(value)).filter(Boolean)
        : parseAgencyList(info?.agent);
      const desiredAgent = desiredAgents.length > 0 ? formatAgencyList(desiredAgents) : "";

      let next = row;
      const ensureClone = () => {
        if (next === row) {
          next = { ...row };
        }
      };

      if (desiredCompany) {
        const currentCompany = normalizeStr(row?.cong_ty ?? row?.customer ?? "");
        if (currentCompany !== desiredCompany) {
          ensureClone();
          next.cong_ty = desiredCompany;
          next.customer = desiredCompany;
        }
      }

      if (desiredAgent) {
        const currentAgent = normalizeStr(
          row?.agency ??
          row?.dai_ly ??
          row?.dai_ly_hq ??
          row?.["Đại lý HQ"] ??
          row?.["Dai ly HQ"] ??
          "",
        );
        if (currentAgent !== desiredAgent) {
          ensureClone();
          next.agency = desiredAgent;
          next.dai_ly = desiredAgent;
          next.dai_ly_hq = desiredAgent;
          next["Đại lý HQ"] = desiredAgent;
          next["Dai ly HQ"] = desiredAgent;
        }
      }

      if (desiredAgents.length > 0) {
        ensureClone();
        next.agents = desiredAgents;
      }

      return next;
    });
  }

  async function upsertHQAgencies(rows, { actor = "system", detail = "" } = {}) {
    const previousRows = getHQAgencies();
    const sanitized = Array.isArray(rows) ? rows.map(sanitizeAgencyRow).filter(Boolean) : [];
    const dedup = new Map();

    for (const row of sanitized) {
      const prev = dedup.get(row.mst) || {};
      dedup.set(row.mst, {
        mst: row.mst,
        company: row.company || prev.company || "",
        agents: mergeAgencyEntries(prev.agents, row.agents),
      });
    }

    const finalRows = Array.from(dedup.values()).map((row) => ({
      mst: row.mst,
      company: row.company || "",
      agents: mergeAgencyEntries([], row.agents),
      agent: formatAgencyList(row.agents),
    }));

    finalRows.sort((a, b) => {
      const byCompany = a.company.localeCompare(b.company, "vi", { sensitivity: "base" });
      if (byCompany !== 0) return byCompany;
      return a.mst.localeCompare(b.mst);
    });

    await setItem(hqKey, JSON.stringify(finalRows));

    const historyEntries = diffHQAgencyRows(previousRows, finalRows, actor);
    if (historyEntries.length > 0) {
      await appendHQHistoryEntries(historyEntries);
    }

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "hq.save",
        detail: detail || `Cập nhật ${finalRows.length} cấu hình đại lý HQ`,
      });
    }

    const finalByMst = new Map(finalRows.map((row) => [row.mst, row]));
    const mstRows = getMSTMap();
    let mstChanged = false;

    const syncedMst = mstRows.map((row) => {
      const info = finalByMst.get(row.mst);
      if (!info || !info.company) return row;
      if (normalizeStr(row.company) === info.company) return row;
      mstChanged = true;
      return { ...row, company: info.company };
    });

    if (mstChanged) {
      await Promise.resolve(upsertMSTRows(syncedMst, {
        actor,
        detail: "Đồng bộ tên công ty theo Đại lý HQ",
      }));
    }

    const existingDecls = getDeclRows();
    const reannotatedDecls = applyAgenciesToDeclRows(existingDecls, finalByMst);
    const declChanged = reannotatedDecls.some((row, index) => row !== existingDecls[index]);

    if (declChanged) {
      await Promise.resolve(saveDeclRows(reannotatedDecls, {
        overwrite: true,
        actor,
        detail: "Đồng bộ Đại lý HQ với dữ liệu tờ khai hiện có",
      }));
    }

    return finalRows.length;
  }

  async function saveHQAgencyRow(row, { actor = "system", previousMst = "", detail = "" } = {}) {
    const sanitized = sanitizeAgencyRow(row);
    if (!sanitized) {
      throw new Error("Mã số thuế không hợp lệ khi lưu đại lý HQ");
    }

    const targetMst = sanitized.mst;
    const prevKey = normalizeMST(previousMst);
    const current = getHQAgencies();
    const preserved = [];

    for (const item of current) {
      if (!item?.mst) continue;
      if (item.mst === targetMst) continue;
      if (prevKey && item.mst === prevKey) continue;
      preserved.push(item);
    }

    preserved.push({
      mst: sanitized.mst,
      company: sanitized.company,
      agents: sanitized.agents,
      agent: sanitized.agent,
    });

    await upsertHQAgencies(preserved, {
      actor,
      detail: detail || `Cập nhật đại lý HQ cho MST ${targetMst}`,
    });

    return sanitized;
  }

  async function deleteHQAgencyRow(mst, { actor = "system", detail = "" } = {}) {
    const target = normalizeMST(mst);
    if (!target) return 0;

    const current = getHQAgencies();
    const next = current.filter((row) => row?.mst !== target);
    if (next.length === current.length) return 0;

    await upsertHQAgencies(next, {
      actor,
      detail: detail || `Xóa đại lý HQ cho MST ${target}`,
    });

    return 1;
  }

  return {
    applyAgenciesToDeclRows,
    deleteHQAgencyRow,
    formatAgencyList,
    getHQAgencies,
    getHQAgenciesRaw,
    getHQHistoryEntries,
    getHQHistoryForMST,
    mapHQAgenciesByMST,
    parseAgencyList,
    saveHQAgencyRow,
    upsertHQAgencies,
  };
}
