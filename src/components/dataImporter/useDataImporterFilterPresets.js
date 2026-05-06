import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

import {
  LAST_FILTER_PRESET_KEY,
  LEGACY_FILTER_STORAGE_KEY,
} from "@/components/dataImporter/dataImporterConfig.js";
import {
  isConfigColumnKey,
  sanitizeColumnWidths,
} from "@/components/dataImporter/dataImporterConfig.js";
import { getImportColumnConfig, saveImportColumnConfig } from "@/lib/importColumnConfig.js";
import { normalizeStatusKey } from "../../../packages/domain/src/declSearch.js";

function normalizePresetStatuses(status) {
  const values = Array.isArray(status)
    ? status
    : typeof status === "string" && status.trim()
    ? status.split(",")
    : [];

  return Array.from(
    new Set(
      values
        .map((value) => normalizeStatusKey(value))
        .filter(Boolean)
    )
  );
}

function normalizeLegacyStoredFilters(stored) {
  if (!stored || typeof stored !== "object") {
    return null;
  }

  const range =
    stored.range && typeof stored.range === "object"
      ? {
          from: typeof stored.range.from === "string" ? stored.range.from : "",
          to: typeof stored.range.to === "string" ? stored.range.to : "",
        }
      : null;

  const normalizedFilters = {};

  if (typeof stored.query === "string" && stored.query.trim()) {
    normalizedFilters.query = stored.query.trim();
  }

  if (typeof stored.mst === "string" && stored.mst.trim()) {
    normalizedFilters.mst = stored.mst.trim();
  }

  if (typeof stored.company === "string" && stored.company.trim()) {
    normalizedFilters.company = stored.company.trim();
  }

  if (range && (range.from || range.to)) {
    normalizedFilters.range = range;
  }

  if (stored.filterNoStaff === true) {
    normalizedFilters.filterNoStaff = true;
  }

  if (stored.filterNoTeam === true) {
    normalizedFilters.filterNoTeam = true;
  }

  if (stored.filterDuplicate11 === true) {
    normalizedFilters.filterDuplicate11 = true;
  }

  if (typeof stored.coFilterMode === "string" && stored.coFilterMode) {
    normalizedFilters.coFilterMode = stored.coFilterMode;
  }

  if (Number.isFinite(stored.coFilterMin)) {
    normalizedFilters.coFilterMin = Math.max(0, Math.round(Number(stored.coFilterMin)));
  }

  if (typeof stored.datePreset === "string" && stored.datePreset) {
    normalizedFilters.datePreset = stored.datePreset;
  }

  const statuses = normalizePresetStatuses(stored.status);
  if (statuses.length) {
    normalizedFilters.status = statuses;
  }

  return Object.keys(normalizedFilters).length > 0 ? normalizedFilters : null;
}

function normalizePresetColumnConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const hidden = Array.isArray(config.hidden)
    ? Array.from(
        new Set(
          config.hidden
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value && isConfigColumnKey(value))
        )
      )
    : [];
  const widths = sanitizeColumnWidths(config.widths);

  if (!hidden.length && !Object.keys(widths).length) {
    return null;
  }

  return { hidden, widths };
}

