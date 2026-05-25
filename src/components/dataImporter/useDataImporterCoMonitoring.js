import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

import { formatDateRangeLabel } from "../../../packages/domain/src/format.js";
import {
  joinCodeList,
  parseCodeListInput,
} from "@/components/dataImporter/dataImporterLicenseUtils.js";

const CO_CODES_ROUTE = "/api/v4/declarations/imports/co-codes";
const CO_DISCREPANCY_ROUTE = "/api/v4/declarations/imports/co-discrepancy";
const CO_DISCREPANCY_CONFIG_ROUTE = "/api/v4/declarations/imports/co-discrepancy/config";
const CO_DISCREPANCY_RUN_ROUTE = "/api/v4/declarations/imports/co-discrepancy/run";

const DEFAULT_CO_DISCREPANCY_FORM = {
  enabled: false,
  cron: "",
  rangeDays: 3,
  threshold: 10,
  sampleLimit: 500,
};

const DEFAULT_CO_DISCREPANCY_STATUS = {
  lastRunAt: null,
  range: null,
  mismatchCount: 0,
  totalChecked: 0,
  status: "idle",
  error: null,
  durationMs: 0,
  mismatches: [],
  triggered: false,
  limited: false,
  actor: null,
  reason: null,
};

function normalizeCoCodeConfig(config) {
  const whitelist = Array.isArray(config?.whitelist) ? config.whitelist : [];
  const blacklist = Array.isArray(config?.blacklist) ? config.blacklist : [];

  return {
    ...(config && typeof config === "object" ? config : {}),
    version: Number.isInteger(config?.version) ? config.version : 1,
    updatedAt: config?.updatedAt || null,
    updatedBy: config?.updatedBy || null,
    whitelist,
    blacklist,
  };
}

function normalizeCoDiscrepancyConfig(config) {
  const enabled = config?.enabled === true;
  const cron = (config?.cron || "").trim();
  const rangeDays = Math.max(1, Math.round(Number(config?.rangeDays) || 3));
  const threshold = Math.max(1, Math.round(Number(config?.threshold) || 10));
  const sampleLimitRaw = Number(config?.sampleLimit);
  const sampleLimit = Number.isFinite(sampleLimitRaw) ? Math.max(0, Math.round(sampleLimitRaw)) : 0;

  return {
    ...(config && typeof config === "object" ? config : {}),
    enabled,
    cron,
    rangeDays,
    threshold,
    sampleLimit,
    updatedAt: config?.updatedAt || null,
    updatedBy: config?.updatedBy || null,
  };
}

