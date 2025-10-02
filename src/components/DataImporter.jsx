// src/components/DataImporter.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getDeclRows,
  saveDeclRows,
  sortDeclRows,
  pushImportLog,
  getTeamRoster,
  mapMemberNamesToTeams,
  markDeclRowsReviewed,
  mapHQAgenciesByMST,
} from "@/lib/store.js";
import { mapRow, detectDateOrder } from "@/lib/importer.js";
import { loadRules, computeKPI } from "@/lib/rules.js";
import { deriveCOStatus, coLabel, coLineCount } from "@/shared/co.js";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];
const CO_FILTER_OPTIONS = Object.freeze([
  { value: "all", label: "Tất cả C/O" },
  { value: "has", label: "Có C/O (≥ 1 dòng)" },
  { value: "min", label: "Tùy chọn số dòng C/O" },
]);

const DEFAULT_SYNC_CONFIG = Object.freeze({
  enabled: false,
  schedule: "0 * * * *",
  rangeDays: 1,
  preferMonthFirst: false,
  connection: {
    server: "",
    database: "",
    user: "",
    hasPassword: false,
  },
  lastRun: null,
  lastStatus: null,
});

const RANGE_PRESETS = Object.freeze([
  { label: "1 ngày gần nhất", days: 1 },
  { label: "3 ngày", days: 3 },
  { label: "7 ngày", days: 7 },
  { label: "30 ngày", days: 30 },
]);

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function coerceLicenseValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const str = String(value).trim();
  if (str === "") return "";
  const num = Number(str);
  if (!Number.isFinite(num)) return "";
  return Math.max(0, Math.round(num));
}

function ensureLicenseFields(row) {
  if (!row || typeof row !== "object") return row;
  const source = row.licenses ?? row.so_luong_gp;
  if (source === undefined) return row;
  const normalized = coerceLicenseValue(source);
  if (row.licenses === normalized && row.so_luong_gp === normalized) return row;
  return { ...row, licenses: normalized, so_luong_gp: normalized };
}

function ensureCOFields(row) {
  if (!row || typeof row !== "object") return row;
  const status = deriveCOStatus(row, row);
  if (
    status.co === row.co &&
    status.has_co === row.has_co &&
    status.co_line_count === row.co_line_count
  ) {
    return row;
  }
  return status;
}

