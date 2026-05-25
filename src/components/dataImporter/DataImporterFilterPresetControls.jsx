import React from "react";

export default function DataImporterFilterPresetControls({
  selectedPresetId = "",
  savedPresets = [],
  presetBusy = false,
  presetSaving = false,
  presetLoading = false,
  presetError = "",
  appliedPreset = null,
  appliedPresetUpdatedAt = "",
  onSelectPreset,
  onApplySelectedPreset,
  onSavePresetAsNew,
  onOverwriteSelectedPreset,
  onDeleteSelectedPreset,
  onRefreshPresetList,
  onClearPresetError,
}) {
  return (
    <>
      <div className="flex min-w-[240px] flex-1 flex-wrap items-center gap-2 border-l border-gray-200 pl-3 dark:border-slate-700">
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Bộ lọc đã lưu
          </span>
          <select
            value={selectedPresetId}
            onChange={(event) => onSelectPreset?.(event.target.value)}
            className="min-w-[180px] rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
          >
            <option value="">Chọn bộ lọc</option>
            {savedPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onApplySelectedPreset}
          disabled={!selectedPresetId || presetBusy}
          className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          Áp dụng
        </button>

        <button
          type="button"
          onClick={onSavePresetAsNew}
          disabled={presetBusy}
          className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          {presetSaving ? "Đang lưu…" : "Lưu preset mới"}
        </button>

        {selectedPresetId ? (
          <>
            <button
              type="button"
              onClick={onOverwriteSelectedPreset}
              disabled={presetBusy}
              className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
            >
              Ghi đè preset
            </button>
            <button
              type="button"
              onClick={onDeleteSelectedPreset}
              disabled={presetBusy}
              className="rounded border px-3 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              Xoá preset
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={onRefreshPresetList}
          disabled={presetBusy}
          className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          {presetLoading ? "Đồng bộ…" : "Đồng bộ"}
        </button>
      </div>

      {presetError ? (
        <div className="text-xs text-red-600 dark:text-red-400">
          {presetError}
          <button type="button" onClick={onClearPresetError} className="ml-2 underline">
            Đóng
          </button>
        </div>
      ) : null}

      {appliedPreset ? (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Đang áp dụng:{" "}
          <span className="font-medium text-gray-700 dark:text-gray-200">{appliedPreset.name}</span>
          {appliedPresetUpdatedAt ? ` • Cập nhật ${appliedPresetUpdatedAt}` : ""}
        </div>
      ) : null}
    </>
  );
}