function normalizeCoDiscrepancyRange(range) {
  if (!range || typeof range !== "object" || Array.isArray(range)) {
    return null;
  }

  const from = `${range.from ?? ""}`.trim();
  const to = `${range.to ?? ""}`.trim();
  if (!from && !to) {
    return null;
  }

  return { from, to };
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function normalizeCoDiscrepancyState(state) {
  const mismatches = Array.isArray(state?.mismatches) ? state.mismatches : [];
  const mismatchCount = normalizeNonNegativeInteger(state?.mismatchCount, mismatches.length);

  return {
    ...DEFAULT_CO_DISCREPANCY_STATUS,
    ...(state && typeof state === "object" ? state : {}),
    lastRunAt: state?.lastRunAt || null,
    range: normalizeCoDiscrepancyRange(state?.range),
    mismatchCount,
    totalChecked: normalizeNonNegativeInteger(state?.totalChecked, 0),
    status: `${state?.status ?? DEFAULT_CO_DISCREPANCY_STATUS.status}`.trim() || DEFAULT_CO_DISCREPANCY_STATUS.status,
    error: state?.error || null,
    durationMs: normalizeNonNegativeInteger(state?.durationMs, 0),
    mismatches,
    triggered: state?.triggered === true,
    limited: state?.limited === true,
    actor: state?.actor || null,
    reason: state?.reason || null,
  };
}

function buildCoDiscrepancyStatusLabel(state) {
  if (!state) {
    return "Chưa chạy";
  }

  if (state.status === "error") {
    return "Lỗi đối soát";
  }

  if ((state.mismatchCount ?? 0) > 0) {
    return state.triggered ? "Vượt ngưỡng cảnh báo" : "Có chênh lệch";
  }

  if (state.status === "ok" || state.status === "success") {
    return "Đã đối soát";
  }

  if (!state.lastRunAt) {
    return "Chưa chạy";
  }

  return state.status || "Chưa chạy";
}

function buildCoDiscrepancyRunMessage(state) {
  const mismatchCount = Number(state?.mismatchCount ?? 0);
  const totalChecked = Number(state?.totalChecked ?? 0);
  const limitedNote = state?.limited ? ", đã cắt bớt danh sách do vượt giới hạn mẫu" : "";

  if (mismatchCount > 0) {
    return `Đã chạy đối soát C/O: phát hiện ${mismatchCount.toLocaleString("vi-VN")} chênh lệch trên ${totalChecked.toLocaleString("vi-VN")} tờ khai${limitedNote}.`;
  }

  return `Đã chạy đối soát C/O: không phát hiện chênh lệch trên ${totalChecked.toLocaleString("vi-VN")} tờ khai${limitedNote}.`;
}

export default function useDataImporterCoMonitoring({
  canManageSync = false,
  fetchWithAuth,
  extractErrorMessage,
}) {
  const { alert } = useAppDialog();
  const [coCodeConfig, setCoCodeConfig] = useState(null);
  const [coCodeForm, setCoCodeForm] = useState({ whitelist: "", blacklist: "" });
  const [coCodeLoading, setCoCodeLoading] = useState(false);
  const [coCodeSaving, setCoCodeSaving] = useState(false);
  const [coCodeError, setCoCodeError] = useState("");
  const [coCodeMessage, setCoCodeMessage] = useState("");

  const [coDiscrepancyConfig, setCoDiscrepancyConfig] = useState(null);
  const [coDiscrepancyState, setCoDiscrepancyState] = useState(null);
  const [coDiscrepancyForm, setCoDiscrepancyForm] = useState(DEFAULT_CO_DISCREPANCY_FORM);
  const [coDiscrepancyRange, setCoDiscrepancyRange] = useState({ from: "", to: "" });
  const [coDiscrepancyLoading, setCoDiscrepancyLoading] = useState(false);
  const [coDiscrepancySaving, setCoDiscrepancySaving] = useState(false);
  const [coDiscrepancyRunning, setCoDiscrepancyRunning] = useState(false);
  const [coDiscrepancyError, setCoDiscrepancyError] = useState("");
  const [coDiscrepancyMessage, setCoDiscrepancyMessage] = useState("");

  const syncCoCodeForm = useCallback((config) => {
    const nextConfig = normalizeCoCodeConfig(config);

    setCoCodeConfig(nextConfig);
    setCoCodeForm({
      whitelist: joinCodeList(nextConfig.whitelist),
      blacklist: joinCodeList(nextConfig.blacklist),
    });
  }, []);

  const fetchCoCodeConfig = useCallback(async () => {
    setCoCodeLoading(true);
    setCoCodeError("");

    try {
      const response = await fetchWithAuth(CO_CODES_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể tải cấu hình mã ưu đãi C/O.");
        throw new Error(message);
      }

      const payload = await response.json();
      syncCoCodeForm(payload?.config || {});
    } catch (err) {
      console.error("Không thể tải cấu hình mã ưu đãi C/O", err);
      setCoCodeError(err?.message || "Không thể tải cấu hình mã ưu đãi C/O.");
    } finally {
      setCoCodeLoading(false);
    }
  }, [extractErrorMessage, fetchWithAuth, syncCoCodeForm]);

  const handleSaveCoCodeConfig = useCallback(async () => {
    if (!canManageSync) {
      await alert("Bạn không có quyền cập nhật cấu hình mã ưu đãi C/O.");
      return;
    }

    setCoCodeSaving(true);
    setCoCodeError("");
    setCoCodeMessage("");

    try {
      const payload = {
        config: {
          whitelist: parseCodeListInput(coCodeForm.whitelist),
          blacklist: parseCodeListInput(coCodeForm.blacklist),
        },
      };

      const response = await fetchWithAuth(CO_CODES_ROUTE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể lưu cấu hình mã ưu đãi C/O.");
        throw new Error(message);
      }

      const result = await response.json();
      syncCoCodeForm(result?.config || payload.config);
      setCoCodeMessage("Đã lưu cấu hình mã ưu đãi C/O.");
    } catch (err) {
      console.error("Không thể lưu cấu hình mã ưu đãi C/O", err);
      setCoCodeError(err?.message || "Không thể lưu cấu hình mã ưu đãi C/O.");
    } finally {
      setCoCodeSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageSync, coCodeForm, extractErrorMessage, fetchWithAuth, syncCoCodeForm]);

  const handleResetCoCodeForm = useCallback(() => {
    if (coCodeConfig) {
      setCoCodeForm({
        whitelist: joinCodeList(coCodeConfig.whitelist),
        blacklist: joinCodeList(coCodeConfig.blacklist),
      });
      setCoCodeError("");
      setCoCodeMessage("");
      return;
    }

    setCoCodeForm({ whitelist: "", blacklist: "" });
  }, [coCodeConfig]);

  const syncCoDiscrepancyConfig = useCallback((config) => {
    const nextConfig = normalizeCoDiscrepancyConfig(config);

    setCoDiscrepancyConfig(nextConfig);
    setCoDiscrepancyForm({
      enabled: nextConfig.enabled,
      cron: nextConfig.cron,
      rangeDays: nextConfig.rangeDays,
      threshold: nextConfig.threshold,
      sampleLimit: nextConfig.sampleLimit,
    });
  }, []);

  const syncCoDiscrepancyState = useCallback((state) => {
    if (!state || typeof state !== "object") {
      setCoDiscrepancyState(null);
      return null;
    }

    const nextState = normalizeCoDiscrepancyState(state);
    setCoDiscrepancyState(nextState);
    return nextState;
  }, []);

  const fetchCoDiscrepancy = useCallback(async () => {
    setCoDiscrepancyLoading(true);
    setCoDiscrepancyError("");

    try {
      const response = await fetchWithAuth(CO_DISCREPANCY_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể tải trạng thái đối soát C/O.");
        throw new Error(message);
      }

      const payload = await response.json();
      syncCoDiscrepancyConfig(payload?.config || {});
      syncCoDiscrepancyState(payload?.state || null);
    } catch (err) {
      console.error("Không thể tải trạng thái đối soát C/O", err);
      setCoDiscrepancyError(err?.message || "Không thể tải trạng thái đối soát C/O.");
    } finally {
      setCoDiscrepancyLoading(false);
    }
  }, [extractErrorMessage, fetchWithAuth, syncCoDiscrepancyConfig, syncCoDiscrepancyState]);

  const handleSaveCoDiscrepancyConfig = useCallback(async () => {
    if (!canManageSync) {
      await alert("Bạn không có quyền cập nhật cấu hình đối soát C/O.");
      return;
    }

    setCoDiscrepancySaving(true);
    setCoDiscrepancyError("");
    setCoDiscrepancyMessage("");

    try {
      const payload = {
        config: {
          enabled: !!coDiscrepancyForm.enabled,
          cron: (coDiscrepancyForm.cron || "").trim(),
          rangeDays: Math.max(1, Math.round(Number(coDiscrepancyForm.rangeDays) || 1)),
          threshold: Math.max(1, Math.round(Number(coDiscrepancyForm.threshold) || 1)),
          sampleLimit: Math.max(0, Math.round(Number(coDiscrepancyForm.sampleLimit) || 0)),
        },
      };

      const response = await fetchWithAuth(CO_DISCREPANCY_CONFIG_ROUTE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể lưu cấu hình đối soát C/O.");
        throw new Error(message);
      }

      const result = await response.json();
      syncCoDiscrepancyConfig(result?.config || payload.config);
      setCoDiscrepancyMessage("Đã lưu cấu hình đối soát C/O.");
    } catch (err) {
      console.error("Không thể lưu cấu hình đối soát C/O", err);
      setCoDiscrepancyError(err?.message || "Không thể lưu cấu hình đối soát C/O.");
    } finally {
      setCoDiscrepancySaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageSync, coDiscrepancyForm, extractErrorMessage, fetchWithAuth, syncCoDiscrepancyConfig]);

  const handleResetCoDiscrepancyForm = useCallback(() => {
    if (!coDiscrepancyConfig) return;

    setCoDiscrepancyForm({
      enabled: !!coDiscrepancyConfig.enabled,
      cron: coDiscrepancyConfig.cron || "",
      rangeDays: coDiscrepancyConfig.rangeDays || 3,
      threshold: coDiscrepancyConfig.threshold || 10,
      sampleLimit: coDiscrepancyConfig.sampleLimit || 0,
    });
    setCoDiscrepancyError("");
    setCoDiscrepancyMessage("");
  }, [coDiscrepancyConfig]);

  const handleRunCoDiscrepancy = useCallback(async () => {
    if (!canManageSync) {
      await alert("Bạn không có quyền chạy đối soát C/O.");
      return;
    }

    setCoDiscrepancyRunning(true);
    setCoDiscrepancyError("");
    setCoDiscrepancyMessage("");

    try {
      const payload = {};
      if (coDiscrepancyRange.from || coDiscrepancyRange.to) {
        payload.range = {
          from: coDiscrepancyRange.from || undefined,
          to: coDiscrepancyRange.to || undefined,
        };
      }

      const response = await fetchWithAuth(CO_DISCREPANCY_RUN_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể chạy đối soát C/O.");
        throw new Error(message);
      }

      const result = await response.json();
      const nextState = result?.result?.state ? syncCoDiscrepancyState(result.result.state) : null;

      if (result?.result?.config) {
        syncCoDiscrepancyConfig(result.result.config);
      }

      setCoDiscrepancyMessage(buildCoDiscrepancyRunMessage(nextState));
    } catch (err) {
      console.error("Không thể chạy đối soát C/O", err);
      setCoDiscrepancyError(err?.message || "Không thể chạy đối soát C/O.");
    } finally {
      setCoDiscrepancyRunning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canManageSync,
    coDiscrepancyRange.from,
    coDiscrepancyRange.to,
    extractErrorMessage,
    fetchWithAuth,
    syncCoDiscrepancyConfig,
    syncCoDiscrepancyState,
  ]);

  const handleRefreshCoCodeConfig = useCallback(() => {
    return fetchCoCodeConfig();
  }, [fetchCoCodeConfig]);

  const handleRefreshCoDiscrepancy = useCallback(() => {
    return fetchCoDiscrepancy();
  }, [fetchCoDiscrepancy]);

  useEffect(() => {
    fetchCoCodeConfig();
    fetchCoDiscrepancy();
  }, [fetchCoCodeConfig, fetchCoDiscrepancy]);

  const coMismatchList = useMemo(
    () => (Array.isArray(coDiscrepancyState?.mismatches) ? coDiscrepancyState.mismatches : []),
    [coDiscrepancyState?.mismatches]
  );

  const coMismatchKeys = useMemo(
    () => coMismatchList.map((item) => item?.key).filter(Boolean),
    [coMismatchList]
  );

  const coMismatchKeySet = useMemo(() => new Set(coMismatchKeys), [coMismatchKeys]);
  const coMismatchPreview = useMemo(() => coMismatchList.slice(0, 10), [coMismatchList]);
  const coDiscrepancyRangeLabel = useMemo(
    () => formatDateRangeLabel(coDiscrepancyState?.range ?? null),
    [coDiscrepancyState?.range]
  );

  const coDiscrepancyLastRunLabel = useMemo(() => {
    if (!coDiscrepancyState?.lastRunAt) return "Chưa chạy";

    try {
      return new Date(coDiscrepancyState.lastRunAt).toLocaleString("vi-VN");
    } catch (err) {
      console.warn("Khong the dinh dang thoi gian chay doi soat CO", coDiscrepancyState?.lastRunAt, err);
      return coDiscrepancyState.lastRunAt;
    }
  }, [coDiscrepancyState?.lastRunAt]);

  const coMismatchCount = coDiscrepancyState?.mismatchCount ?? coMismatchList.length;
  const coCheckedCount = coDiscrepancyState?.totalChecked ?? 0;
  const coMismatchLimited = coDiscrepancyState?.limited === true;

  const coCodeUpdatedLabel = useMemo(() => {
    if (!coCodeConfig?.updatedAt) return "Chưa có cấu hình tùy chỉnh.";

    try {
      const time = new Date(coCodeConfig.updatedAt).toLocaleString("vi-VN");
      const actor = coCodeConfig.updatedBy || "hệ thống";
      return `Cập nhật lần cuối: ${time} (${actor})`;
    } catch (err) {
      console.warn("Khong the dinh dang thoi gian cap nhat cau hinh CO", coCodeConfig?.updatedAt, err);
      return `Cập nhật lần cuối: ${coCodeConfig.updatedAt}`;
    }
  }, [coCodeConfig?.updatedAt, coCodeConfig?.updatedBy]);

  const coDiscrepancyStatusLabel = useMemo(
    () => buildCoDiscrepancyStatusLabel(coDiscrepancyState),
    [coDiscrepancyState]
  );

  return {
    coCodeConfig,
    coCodeForm,
    setCoCodeForm,
    coCodeLoading,
    coCodeSaving,
    coCodeError,
    coCodeMessage,
    handleSaveCoCodeConfig,
    handleResetCoCodeForm,
    handleRefreshCoCodeConfig,
    coCodeUpdatedLabel,
    coDiscrepancyConfig,
    coDiscrepancyState,
    coDiscrepancyForm,
    setCoDiscrepancyForm,
    coDiscrepancyRange,
    setCoDiscrepancyRange,
    coDiscrepancyLoading,
    coDiscrepancySaving,
    coDiscrepancyRunning,
    coDiscrepancyError,
    coDiscrepancyMessage,
    handleSaveCoDiscrepancyConfig,
    handleResetCoDiscrepancyForm,
    handleRunCoDiscrepancy,
    handleRefreshCoDiscrepancy,
    coMismatchKeySet,
    coMismatchPreview,
    coMismatchCount,
    coCheckedCount,
    coMismatchLimited,
    coDiscrepancyRangeLabel,
    coDiscrepancyLastRunLabel,
    coDiscrepancyStatusLabel,
  };
}
