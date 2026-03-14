import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_SYNC_CONFIG,
  formatMstListForInput,
  parseMstListInput,
} from "@/components/dataImporter/dataImporterConfig.js";
import { formatDateRangeLabel } from "../../../packages/domain/src/format.js";

const DEFAULT_ALERT_SUMMARY = {
  outstanding: 0,
  totalTracked: 0,
  lastEvaluatedAt: null,
};

const DEFAULT_STATUS_INFO = {
  backend: null,
  database: null,
  checkedAt: null,
};

function buildMstFilterNotice(includeTaxCodes, excludeTaxCodes) {
  if (!includeTaxCodes.length && !excludeTaxCodes.length) {
    return "";
  }

  const parts = [];
  if (includeTaxCodes.length) {
    parts.push(`chỉ MST: ${includeTaxCodes.join(", ")}`);
  }
  if (excludeTaxCodes.length) {
    parts.push(`loại trừ MST: ${excludeTaxCodes.join(", ")}`);
  }

  return parts.length ? `Lọc theo ${parts.join("; ")}` : "";
}

export default function useDataImporterSync({
  actor = "system",
  canManageSync = false,
  fetchWithAuth,
  refreshDeclRowsFromServer,
  loadSavedRows,
  onAfterSyncSuccess,
}) {
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
    includeTaxCodesText: formatMstListForInput(DEFAULT_SYNC_CONFIG.includeTaxCodes),
    excludeTaxCodesText: formatMstListForInput(DEFAULT_SYNC_CONFIG.excludeTaxCodes),
  }));
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [manualRange, setManualRange] = useState({ from: "", to: "" });
  const [alertSummary, setAlertSummary] = useState(DEFAULT_ALERT_SUMMARY);
  const [alertEntries, setAlertEntries] = useState([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState(DEFAULT_STATUS_INFO);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRangeInfo, setPreviewRangeInfo] = useState(null);

  const previewRangeLabel = useMemo(() => formatDateRangeLabel(previewRangeInfo), [previewRangeInfo]);

  const activeIncludeTaxCodes = useMemo(
    () => parseMstListInput(syncForm?.includeTaxCodesText || []),
    [syncForm?.includeTaxCodesText]
  );

  const activeExcludeTaxCodes = useMemo(
    () => parseMstListInput(syncForm?.excludeTaxCodesText || []),
    [syncForm?.excludeTaxCodesText]
  );

  const mstFilterNotice = useMemo(
    () => buildMstFilterNotice(activeIncludeTaxCodes, activeExcludeTaxCodes),
    [activeExcludeTaxCodes, activeIncludeTaxCodes]
  );

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
      includeTaxCodesText: formatMstListForInput(normalizedConfig.includeTaxCodes),
      excludeTaxCodesText: formatMstListForInput(normalizedConfig.excludeTaxCodes),
    });
  }, []);

  useEffect(() => {
    setPreviewRows([]);
    setPreviewLimited(false);
    setPreviewError("");
    setPreviewRangeInfo(null);
  }, [manualRange.from, manualRange.to]);

  const fetchSyncConfig = useCallback(async (options = {}) => {
    const { preserveMessage = false } = options;
    setSyncLoading(true);
    setSyncError("");

    try {
      const response = await fetchWithAuth("/api/import/ecus/config", {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (payload?.config) {
        applyConfigToForm(payload.config);
        if (!preserveMessage) {
          setSyncMessage("Đã tải cấu hình đồng bộ mới nhất.");
        }
      } else {
        if (!preserveMessage) {
          setSyncMessage("Không tìm thấy cấu hình lưu trữ, sử dụng giá trị mặc định.");
        }
        applyConfigToForm(DEFAULT_SYNC_CONFIG);
      }
    } catch (err) {
      console.error("Không thể tải cấu hình đồng bộ ECUS", err);
      setSyncError(
        "Không thể tải cấu hình đồng bộ ECUS. Hãy kiểm tra dịch vụ backend (pnpm server) hoặc kết nối mạng LAN."
      );
      if (!preserveMessage) {
        setSyncMessage("");
      }
      applyConfigToForm(DEFAULT_SYNC_CONFIG);
    } finally {
      setSyncLoading(false);
    }
  }, [applyConfigToForm, fetchWithAuth]);

  const fetchSyncStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");

    try {
      const response = await fetchWithAuth("/api/import/ecus/status", {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      setStatusInfo({
        backend: payload?.backend || null,
        database: payload?.database || null,
        checkedAt: payload?.database?.checkedAt || payload?.backend?.checkedAt || new Date().toISOString(),
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
  }, [applyConfigToForm, fetchWithAuth]);

  const fetchAlerts = useCallback(async () => {
    setAlertLoading(true);

    try {
      const response = await fetchWithAuth("/api/import/alerts", {
        cache: "no-store",
        credentials: "include",
      });

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
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchSyncConfig();
    fetchAlerts();
    fetchSyncStatus();
  }, [fetchAlerts, fetchSyncConfig, fetchSyncStatus]);

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
      const includeTaxCodes = activeIncludeTaxCodes;
      const excludeTaxCodes = activeExcludeTaxCodes;
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
          includeTaxCodes,
          excludeTaxCodes,
        },
        preservePassword: !syncForm.password && syncForm.hasPassword,
      };

      if (syncForm.password) {
        payload.config.connection.password = syncForm.password;
      }
      if (syncConfig?.columnMap) {
        payload.config.columnMap = syncConfig.columnMap;
      }

      const response = await fetchWithAuth("/api/import/ecus/config", {
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
  }, [
    activeExcludeTaxCodes,
    activeIncludeTaxCodes,
    applyConfigToForm,
    canManageSync,
    fetchWithAuth,
    syncConfig,
    syncForm,
  ]);

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
      const response = await fetchWithAuth("/api/import/ecus/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor,
          from: manualRange.from || undefined,
          to: manualRange.to || undefined,
          includeTaxCodes: activeIncludeTaxCodes,
          excludeTaxCodes: activeExcludeTaxCodes,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const imported = payload?.result?.imported ?? 0;
      const skipped = payload?.result?.skipped ?? 0;
      const locked = payload?.result?.reviewLocked ?? 0;
      const skippedNote = skipped > 0 ? `, bỏ qua ${skipped} tờ khai đã có` : "";
      const lockedNote = locked > 0 ? `, khóa ${locked} tờ khai đã rà soát` : "";
      const baseMessage = `Đã đồng bộ ${imported} tờ khai mới từ ECUS${skippedNote}${lockedNote}.`;
      const messageParts = [baseMessage];

      if (mstFilterNotice) {
        messageParts.push(`${mstFilterNotice}.`);
      }

      setSyncMessage(messageParts.join(" ").replace(/\s+/g, " ").trim());
      setPreviewRows([]);
      setPreviewRangeInfo(null);
      setPreviewLimited(false);
      setPreviewError("");

      await fetchSyncConfig({ preserveMessage: true });
      await fetchSyncStatus();
      await fetchAlerts();
      if (typeof onAfterSyncSuccess === "function") {
        await onAfterSyncSuccess();
      }

      try {
        await refreshDeclRowsFromServer();
      } catch (refreshError) {
        console.error("Không thể tải dữ liệu tờ khai sau đồng bộ", refreshError);
      }

      loadSavedRows({ bypassConfirm: true });
    } catch (err) {
      console.error("Đồng bộ ECUS thất bại", err);
      setSyncMessage("");
      setSyncError(err?.message || "Không thể đồng bộ ECUS");
    } finally {
      setSyncRunning(false);
    }
  }, [
    actor,
    activeExcludeTaxCodes,
    activeIncludeTaxCodes,
    canManageSync,
    fetchAlerts,
    fetchSyncConfig,
    fetchSyncStatus,
    fetchWithAuth,
    loadSavedRows,
    manualRange.from,
    manualRange.to,
    mstFilterNotice,
    onAfterSyncSuccess,
    refreshDeclRowsFromServer,
  ]);

  const handlePreviewSync = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền xem trước dữ liệu đồng bộ.");
      return { ok: false, denied: true };
    }

    setPreviewLoading(true);
    setPreviewError("");

    try {
      const response = await fetchWithAuth("/api/import/ecus/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: manualRange.from || undefined,
          to: manualRange.to || undefined,
          limit: 100,
          includeTaxCodes: activeIncludeTaxCodes,
          excludeTaxCodes: activeExcludeTaxCodes,
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
        const baseMessage = "Không tìm thấy tờ khai mới trong khoảng thời gian đã chọn.";
        setPreviewError(mstFilterNotice ? `${baseMessage} (${mstFilterNotice}).` : baseMessage);
      }

      return {
        ok: true,
        rows,
        limited: !!payload?.preview?.limited,
        range: payload?.preview?.range || null,
      };
    } catch (err) {
      console.error("Không thể xem trước dữ liệu ECUS", err);
      setPreviewError(err?.message || "Không thể xem trước dữ liệu đồng bộ");
      setPreviewRows([]);
      setPreviewLimited(false);
      setPreviewRangeInfo(null);
      return { ok: false, error: err };
    } finally {
      setPreviewLoading(false);
    }
  }, [
    activeExcludeTaxCodes,
    activeIncludeTaxCodes,
    canManageSync,
    fetchWithAuth,
    manualRange.from,
    manualRange.to,
    mstFilterNotice,
  ]);

  const handleRefreshAlerts = useCallback(() => {
    return fetchAlerts();
  }, [fetchAlerts]);

  const handleManualRangeChange = useCallback((field, value) => {
    setManualRange((prev) => ({ ...prev, [field]: value }));
  }, []);

  return {
    syncConfig,
    syncForm,
    setSyncForm,
    syncLoading,
    syncRunning,
    syncMessage,
    syncError,
    manualRange,
    setManualRange,
    handleManualRangeChange,
    alertSummary,
    alertEntries,
    alertLoading,
    statusInfo,
    statusLoading,
    statusError,
    previewRows,
    previewLimited,
    previewLoading,
    previewError,
    previewRangeInfo,
    previewRangeLabel,
    activeIncludeTaxCodes,
    activeExcludeTaxCodes,
    mstFilterNotice,
    fetchSyncConfig,
    fetchSyncStatus,
    handleRefreshAlerts,
    handleSaveSyncConfig,
    handleRunSync,
    handlePreviewSync,
  };
}