export default function DataImporter({
  canEdit = true,
  currentUser = null,
  canManageSync = false,
  canManageAlerts = false,
}) {
  const fileRef = useRef(null);
  const [rawRows, setRawRows] = useState([]);        // dữ liệu xem trước (đã map)
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("saved");         // saved | preview
  const [selectedFile, setSelectedFile] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filterNoStaff, setFilterNoStaff] = useState(false);
  const [filterNoTeam, setFilterNoTeam] = useState(false);
  const [coFilterMode, setCoFilterMode] = useState("all");
  const [coFilterMin, setCoFilterMin] = useState(5);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [rules, setRules] = useState(() => loadRules());
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Tuỳ chọn
  const [overwrite, setOverwrite] = useState(false);         // Ghi đè toàn bộ
  const [upsert11, setUpsert11] = useState(true);            // Upsert theo 11 số đầu (nếu có dùng merge cục bộ)
  const [autoAssignStaff, setAutoAssignStaff] = useState(true); // Tự gán nhân viên theo MST nếu trống

  const actor = currentUser?.username || "guest";
  const isReadOnlyForEdits = !canEdit;
  const canReviewAlerts = canEdit || canManageAlerts;
  const [syncConfig, setSyncConfig] = useState(() => ({ ...DEFAULT_SYNC_CONFIG }));
  const [syncForm, setSyncForm] = useState(() => ({
    enabled: DEFAULT_SYNC_CONFIG.enabled,
    schedule: DEFAULT_SYNC_CONFIG.schedule,
    rangeDays: DEFAULT_SYNC_CONFIG.rangeDays,
    preferMonthFirst: DEFAULT_SYNC_CONFIG.preferMonthFirst,
    server: DEFAULT_SYNC_CONFIG.connection.server,
    database: DEFAULT_SYNC_CONFIG.connection.database,
    user: DEFAULT_SYNC_CONFIG.connection.user,
    password: "",
    hasPassword: !!DEFAULT_SYNC_CONFIG.connection.hasPassword,
  }));
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [manualRange, setManualRange] = useState({ from: "", to: "" });
  const [alertSummary, setAlertSummary] = useState({ outstanding: 0, totalTracked: 0, lastEvaluatedAt: null });
  const [alertEntries, setAlertEntries] = useState([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState({ backend: null, database: null, checkedAt: null });
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRangeInfo, setPreviewRangeInfo] = useState(null);

  useEffect(() => {
    setPreviewRows([]);
    setPreviewLimited(false);
    setPreviewError("");
    setPreviewRangeInfo(null);
  }, [manualRange.from, manualRange.to]);

  const loadSavedRows = useCallback((opts = {}) => {
    const { bypassConfirm = false } = opts;
    if (!bypassConfirm && hasUnsaved && mode === "saved") {
      const shouldDiscard = window.confirm(
        "Bạn có các thay đổi chưa lưu. Tiếp tục sẽ bỏ qua các chỉnh sửa đó. Bạn có muốn tiếp tục?"
      );
      if (!shouldDiscard) {
        if (fileRef.current) fileRef.current.value = "";
        return false;
      }
    }
    const activeRules = loadRules();
    setRules(activeRules);
    const saved = sortDeclRows(getDeclRows()).map(ensureLicenseFields).map(ensureCOFields);
    setRawRows(saved);
    setMode("saved");
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setQuery("");
    setSelectedFile("");
    setFilterNoStaff(false);
    setFilterNoTeam(false);
    setCoFilterMode("all");
    setCoFilterMin(5);
    setSelectedKeys([]);
    setHasUnsaved(false);
    if (fileRef.current) fileRef.current.value = "";
    return true;
  }, [fileRef, hasUnsaved, mode]);

  useEffect(() => {
    if (mode !== "saved") return;
    if (hasUnsaved) return;
    if (rawRows.length > 0) return;
    loadSavedRows({ bypassConfirm: true });
  }, [loadSavedRows, mode, hasUnsaved, rawRows.length]);

  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const applyConfigToForm = useCallback((config) => {
    const normalizedConfig = {
      ...DEFAULT_SYNC_CONFIG,
      ...(config && typeof config === "object" ? config : {}),
      connection: {
        ...DEFAULT_SYNC_CONFIG.connection,
        ...((config && typeof config === "object" && config.connection && typeof config.connection === "object")
          ? config.connection
          : {}),
      },
    };
    setSyncConfig(normalizedConfig);
    setSyncForm({
      enabled: !!normalizedConfig.enabled,
      schedule: normalizedConfig.schedule || "0 * * * *",
      rangeDays: normalizedConfig.rangeDays ?? 1,
      preferMonthFirst: !!normalizedConfig.preferMonthFirst,
      server: normalizedConfig.connection?.server || "",
      database: normalizedConfig.connection?.database || "",
      user: normalizedConfig.connection?.user || "",
      password: "",
      hasPassword: !!normalizedConfig.connection?.hasPassword,
    });
  }, []);

  const fetchSyncConfig = useCallback(async () => {
    setSyncLoading(true);
    setSyncError("");
    try {
      const response = await fetch("/api/import/ecus/config", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload?.config) {
        applyConfigToForm(payload.config);
        setSyncMessage("Đã tải cấu hình đồng bộ mới nhất.");
      } else {
        setSyncMessage("Không tìm thấy cấu hình lưu trữ, sử dụng giá trị mặc định.");
        applyConfigToForm(DEFAULT_SYNC_CONFIG);
      }
    } catch (err) {
      console.error("Không thể tải cấu hình đồng bộ ECUS", err);
      setSyncError(
        "Không thể tải cấu hình đồng bộ ECUS. Hãy kiểm tra dịch vụ backend (pnpm server) hoặc kết nối mạng LAN."
      );
      setSyncMessage("");
      applyConfigToForm(DEFAULT_SYNC_CONFIG);
    } finally {
      setSyncLoading(false);
    }
  }, [applyConfigToForm]);

  const fetchSyncStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");
    try {
      const response = await fetch("/api/import/ecus/status", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      setStatusInfo({
        backend: payload?.backend || null,
        database: payload?.database || null,
        checkedAt:
          payload?.database?.checkedAt || payload?.backend?.checkedAt || new Date().toISOString(),
      });
      if (payload?.config) {
        applyConfigToForm(payload.config);
      }
    } catch (err) {
      console.error("Không thể tải trạng thái đồng bộ", err);
      setStatusError("Không thể kiểm tra kết nối backend/SQL Server.");
    } finally {
      setStatusLoading(false);
    }
  }, [applyConfigToForm]);

  const fetchAlerts = useCallback(async () => {
    setAlertLoading(true);
    try {
      const response = await fetch("/api/import/alerts", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload?.alerts) {
        setAlertEntries(Array.isArray(payload.alerts) ? payload.alerts : []);
      }
      if (payload?.summary) {
        setAlertSummary(payload.summary);
      }
    } catch (err) {
      console.error("Không thể tải cảnh báo tờ khai", err);
    } finally {
      setAlertLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncConfig();
    fetchAlerts();
    fetchSyncStatus();
  }, [fetchSyncConfig, fetchAlerts, fetchSyncStatus]);

  const handleSaveSyncConfig = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền cập nhật cấu hình đồng bộ.");
      return;
    }
    if (!syncForm) return;
    setSyncLoading(true);
    setSyncMessage("");
    setSyncError("");
    try {
      const payload = {
        config: {
          enabled: !!syncForm.enabled,
          schedule: syncForm.schedule || "0 * * * *",
          rangeDays: Number(syncForm.rangeDays) || 1,
          preferMonthFirst: !!syncForm.preferMonthFirst,
          connection: {
            server: syncForm.server || "",
            database: syncForm.database || "",
            user: syncForm.user || "",
          },
        },
        preservePassword: !syncForm.password && syncForm.hasPassword,
      };
      if (syncForm.password) {
        payload.config.connection.password = syncForm.password;
      }
      if (syncConfig?.columnMap) {
        payload.config.columnMap = syncConfig.columnMap;
      }
      const response = await fetch("/api/import/ecus/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const next = await response.json();
      if (next?.config) {
        applyConfigToForm(next.config);
        setSyncMessage("Đã lưu cấu hình đồng bộ ECUS.");
      }
    } catch (err) {
      console.error("Không thể lưu cấu hình ECUS", err);
      setSyncError(err?.message || "Không thể lưu cấu hình đồng bộ");
    } finally {
      setSyncLoading(false);
    }
  }, [applyConfigToForm, canManageSync, syncConfig, syncForm]);

  const handleRunSync = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền chạy đồng bộ ECUS.");
      return;
    }
    if (!manualRange.from && !manualRange.to) {
      const confirmDefault = window.confirm(
        "Bạn chưa chọn khoảng thời gian cụ thể. Hệ thống sẽ dùng số ngày mặc định trong cấu hình (RangeDays). Bạn có muốn tiếp tục?"
      );
      if (!confirmDefault) {
        return;
      }
    }
    setSyncRunning(true);
    setSyncMessage("Đang đồng bộ...");
    setSyncError("");
    try {
      const response = await fetch("/api/import/ecus/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor,
          from: manualRange.from || undefined,
          to: manualRange.to || undefined,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const imported = payload?.result?.imported ?? 0;
      const skipped = payload?.result?.skipped ?? 0;
      const skippedNote = skipped > 0 ? `, bỏ qua ${skipped} tờ khai đã có` : '';
      setSyncMessage(`Đã đồng bộ ${imported} tờ khai mới từ ECUS${skippedNote}.`);
      setPreviewRows([]);
      setPreviewRangeInfo(null);
      setPreviewLimited(false);
      setPreviewError("");
      await fetchSyncConfig();
      await fetchSyncStatus();
      await fetchAlerts();
      loadSavedRows({ bypassConfirm: true });
    } catch (err) {
      console.error("Đồng bộ ECUS thất bại", err);
      setSyncMessage("");
      setSyncError(err?.message || "Không thể đồng bộ ECUS");
    } finally {
      setSyncRunning(false);
    }
  }, [actor, canManageSync, fetchAlerts, fetchSyncConfig, fetchSyncStatus, loadSavedRows, manualRange.from, manualRange.to]);

  const handlePreviewSync = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền xem trước dữ liệu đồng bộ.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const response = await fetch("/api/import/ecus/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: manualRange.from || undefined,
          to: manualRange.to || undefined,
          limit: 100,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const rows = Array.isArray(payload?.preview?.rows) ? payload.preview.rows : [];
      setPreviewRows(rows);
      setPreviewLimited(!!payload?.preview?.limited);
      setPreviewRangeInfo(payload?.preview?.range || null);
      if (!rows.length) {
        setPreviewError("Không tìm thấy tờ khai mới trong khoảng thời gian đã chọn.");
      }
    } catch (err) {
      console.error("Không thể xem trước dữ liệu ECUS", err);
      setPreviewError(err?.message || "Không thể xem trước dữ liệu đồng bộ");
      setPreviewRows([]);
      setPreviewLimited(false);
      setPreviewRangeInfo(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [canManageSync, manualRange.from, manualRange.to]);

  const handleManualRangeChange = useCallback((field, value) => {
    setManualRange((prev) => ({ ...prev, [field]: value }));
  }, []);

  const applyRangePreset = useCallback((days) => {
    const totalDays = Math.max(0, Number(days) || 0);
    const end = new Date();
    const start = new Date(end.getTime() - totalDays * 24 * 60 * 60 * 1000);
    setManualRange({
      from: toDateInputValue(start),
      to: toDateInputValue(end),
    });
  }, []);

  const handleRefreshAlerts = useCallback(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkReviewed = useCallback(async () => {
    if (!canReviewAlerts) {
      alert("Bạn không có quyền đánh dấu đã rà soát các tờ khai.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ đánh dấu rà soát khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để đánh dấu.");
      return;
    }
    const updated = markDeclRowsReviewed(selectedKeys, { actor });
    if (updated === 0) {
      alert("Các tờ khai đã được đánh dấu hoặc không tìm thấy.");
    }
    try {
      await fetch("/api/import/alerts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: selectedKeys, actor }),
        credentials: "include",
      });
    } catch (err) {
      console.warn("Không thể đồng bộ trạng thái rà soát với máy chủ", err);
    }
    setSelectedKeys([]);
    setHasUnsaved(false);
    loadSavedRows({ bypassConfirm: true });
    fetchAlerts();
  }, [actor, canReviewAlerts, fetchAlerts, loadSavedRows, mode, selectedKeys]);

  const summaryStats = useMemo(() => {
    if (!Array.isArray(rawRows) || rawRows.length === 0 || mode !== "saved") {
      return { total: rawRows.length, missingStaff: 0, missingTeam: 0, reviewed: 0 };
    }
    let missingStaff = 0;
    let missingTeam = 0;
    let reviewed = 0;
    for (const row of rawRows) {
      if (!row) continue;
      const hasStaff = !!(row.nhan_vien && row.nhan_vien.toString().trim());
      const hasTeam = !!(row.team && row.team.toString().trim());
      if (!hasStaff) missingStaff += 1;
      if (!hasTeam) missingTeam += 1;
      if (row.reviewed) reviewed += 1;
    }
    return { total: rawRows.length, missingStaff, missingTeam, reviewed };
  }, [mode, rawRows]);

  const outstandingAlerts = useMemo(() => {
    return alertEntries.filter((entry) => !entry.resolved).slice(0, 5);
  }, [alertEntries]);

  const summaryCards = useMemo(() => [
    { label: "Tổng tờ khai (đang xem)", value: summaryStats.total },
    { label: "Chưa gán nhân viên", value: summaryStats.missingStaff },
    { label: "Chưa gán tổ đội", value: summaryStats.missingTeam },
    { label: "Đã rà soát", value: summaryStats.reviewed },
    { label: "Cảnh báo chờ xử lý", value: alertSummary.outstanding || 0 },
  ], [alertSummary.outstanding, summaryStats]);

  const lastAlertEvaluated = useMemo(() => {
    if (!alertSummary.lastEvaluatedAt) return "Chưa tính";
    try {
      return new Date(alertSummary.lastEvaluatedAt).toLocaleString("vi-VN");
    } catch {
      return alertSummary.lastEvaluatedAt;
    }
  }, [alertSummary.lastEvaluatedAt]);

  const syncLastRunLabel = useMemo(() => {
    if (!syncConfig?.lastRun) return "Chưa chạy";
    try {
      return new Date(syncConfig.lastRun).toLocaleString("vi-VN");
    } catch {
      return syncConfig.lastRun;
    }
  }, [syncConfig?.lastRun]);

  const lastSyncSummary = syncConfig?.lastSummary || null;
  const lastSyncRangeLabel = useMemo(() => {
    if (!lastSyncSummary?.range) return "";
    const from = lastSyncSummary.range.from || "";
    const to = lastSyncSummary.range.to || "";
    if (from && to) {
      return `${from} → ${to}`;
    }
    return from || to;
  }, [lastSyncSummary?.range?.from, lastSyncSummary?.range?.to]);
  const lastSyncInserted = lastSyncSummary?.rowsInserted ?? lastSyncSummary?.rowsImported ?? 0;
  const lastSyncSkipped = lastSyncSummary?.rowsSkipped ?? 0;
  const lastSyncFetched = lastSyncSummary?.rowsFetched ?? 0;
  const lastSyncTotal = lastSyncSummary?.totalStored ?? 0;

  // Đọc file XLSX
  function handleFileChange(e) {
    if (isReadOnlyForEdits) {
      alert("Bạn đang ở chế độ chỉ xem — hãy đăng nhập để import dữ liệu.");
      return;
    }
    if (hasUnsaved && mode === "saved") {
      const proceed = window.confirm(
        "Bạn có các thay đổi chưa lưu. Chọn file mới sẽ làm mất các chỉnh sửa đó. Bạn có chắc chắn muốn tiếp tục?"
      );
      if (!proceed) {
        if (fileRef.current) fileRef.current.value = "";
        e.target.value = "";
        return;
      }
    }
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
      const loadedRules = loadRules();
      setRules(loadedRules);
      const excludeCodes = Array.isArray(loadedRules?.license?.exclude?.codes)
        ? loadedRules.license.exclude.codes
        : [];
      const dateOrder = detectDateOrder(rows);
      const preferMonthFirst = dateOrder === "mdy";
      const roster = getTeamRoster();
      const memberMap = mapMemberNamesToTeams(roster);
      const agencyMap = mapHQAgenciesByMST();

      const mapped = rows
        .map(r =>
          mapRow(r, {
            autoAssignStaff,
            rules: loadedRules,
            licenseExcludes: excludeCodes,
            preferMonthFirst,
            memberMap,
            agencyMap,
          })
        )
        .map(ensureLicenseFields)
        .filter(r => r.so_tk && r.date);

      setRawRows(sortDeclRows(mapped));
      setPage(1);
      setPageSize(DEFAULT_PAGE_SIZE);
      setMode("preview");
      setSelectedFile(f.name || "");
      setQuery("");
      setFilterNoStaff(false);
      setFilterNoTeam(false);
      setCoFilterMode("all");
      setCoFilterMin(5);
      setSelectedKeys([]);
      setHasUnsaved(false);
    };
    reader.readAsArrayBuffer(f);
  }

  // Tìm nhanh
  const coThreshold = useMemo(() => Math.max(0, Number(coFilterMin) || 0), [coFilterMin]);
  const coFilterActive = useMemo(() => {
    if (coFilterMode === "has") return true;
    if (coFilterMode === "min") return coThreshold > 0;
    return false;
  }, [coFilterMode, coThreshold]);

  const coFilterMatches = useMemo(() => {
    if (!coFilterActive) return rawRows.length;
    return rawRows.reduce((count, row) => {
      const lines = coLineCount(row);
      if (coFilterMode === "has") {
        return count + (lines > 0 ? 1 : 0);
      }
      if (coFilterMode === "min") {
        return count + (lines >= coThreshold ? 1 : 0);
      }
      return count;
    }, 0);
  }, [rawRows, coFilterMode, coFilterActive, coThreshold]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const hasText = q.length > 0;
    return rawRows.filter(r => {
      const soTk = (r.so_tk || "").toString().toLowerCase();
      const mst = (r.mst || "").toString().toLowerCase();
      const company = (r.cong_ty || "").toString().toLowerCase();
      const agency = (r.agency || r.dai_ly || "").toString().toLowerCase();
      if (hasText && !(
        soTk.includes(q) ||
        mst.includes(q) ||
        company.includes(q) ||
        agency.includes(q)
      )) {
        return false;
      }
      if (filterNoStaff) {
        const hasStaff = Boolean((r.nhan_vien || "").toString().trim());
        if (hasStaff) return false;
      }
      if (filterNoTeam) {
        const hasTeam = Boolean((r.team || "").toString().trim());
        if (hasTeam) return false;
      }
      const lines = coLineCount(r);
      if (coFilterMode === "has" && lines <= 0) {
        return false;
      }
      if (coFilterMode === "min") {
        if (coThreshold > 0 && lines < coThreshold) {
          return false;
        }
      }
      return true;
    });
  }, [rawRows, query, filterNoStaff, filterNoTeam, coFilterMode, coThreshold]);

  // Phân trang
  const total = filtered.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, maxPage);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [safePage, page]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, filterNoStaff, filterNoTeam, coFilterMode, coThreshold]);

  const keyOfRow = useCallback((row) => {
    const soTk = (row.so_tk || "").toString();
    const nhanh = (row.nhanh || "").toString();
    return `${soTk}_${nhanh}`;
  }, []);

  const applyEdit = useCallback((rowKey, updater) => {
    if (isReadOnlyForEdits) return;
    let didChange = false;
    setRawRows(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const pos = prev.findIndex(row => keyOfRow(row) === rowKey);
      if (pos === -1) return prev;
      const current = prev[pos];
      const updates = updater(current);
      if (!updates || typeof updates !== "object") return prev;

      let changed = false;
      const nextRow = { ...current };
      for (const [key, value] of Object.entries(updates)) {
        if (nextRow[key] !== value) {
          nextRow[key] = value;
          changed = true;
        }
      }

      if (!changed) return prev;

      nextRow.updatedAt = new Date().toISOString();
      const recalculated = computeKPI(nextRow, rules);
      if (Number.isFinite(recalculated)) {
        nextRow.kpi = Math.round(recalculated * 10) / 10;
      }
      const copy = prev.slice();
      copy[pos] = nextRow;

      const oldKey = keyOfRow(current);
      const newKey = keyOfRow(nextRow);
      if (oldKey !== newKey) {
        setSelectedKeys(keys => {
          if (!Array.isArray(keys) || keys.length === 0) return keys;
          if (!keys.includes(oldKey)) return keys;
          return keys.filter(k => k !== oldKey);
        });
      }

      didChange = true;
      return copy;
    });
    if (didChange && mode === "saved") {
      setHasUnsaved(true);
    }
  }, [isReadOnlyForEdits, keyOfRow, rules, mode]);

  const onChangeCell = useCallback((rowKey, field, value, transform) => {
    applyEdit(rowKey, (row) => {
      const nextValue = typeof transform === "function" ? transform(value, row) : value;
      if (nextValue === row[field]) return null;
      return { [field]: nextValue };
    });
  }, [applyEdit]);

  const handleToggleSelect = useCallback((row) => {
    const key = keyOfRow(row);
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  }, [keyOfRow]);

  const handleClearSelection = useCallback(() => {
    setSelectedKeys([]);
  }, []);

  const deleteRowsByKeys = useCallback((keys) => {
    if (!Array.isArray(keys) || keys.length === 0) return;
    const keySet = new Set(keys);
    const remaining = rawRows.filter(row => !keySet.has(keyOfRow(row)));
    const removedCount = rawRows.length - remaining.length;
    if (removedCount <= 0) return;
    saveDeclRows(remaining, {
      overwrite: true,
      actor,
      detail: `Xóa ${removedCount} tờ khai từ giao diện Import Data`,
    });
    alert(`Đã xóa ${removedCount} tờ khai.`);
    setHasUnsaved(false);
    loadSavedRows();
    fetchAlerts();
  }, [actor, fetchAlerts, keyOfRow, loadSavedRows, rawRows]);

  const handleDeleteSelected = useCallback(() => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền xóa tờ khai.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ có thể xóa khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để xóa.");
      return;
    }
    if (!window.confirm(`Bạn chắc chắn muốn xóa ${selectedKeys.length} tờ khai đã chọn?`)) {
      return;
    }
    deleteRowsByKeys(selectedKeys);
  }, [deleteRowsByKeys, isReadOnlyForEdits, mode, selectedKeys]);

  const handleDeleteSingle = useCallback((row) => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền xóa tờ khai.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ có thể xóa khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (!window.confirm("Xóa tờ khai này?")) return;
    deleteRowsByKeys([keyOfRow(row)]);
  }, [deleteRowsByKeys, isReadOnlyForEdits, keyOfRow, mode]);

  function handleImport() {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền import dữ liệu. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục.");
      return;
    }
    if (mode !== "preview") {
      alert("Hãy chọn file XLSX để import.");
      return;
    }
    if (rawRows.length === 0) {
      alert("Không có dữ liệu để import");
      return;
    }
    // Nếu cần upsert theo 11 số đầu → chuẩn hoá so_tk về 11 số đầu
    const rows = upsert11
      ? rawRows.map(r => ({ ...r, so_tk: (r.so_tk || "").toString().slice(0, 11) }))
      : rawRows;

    const count = saveDeclRows(rows, {
      overwrite,
      actor,
      detail: `Import từ ${selectedFile || "file XLSX"}`,
    });
    pushImportLog(`Import XLSX: ${rawRows.length} dòng → sau hợp nhất còn ${count}`);
    alert("Import xong!");
    if (fileRef.current) fileRef.current.value = "";
    loadSavedRows({ bypassConfirm: true });
    fetchAlerts();
  }

  function handleSaveAll() {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền lưu chỉnh sửa.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ có thể lưu chỉnh sửa khi đang xem dữ liệu đã lưu. Hãy import file hoặc quay lại chế độ dữ liệu đã lưu.");
      return;
    }
    if (rawRows.length === 0) {
      alert("Không có dữ liệu để lưu");
      return;
    }
    const count = saveDeclRows(rawRows, {
      overwrite: true,
      actor,
      detail: "Lưu chỉnh sửa tờ khai thủ công",
    });
    alert(`Đã lưu ${count} bản ghi (ghi đè).`);
    setHasUnsaved(false);
    loadSavedRows({ bypassConfirm: true });
    fetchAlerts();
  }

  const selectionEnabled = mode === "saved" && (canEdit || canManageAlerts);
  const deleteEnabled = canEdit && mode === "saved";
  const baseColumnCount = 13; // thêm cột C/O
  const totalColumns = baseColumnCount + (selectionEnabled ? 1 : 0) + (deleteEnabled ? 1 : 0);

  const canImport = !isReadOnlyForEdits && mode === "preview" && rawRows.length > 0;
  const canSave = !isReadOnlyForEdits && mode === "saved" && rawRows.length > 0;
  const canDelete = deleteEnabled && selectedKeys.length > 0;
  const canReview = selectionEnabled && selectedKeys.length > 0 && canReviewAlerts;
  const modeLabel = mode === "preview" ? "Đang xem dữ liệu từ file (chưa lưu)" : "Đang xem dữ liệu đã lưu";

  const toneClassMap = {
    success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border border-amber-200 bg-amber-50 text-amber-700",
    danger: "border border-red-200 bg-red-50 text-red-700",
    muted: "border border-gray-200 bg-gray-100 text-gray-600",
  };

  const resolveStatusMeta = (status, fallback, kind = "database") => {
    if (!status) {
      return { tone: "muted", label: fallback, detail: "" };
    }
    if (status.ok) {
      const label = kind === "backend" ? "Backend hoạt động" : "SQL Server sẵn sàng";
      return { tone: "success", label, detail: status.message || "" };
    }
    if (status.state === "not_configured") {
      return { tone: "warning", label: "Chưa cấu hình SQL Server", detail: "" };
    }
    if (status.state === "timeout") {
      return { tone: "danger", label: "Timeout kết nối SQL Server", detail: status.message || "" };
    }
    const detail = status.message || "";
    const label = kind === "backend" ? "Backend gặp sự cố" : "Lỗi kết nối SQL Server";
    return { tone: "danger", label, detail };
  };

  const backendMeta = resolveStatusMeta(statusInfo.backend, "Backend chưa kiểm tra", "backend");
  const databaseMeta = resolveStatusMeta(statusInfo.database, "SQL Server chưa kiểm tra", "database");
  const statusCheckedLabel = statusInfo.checkedAt
    ? new Date(statusInfo.checkedAt).toLocaleString("vi-VN")
    : "Chưa kiểm tra";

  return (
    <div className="space-y-3">
      {isReadOnlyForEdits && !canManageAlerts && (
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-700 p-3 text-sm">
          Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản được cấp quyền để import, chỉnh sửa và lưu dữ liệu tờ khai.
        </div>
      )}
      {isReadOnlyForEdits && canManageAlerts && (
        <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700">
          Bạn có thể rà soát và đánh dấu các tờ khai thiếu thông tin nhưng không thể chỉnh sửa dữ liệu tờ khai.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded border bg-white p-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{card.value?.toLocaleString?.("vi-VN") ?? card.value}</div>
          </div>
        ))}
      </div>

      {canManageSync ? (
        <section className="rounded border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Đồng bộ tự động từ ECUS5VNACCS</h2>
              <p className="text-xs text-gray-500">Lần chạy gần nhất: {syncLastRunLabel} • Trạng thái: {syncConfig?.lastStatus || "Chưa có"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchSyncConfig}
                className="rounded border px-3 py-1 text-sm"
                disabled={syncLoading}
              >
                Tải lại cấu hình
              </button>
              <button
                type="button"
                onClick={fetchSyncStatus}
                className="rounded border px-3 py-1 text-sm"
                disabled={statusLoading}
              >
                {statusLoading ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
              </button>
              <button
                type="button"
                onClick={handleSaveSyncConfig}
                className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                disabled={syncLoading || !syncForm}
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className={`rounded px-2 py-1 ${toneClassMap[backendMeta.tone] || toneClassMap.muted}`}>
                Backend: {backendMeta.label}
              </span>
              <span className={`rounded px-2 py-1 ${toneClassMap[databaseMeta.tone] || toneClassMap.muted}`}>
                SQL Server: {databaseMeta.label}
              </span>
            </div>
            <div className="text-xs text-gray-500">Lần kiểm tra: {statusCheckedLabel}</div>
            {(backendMeta.detail || databaseMeta.detail) && (
              <div className="text-xs text-gray-500">
                {[backendMeta.detail, databaseMeta.detail].filter(Boolean).join(" • ")}
              </div>
            )}
            {statusError && <div className="text-xs text-red-600">{statusError}</div>}
            {lastSyncSummary && (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                <div className="font-medium text-emerald-800">Kết quả lần chạy gần nhất</div>
                <div className="mt-1 flex flex-wrap gap-3">
                  {lastSyncRangeLabel && <span>Khoảng: {lastSyncRangeLabel}</span>}
                  <span>Thu thập: {lastSyncFetched.toLocaleString("vi-VN")}</span>
                  <span>Thêm mới: {lastSyncInserted.toLocaleString("vi-VN")}</span>
                  <span>Bỏ qua: {lastSyncSkipped.toLocaleString("vi-VN")}</span>
                  <span>Tổng sau đồng bộ: {lastSyncTotal.toLocaleString("vi-VN")}</span>
                </div>
              </div>
            )}
          </div>
          {syncForm ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={syncForm.enabled}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span>Bật đồng bộ định kỳ</span>
                </label>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Biểu thức cron</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.schedule}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, schedule: e.target.value }))}
                    placeholder="0 * * * *"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Khoảng mặc định (số ngày)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.rangeDays}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, rangeDays: Number(e.target.value) || 1 }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={syncForm.preferMonthFirst}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, preferMonthFirst: e.target.checked }))}
                  />
                  <span>Ngày dạng MM/DD/YYYY</span>
                </label>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Máy chủ SQL Server</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.server}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, server: e.target.value }))}
                    placeholder="192.168.x.x\\SQL2019"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Cơ sở dữ liệu</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.database}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, database: e.target.value }))}
                    placeholder="ECUS5VNACCS"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Tài khoản</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.user}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, user: e.target.value }))}
                    placeholder="sa"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Mật khẩu</label>
                  <input
                    type="password"
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.password}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={syncForm.hasPassword ? "(giữ nguyên nếu để trống)" : "Nhập mật khẩu"}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Khoảng thời gian chạy tay</span>
                <div className="flex flex-wrap items-center gap-1">
                  {RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      onClick={() => applyRangePreset(preset.days)}
                      disabled={syncRunning}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-500">hoặc chọn ngày cụ thể</span>
                <input
                  type="date"
                  className="rounded border px-2 py-1 text-sm"
                  value={manualRange.from}
                  onChange={(e) => handleManualRangeChange("from", e.target.value)}
                  disabled={syncRunning}
                />
                <span className="text-xs text-gray-500">đến</span>
                <input
                  type="date"
                  className="rounded border px-2 py-1 text-sm"
                  value={manualRange.to}
                  onChange={(e) => handleManualRangeChange("to", e.target.value)}
                  disabled={syncRunning}
                />
                <button
                  type="button"
                  onClick={handlePreviewSync}
                  disabled={previewLoading || syncRunning}
                  className="rounded border border-emerald-600 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {previewLoading ? "Đang xem trước..." : "Xem trước dữ liệu"}
                </button>
                <button
                  type="button"
                  onClick={handleRunSync}
                  disabled={syncRunning}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {syncRunning ? "Đang đồng bộ..." : "Đồng bộ ngay"}
                </button>
              </div>
              {previewRangeInfo && (
                <div className="text-xs text-gray-500">
                  Khoảng xem trước: {(previewRangeInfo.from || "...")} → {(previewRangeInfo.to || "...")}
                  {previewLimited && " (giới hạn 100 dòng đầu tiên)"}
                </div>
              )}
              {previewError && <div className="text-xs text-red-600">{previewError}</div>}
              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">
                    Xem trước {previewRows.length.toLocaleString("vi-VN")} dòng đầu tiên sẽ nhập vào hệ thống.
                  </div>
                  <div className="max-h-64 overflow-auto rounded border">
                    <table className="min-w-full text-xs">
                      <thead className="bg-emerald-50 text-emerald-800">
                        <tr>
                          <th className="px-2 py-1 text-left">Số tờ khai</th>
                          <th className="px-2 py-1 text-left">Ngày</th>
                          <th className="px-2 py-1 text-left">MST</th>
                          <th className="px-2 py-1 text-left">Công ty</th>
                          <th className="px-2 py-1 text-left">Nhân viên</th>
                          <th className="px-2 py-1 text-left">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={`${row.so_tk}_${row.nhanh || ""}`} className="odd:bg-white even:bg-emerald-50/40">
                            <td className="px-2 py-1">{row.so_tk}</td>
                            <td className="px-2 py-1">{row.date}</td>
                            <td className="px-2 py-1">{row.mst}</td>
                            <td className="px-2 py-1">{row.cong_ty}</td>
                            <td className="px-2 py-1">{row.nhan_vien || <span className="italic text-gray-400">(chưa gán)</span>}</td>
                            <td className="px-2 py-1">
                              {row.status === "existing" ? (
                                <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Đã có</span>
                              ) : (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Mới</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {syncMessage && <div className="text-sm text-emerald-600">{syncMessage}</div>}
              {syncError && <div className="text-sm text-red-600">{syncError}</div>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">Đang tải cấu hình đồng bộ...</p>
          )}
        </section>
      ) : (
        <section className="rounded border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Đồng bộ ECUS</h2>
              <p className="text-xs text-gray-500">Lần chạy gần nhất: {syncLastRunLabel} • Trạng thái: {syncConfig?.lastStatus || "Chưa có"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  fetchSyncConfig();
                  fetchSyncStatus();
                }}
                className="rounded border px-3 py-1 text-sm"
                disabled={syncLoading || statusLoading}
              >
                {statusLoading ? "Đang kiểm tra..." : "Cập nhật trạng thái"}
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className={`rounded px-2 py-1 ${toneClassMap[backendMeta.tone] || toneClassMap.muted}`}>
                Backend: {backendMeta.label}
              </span>
              <span className={`rounded px-2 py-1 ${toneClassMap[databaseMeta.tone] || toneClassMap.muted}`}>
                SQL Server: {databaseMeta.label}
              </span>
            </div>
            <div className="text-xs text-gray-500">Lần kiểm tra: {statusCheckedLabel}</div>
            {(backendMeta.detail || databaseMeta.detail) && (
              <div className="text-xs text-gray-500">
                {[backendMeta.detail, databaseMeta.detail].filter(Boolean).join(" • ")}
              </div>
            )}
            {statusError && <div className="text-xs text-red-600">{statusError}</div>}
            {lastSyncSummary && (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                <div className="font-medium text-emerald-800">Kết quả đồng bộ gần nhất</div>
                <div className="mt-1 flex flex-wrap gap-3">
                  {lastSyncRangeLabel && <span>Khoảng: {lastSyncRangeLabel}</span>}
                  <span>Thu thập: {lastSyncFetched.toLocaleString("vi-VN")}</span>
                  <span>Thêm mới: {lastSyncInserted.toLocaleString("vi-VN")}</span>
                  <span>Bỏ qua: {lastSyncSkipped.toLocaleString("vi-VN")}</span>
                  <span>Tổng sau đồng bộ: {lastSyncTotal.toLocaleString("vi-VN")}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cảnh báo tờ khai thiếu thông tin</h2>
            <p className="text-xs text-gray-500">Lần rà soát: {lastAlertEvaluated} • Tổng theo dõi: {alertSummary.totalTracked || 0}</p>
          </div>
          <button type="button" onClick={handleRefreshAlerts} className="rounded border px-3 py-1 text-sm" disabled={alertLoading}>
            Làm mới danh sách
          </button>
        </div>
        {alertLoading ? (
          <p className="mt-3 text-sm text-gray-500">Đang tải danh sách cảnh báo...</p>
        ) : outstandingAlerts.length ? (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left">Số tờ khai</th>
                  <th className="px-2 py-1 text-left">MST</th>
                  <th className="px-2 py-1 text-left">Công ty</th>
                  <th className="px-2 py-1 text-left">Thiếu thông tin</th>
                  <th className="px-2 py-1 text-left">Ngày tờ khai</th>
                  <th className="px-2 py-1 text-left">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {outstandingAlerts.map((alert) => (
                  <tr key={alert.key} className="odd:bg-white even:bg-gray-50">
                    <td className="px-2 py-1">{alert.so_tk}</td>
                    <td className="px-2 py-1">{alert.mst}</td>
                    <td className="px-2 py-1">{alert.company}</td>
                    <td className="px-2 py-1 text-amber-600">{(alert.missing || []).join(", ")}</td>
                    <td className="px-2 py-1">{alert.date || ""}</td>
                    <td className="px-2 py-1">{alert.lastUpdated ? new Date(alert.lastUpdated).toLocaleString("vi-VN") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Không có cảnh báo nào đang chờ xử lý.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          data-testid="import-file-input"
          ref={fileRef}
          onChange={handleFileChange}
          accept=".xls,.xlsx"
          className="hidden"
          disabled={isReadOnlyForEdits}
        />
        {canEdit && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded border bg-white shadow-sm hover:bg-gray-50"
          >
            Chọn file XLSX
          </button>
        )}
        {selectedFile && (
          <span className="text-sm text-gray-600">Đã chọn: {selectedFile}</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className={`px-3 py-1.5 rounded ${canImport ? "bg-black text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
          >
            Import XLSX
          </button>
        )}
        <button
          type="button"
          onClick={() => loadSavedRows()}
          className="px-3 py-1.5 rounded border"
        >
          Hiển thị dữ liệu đã lưu
        </button>
        <span className="ml-auto text-sm text-gray-600">{modeLabel}</span>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={autoAssignStaff} onChange={e => setAutoAssignStaff(e.target.checked)} />
            <span>Tự gán nhân viên theo MST nếu trống (ON)</span>
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={upsert11} onChange={e => setUpsert11(e.target.checked)} />
            <span>Upsert theo 11 số đầu của Số tờ khai</span>
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
            <span>Ghi đè toàn bộ dữ liệu hiện có</span>
          </label>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="border rounded px-2 py-1 w-72"
          placeholder="Tìm nhanh (Số TK / MST / Công ty / Đại lý)"
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
        />
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={filterNoStaff}
            onChange={e => setFilterNoStaff(e.target.checked)}
          />
          <span>Chưa gán Nhân viên</span>
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={filterNoTeam}
            onChange={e => setFilterNoTeam(e.target.checked)}
          />
          <span>Chưa gán Tổ đội</span>
        </label>
        <label className="flex items-center gap-1 text-sm">
          <span>Lọc C/O</span>
          <select
            value={coFilterMode}
            onChange={(e) => setCoFilterMode(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {CO_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {coFilterMode === "min" && (
          <label className="flex items-center gap-1 text-sm">
            <span>Tối thiểu dòng C/O</span>
            <input
              type="number"
              min={0}
              className="w-20 border rounded px-2 py-1 text-sm"
              value={coFilterMin}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) {
                  setCoFilterMin(0);
                  return;
                }
                if (raw <= 0) {
                  setCoFilterMin(0);
                  return;
                }
                setCoFilterMin(Math.round(raw));
              }}
            />
          </label>
        )}
        {coFilterActive && (
          <span className="text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700">
            Đáp ứng C/O: {coFilterMatches} tờ khai
          </span>
        )}
        <div className="opacity-70 text-sm">
          {total} dòng — Trang {safePage}/{maxPage}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value) || DEFAULT_PAGE_SIZE)}
            className="border rounded px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}/trang</option>
            ))}
          </select>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded">« Trước</button>
          <button onClick={() => setPage(p => Math.min(maxPage, p + 1))} className="px-2 py-1 border rounded">Sau »</button>
          {canEdit && (
            <button
              onClick={handleSaveAll}
              disabled={!canSave}
              className={`px-3 py-1 rounded border ${canSave ? "" : "opacity-50 cursor-not-allowed"}`}
            >
              Lưu chỉnh sửa
            </button>
          )}
        </div>
      </div>

      {!query && mode === "saved" && (
        <div className="text-xs text-gray-500">
          Hiển thị tối đa {pageSize} dòng trên một trang. Nhập từ khóa hoặc dùng bộ lọc để tìm thêm tờ khai.
        </div>
      )}

      {selectionEnabled && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Đã chọn {selectedKeys.length} tờ khai</span>
          <button
            type="button"
            onClick={handleMarkReviewed}
            disabled={!canReview}
            className={`px-3 py-1 rounded border ${
              canReview ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "opacity-50 cursor-not-allowed"
            }`}
          >
            Đánh dấu đã rà soát
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={!canDelete}
              className={`px-3 py-1 rounded border ${
                canDelete ? "bg-red-50 text-red-600 border-red-300" : "opacity-50 cursor-not-allowed"
              }`}
            >
              Xóa các tờ khai đã chọn
            </button>
          )}
          {selectedKeys.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3 py-1 rounded border"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto overflow-y-hidden border rounded">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              {selectionEnabled && <th className="px-2 py-1 text-left w-10">Chọn</th>}
              <th className="px-2 py-1 text-left">Ngày</th>
              <th className="px-2 py-1 text-left">Số tờ khai</th>
              <th className="px-2 py-1 text-left">MST</th>
              <th className="px-2 py-1 text-left">Công ty</th>
              <th className="px-2 py-1 text-left">Loại hình</th>
              <th className="px-2 py-1 text-left">C/O</th>
              <th className="px-2 py-1 text-left">Mục hàng</th>
              <th className="px-2 py-1 text-left">Nhân viên</th>
              <th className="px-2 py-1 text-left">Tổ đội</th>
              <th className="px-2 py-1 text-left">Đại lý</th>
              <th className="px-2 py-1 text-left">Trạng thái</th>
              <th className="px-2 py-1 text-left">Số lượng GP</th>
              <th className="px-2 py-1 text-left">KPI</th>
              {canEdit && mode === "saved" && <th className="px-2 py-1 text-left w-16">Xóa</th>}
            </tr>
          </thead>
          <tbody>
          {pageRows.map((r, i) => {
            const rowKey = keyOfRow(r);
            return (
              <tr key={`${rowKey}_${i}`} className="odd:bg-white even:bg-gray-50">
                {selectionEnabled && (
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(rowKey)}
                      onChange={() => handleToggleSelect(r)}
                    />
                  </td>
                )}
                <td className="px-2 py-1">
                  <span>{r.raw_date || r.date || ""}</span>
                </td>
                <td className="px-2 py-1">
                  <span>{r.so_tk || ""}</span>
                </td>
                <td className="px-2 py-1">
                  <span>{r.mst || ""}</span>
                </td>
                <td className="px-2 py-1">
                  <span>{r.cong_ty || ""}</span>
                </td>
                <td className="px-2 py-1">
                  <span>{r.loai_hinh || ""}</span>
                </td>
                <td className="px-2 py-1">
                  {(() => {
                    const lines = coLineCount(r);
                    const status = coLabel(r);
                    const display = lines > 0 ? String(lines) : status;
                    const hasValue = !!display;
                    return (
                      <span className={hasValue ? "text-emerald-600 font-medium" : "text-gray-400"}>
                        {display || ""}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-2 py-1">
                  <span>{r.muc_hang ?? ""}</span>
                </td>
                <td className="px-2 py-1">
                  {isReadOnlyForEdits ? (
                    <span>{r.nhan_vien || ""}</span>
                  ) : (
                    <input
                      className="border rounded px-1 py-0.5 w-32"
                      value={r.nhan_vien || ""}
                      onChange={e => onChangeCell(rowKey, "nhan_vien", e.target.value)}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {isReadOnlyForEdits ? (
                    <span>{r.team || ""}</span>
                  ) : (
                    <input
                      className="border rounded px-1 py-0.5 w-24"
                      value={r.team || ""}
                      onChange={e => onChangeCell(rowKey, "team", e.target.value)}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {isReadOnlyForEdits ? (
                    <span>{r.agency || r.dai_ly || ""}</span>
                  ) : (
                    <input
                      className="border rounded px-1 py-0.5 w-28"
                      value={r.agency || r.dai_ly || ""}
                      onChange={e => applyEdit(rowKey, () => ({ agency: e.target.value, dai_ly: e.target.value }))}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {(() => {
                    const hasStaff = !!(r.nhan_vien && r.nhan_vien.toString().trim());
                    const hasTeam = !!(r.team && r.team.toString().trim());
                    if (r.reviewed) {
                      return <span className="text-emerald-700">Đã rà soát</span>;
                    }
                    if (!hasStaff || !hasTeam) {
                      const missing = [];
                      if (!hasStaff) missing.push("nhân viên");
                      if (!hasTeam) missing.push("tổ đội");
                      return <span className="text-amber-600">Thiếu {missing.join(" & ")}</span>;
                    }
                    return <span className="text-gray-600">Đủ thông tin</span>;
                  })()}
                </td>
                <td className="px-2 py-1">
                  {isReadOnlyForEdits ? (
                    <span>{r.licenses ?? r.so_luong_gp ?? ""}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="border rounded px-1 py-0.5 w-24"
                      value={r.licenses ?? r.so_luong_gp ?? ""}
                      onChange={e => {
                        const input = e.target.value;
                        if (input === "") {
                          applyEdit(rowKey, () => ({ licenses: "", so_luong_gp: "" }));
                          return;
                        }
                        const parsed = Number(input);
                        if (!Number.isFinite(parsed)) return;
                        const normalized = Math.max(0, Math.round(parsed));
                        applyEdit(rowKey, () => ({ licenses: normalized, so_luong_gp: normalized }));
                      }}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {(() => {
                    const kpi = computeKPI(r, rules);
                    if (!Number.isFinite(kpi)) return "-";
                    return kpi.toFixed(1);
                  })()}
                </td>
                {deleteEnabled && (
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(r)}
                      className="px-2 py-0.5 rounded bg-red-500 text-white text-xs"
                    >
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
            {pageRows.length === 0 && (
              <tr>
                <td className="px-2 py-4 text-center text-gray-500" colSpan={totalColumns}>
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        * Số lượng GP được tự động đếm theo các loại giấy phép hợp lệ (đã loại trừ theo mục Quy tắc KPI).
        Bạn có thể điều chỉnh thủ công trước khi lưu để phản ánh thực tế kiểm tra.
      </p>
    </div>
  );
}