export default function useDataImporterFilterPresets({
  savedPresets = [],
  presetLoading = false,
  clearPresetError,
  clearError,
  refreshPresetList,
  createFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
  datePreset = "none",
  query = "",
  quickMST = "",
  quickCompany = "",
  statusFilters = [],
  searchRange = { from: "", to: "" },
  filterNoStaff = false,
  filterNoTeam = false,
  filterDuplicate11 = false,
  coFilterMode = "all",
  coFilterMin = 5,
  setDatePreset,
  setQuery,
  setQuickMST,
  setQuickCompany,
  setStatusFilters,
  setSearchRange,
  setFilterNoStaff,
  setFilterNoTeam,
  setFilterDuplicate11,
  setCoFilterMode,
  setCoFilterMin,
  setPage,
  actor = "system",
  getCurrentColumnConfig = getImportColumnConfig,
  applyColumnConfig = saveImportColumnConfig,
}) {
  const { alert, confirm } = useAppDialog();
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [appliedPresetId, setAppliedPresetId] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);
  const lastPresetSeedRef = useRef("");
  const presetAutoAppliedRef = useRef(false);
  const resetPresetError = clearPresetError ?? clearError;

  const buildFilterPresetPayload = useCallback(() => {
    const payload = {
      datePreset,
      coFilterMode,
      coFilterMin,
    };

    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      payload.query = trimmedQuery;
    }

    const trimmedMST = quickMST.trim();
    if (trimmedMST) {
      payload.mst = trimmedMST;
    }

    const trimmedCompany = quickCompany.trim();
    if (trimmedCompany) {
      payload.company = trimmedCompany;
    }

    if (searchRange.from || searchRange.to) {
      payload.range = {
        from: searchRange.from || "",
        to: searchRange.to || "",
      };
    }

    if (filterNoStaff) {
      payload.filterNoStaff = true;
    }

    if (filterNoTeam) {
      payload.filterNoTeam = true;
    }

    if (filterDuplicate11) {
      payload.filterDuplicate11 = true;
    }

    if (Array.isArray(statusFilters) && statusFilters.length) {
      payload.status = Array.from(new Set(statusFilters.filter(Boolean)));
    }

    const columns = normalizePresetColumnConfig(getCurrentColumnConfig?.());
    if (columns) {
      payload.columns = columns;
    }

    return payload;
  }, [
    coFilterMin,
    coFilterMode,
    datePreset,
    filterDuplicate11,
    filterNoStaff,
    filterNoTeam,
    query,
    quickCompany,
    quickMST,
    searchRange.from,
    searchRange.to,
    statusFilters,
    getCurrentColumnConfig,
  ]);

  const applyPresetFilters = useCallback(
    async (preset, { notify = true } = {}) => {
      if (!preset || typeof preset !== "object") {
        await alert("Không tìm thấy bộ lọc đã lưu.");
        return;
      }

      resetPresetError?.();
      const filters = preset.filters && typeof preset.filters === "object" ? preset.filters : {};
      const columns = normalizePresetColumnConfig(filters.columns);

      if (columns) {
        try {
          applyColumnConfig(columns, { actor });
        } catch (error) {
          console.error("Không thể áp dụng cấu hình cột từ bộ lọc đã lưu", error);
        }
      }

      setQuery(typeof filters.query === "string" ? filters.query : "");
      setQuickMST(typeof filters.mst === "string" ? filters.mst : "");
      setQuickCompany(typeof filters.company === "string" ? filters.company : "");

      if (filters.range && typeof filters.range === "object") {
        setSearchRange({
          from: typeof filters.range.from === "string" ? filters.range.from : "",
          to: typeof filters.range.to === "string" ? filters.range.to : "",
        });
      } else {
        setSearchRange({ from: "", to: "" });
      }

      const nextPresetKey =
        typeof filters.datePreset === "string" && filters.datePreset
          ? filters.datePreset
          : filters.range && (filters.range.from || filters.range.to)
          ? "custom"
          : "none";
      setDatePreset(nextPresetKey);
      setFilterNoStaff(filters.filterNoStaff === true);
      setFilterNoTeam(filters.filterNoTeam === true);
      setFilterDuplicate11(filters.filterDuplicate11 === true);
      setCoFilterMode(
        typeof filters.coFilterMode === "string" && filters.coFilterMode
          ? filters.coFilterMode
          : "all"
      );

      const minValue = Number(filters.coFilterMin);
      setCoFilterMin(Number.isFinite(minValue) ? Math.max(0, Math.round(minValue)) : 5);
      setStatusFilters(normalizePresetStatuses(filters.status));
      setPage(1);

      if (preset.id) {
        setSelectedPresetId(preset.id);
        setAppliedPresetId(preset.id);

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(LAST_FILTER_PRESET_KEY, preset.id);
          } catch (error) {
            console.warn("Không thể lưu bộ lọc đang áp dụng", error);
          }
        }
      }

      presetAutoAppliedRef.current = true;

      if (notify) {
        await alert(`Đã áp dụng bộ lọc "${preset.name}".`);
      }
    },
    [
      actor,
      applyColumnConfig,
      resetPresetError,
      setCoFilterMin,
      setCoFilterMode,
      setDatePreset,
      setFilterDuplicate11,
      setFilterNoStaff,
      setFilterNoTeam,
      setPage,
      setQuery,
      setQuickCompany,
      setQuickMST,
      setSearchRange,
      setStatusFilters,
    ]
  );

  const presetBusy = presetLoading || presetSaving;

  const selectedPreset = useMemo(
    () => savedPresets.find((item) => item.id === selectedPresetId) || null,
    [savedPresets, selectedPresetId]
  );

  const appliedPreset = useMemo(
    () => savedPresets.find((item) => item.id === appliedPresetId) || null,
    [appliedPresetId, savedPresets]
  );

  const appliedPresetUpdatedAt = useMemo(() => {
    if (!appliedPreset?.updatedAt) {
      return "";
    }

    try {
      return new Date(appliedPreset.updatedAt).toLocaleString("vi-VN");
    } catch (error) {
      console.warn("Không thể định dạng thời gian cập nhật bộ lọc", error);
      return "";
    }
  }, [appliedPreset]);

  useEffect(() => {
    if (typeof window === "undefined") {
      presetAutoAppliedRef.current = true;
      return;
    }

    try {
      const storedId = window.localStorage.getItem(LAST_FILTER_PRESET_KEY);
      if (storedId) {
        lastPresetSeedRef.current = storedId;
        setSelectedPresetId(storedId);
      }
    } catch (error) {
      console.warn("Không thể đọc bộ lọc đã áp dụng gần đây", error);
    }
  }, []);

  useEffect(() => {
    if (presetAutoAppliedRef.current || !savedPresets.length) {
      return;
    }

    const targetId = lastPresetSeedRef.current;
    if (targetId) {
      const preset = savedPresets.find((item) => item.id === targetId);
      if (preset) {
        applyPresetFilters(preset, { notify: false });
        return;
      }
    }

    presetAutoAppliedRef.current = true;
  }, [applyPresetFilters, savedPresets]);

  useEffect(() => {
    if (selectedPresetId && !savedPresets.some((item) => item.id === selectedPresetId)) {
      setSelectedPresetId("");
    }
  }, [savedPresets, selectedPresetId]);

  useEffect(() => {
    if (appliedPresetId && !savedPresets.some((item) => item.id === appliedPresetId)) {
      setAppliedPresetId("");
    }
  }, [appliedPresetId, savedPresets]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const raw = window.localStorage.getItem(LEGACY_FILTER_STORAGE_KEY);
        if (!raw) {
          return;
        }

        const stored = JSON.parse(raw);
        const normalizedFilters = normalizeLegacyStoredFilters(stored);
        if (!normalizedFilters) {
          window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
          return;
        }

        if (savedPresets.length > 0) {
          window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
          return;
        }

        const preset = await createFilterPreset?.({
          name: typeof stored.name === "string" && stored.name.trim() ? stored.name.trim() : "Bộ lọc cũ",
          filters: normalizedFilters,
        });

        window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);

        if (!cancelled && preset) {
          applyPresetFilters(preset, { notify: false });
        }
      } catch (error) {
        console.warn("Không thể nhập bộ lọc đã lưu trước đây", error);

        try {
          window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
        } catch (removeError) {
          console.warn("Không thể xoá bộ lọc cũ khỏi localStorage", removeError);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyPresetFilters, createFilterPreset, savedPresets]);

  const handleSelectPreset = useCallback(
    (value) => {
      resetPresetError?.();
      setSelectedPresetId(value);
    },
    [resetPresetError]
  );

  const handleApplySelectedPreset = useCallback(async () => {
    const preset = savedPresets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      await alert("Vui lòng chọn bộ lọc cần áp dụng.");
      return;
    }

    applyPresetFilters(preset);
  }, [applyPresetFilters, savedPresets, selectedPresetId]);

  const handleSavePresetAsNew = useCallback(async () => {
    let presetName = selectedPreset ? `${selectedPreset.name} (bản sao)` : "Bộ lọc mới";

    if (typeof window !== "undefined") {
      const input = window.prompt("Đặt tên cho bộ lọc mới", presetName);
      if (input === null) {
        return;
      }

      presetName = input.trim();
      if (!presetName) {
        await alert("Tên bộ lọc không được bỏ trống.");
        return;
      }
    }

    resetPresetError?.();
    setPresetSaving(true);

    try {
      const preset = await createFilterPreset?.({
        name: presetName,
        filters: buildFilterPresetPayload(),
      });

      if (preset?.id) {
        setSelectedPresetId(preset.id);
      }
      if (preset) {
        applyPresetFilters(preset, { notify: false });
        await alert(`Đã lưu bộ lọc "${preset.name}".`);
      }
    } catch (error) {
      await alert(error?.message || "Không thể lưu bộ lọc đã lưu.");
    } finally {
      setPresetSaving(false);
    }
  }, [
    applyPresetFilters,
    buildFilterPresetPayload,
      resetPresetError,
      createFilterPreset,
      selectedPreset,
  ]);

  const handleOverwriteSelectedPreset = useCallback(async () => {
    if (!selectedPreset) {
      await alert("Vui lòng chọn bộ lọc cần ghi đè.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !await confirm(`Ghi đè bộ lọc "${selectedPreset.name}" bằng điều kiện hiện tại?`)
    ) {
      return;
    }

    resetPresetError?.();
    setPresetSaving(true);

    try {
      const preset = await updateFilterPreset?.(selectedPreset.id, {
        name: selectedPreset.name,
        filters: buildFilterPresetPayload(),
      });

      if (preset) {
        applyPresetFilters(preset, { notify: false });
        await alert(`Đã cập nhật bộ lọc "${preset.name}".`);
      }
    } catch (error) {
      await alert(error?.message || "Không thể cập nhật bộ lọc đã lưu.");
    } finally {
      setPresetSaving(false);
    }
  }, [
    applyPresetFilters,
    buildFilterPresetPayload,
      resetPresetError,
      selectedPreset,
      updateFilterPreset,
  ]);

  const handleDeleteSelectedPreset = useCallback(async () => {
    if (!selectedPreset) {
      await alert("Vui lòng chọn bộ lọc cần xoá.");
      return;
    }

    if (typeof window !== "undefined" && !await confirm(`Xoá bộ lọc "${selectedPreset.name}"?`, { variant: "destructive", confirmLabel: "Xóa" })) {
      return;
    }

    resetPresetError?.();
    setPresetSaving(true);

    try {
      await deleteFilterPreset?.(selectedPreset.id);

      if (typeof window !== "undefined") {
        try {
          const storedId = window.localStorage.getItem(LAST_FILTER_PRESET_KEY);
          if (storedId === selectedPreset.id) {
            window.localStorage.removeItem(LAST_FILTER_PRESET_KEY);
          }
        } catch (error) {
          console.warn("Không thể cập nhật bộ lọc đã áp dụng gần đây", error);
        }
      }

      if (appliedPresetId === selectedPreset.id) {
        setAppliedPresetId("");
      }
      setSelectedPresetId("");
      await alert(`Đã xoá bộ lọc "${selectedPreset.name}".`);
    } catch (error) {
      await alert(error?.message || "Không thể xoá bộ lọc đã lưu.");
    } finally {
      setPresetSaving(false);
    }
  }, [appliedPresetId, deleteFilterPreset, resetPresetError, selectedPreset]);

  const handleRefreshPresetList = useCallback(() => {
    resetPresetError?.();
    refreshPresetList?.();
  }, [refreshPresetList, resetPresetError]);

  const handleClearSearchRange = useCallback(() => {
    setSearchRange({ from: "", to: "" });
    setDatePreset("none");
  }, [setDatePreset, setSearchRange]);

  return {
    selectedPresetId,
    selectedPreset,
    appliedPreset,
    appliedPresetUpdatedAt,
    presetSaving,
    presetBusy,
    handleSelectPreset,
    handleApplySelectedPreset,
    handleSavePresetAsNew,
    handleOverwriteSelectedPreset,
    handleDeleteSelectedPreset,
    handleRefreshPresetList,
    handleClearSearchRange,
  };
}
