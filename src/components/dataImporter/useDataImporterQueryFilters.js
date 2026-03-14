import { useCallback } from "react";

export default function useDataImporterQueryFilters({
  query = "",
  mainSearchHelpTextId,
  datePreset = "none",
  dateRangePresets = [],
  searchRange = { from: "", to: "" },
  filterNoStaff = false,
  filterNoTeam = false,
  coFilterMode = "all",
  coFilterMin = 0,
  coFilterActive = false,
  coFilterMatches = 0,
  coFilterOptions = [],
  setQuery,
  setPage,
  setDatePreset,
  setSearchRange,
  setFilterNoStaff,
  setFilterNoTeam,
  setCoFilterMode,
  setCoFilterMin,
}) {
  const applyDatePreset = useCallback(
    (presetKey) => {
      const preset = dateRangePresets.find((item) => item.key === presetKey);
      if (!preset || typeof preset.getRange !== "function") {
        setDatePreset("custom");
        return;
      }

      const range = preset.getRange();
      setDatePreset(presetKey);
      setSearchRange({
        from: range?.from || "",
        to: range?.to || "",
      });
    },
    [dateRangePresets, setDatePreset, setSearchRange]
  );

  const handleClearSearchRange = useCallback(() => {
    setSearchRange({ from: "", to: "" });
    setDatePreset("none");
  }, [setDatePreset, setSearchRange]);

  const queryFilterControlsProps = {
    query,
    mainSearchHelpTextId,
    datePreset,
    dateRangePresets,
    searchRange,
    filterNoStaff,
    filterNoTeam,
    coFilterMode,
    coFilterMin,
    coFilterActive,
    coFilterMatches,
    coFilterOptions,
    onQueryChange: (value) => {
      setQuery(value);
      setPage(1);
    },
    onClearQuery: () => {
      setQuery("");
      setPage(1);
    },
    onDatePresetChange: (value) => {
      if (value === "custom") {
        setDatePreset("custom");
        return;
      }
      applyDatePreset(value);
    },
    onSearchRangeFromChange: (value) => {
      setDatePreset("custom");
      setSearchRange((prev) => ({ ...prev, from: value }));
    },
    onSearchRangeToChange: (value) => {
      setDatePreset("custom");
      setSearchRange((prev) => ({ ...prev, to: value }));
    },
    onClearSearchRange: handleClearSearchRange,
    onFilterNoStaffChange: setFilterNoStaff,
    onFilterNoTeamChange: setFilterNoTeam,
    onCoFilterModeChange: setCoFilterMode,
    onCoFilterMinChange: (value) => {
      const raw = Number(value);
      if (!Number.isFinite(raw) || raw <= 0) {
        setCoFilterMin(0);
        return;
      }
      setCoFilterMin(Math.round(raw));
    },
  };

  return {
    applyDatePreset,
    handleClearSearchRange,
    queryFilterControlsProps,
  };
}
