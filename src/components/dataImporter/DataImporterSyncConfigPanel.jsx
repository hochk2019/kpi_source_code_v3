import React from "react";

import CollapsibleCard from "@/components/CollapsibleCard.jsx";
import DataImporterSyncPreviewPanel from "@/components/dataImporter/DataImporterSyncPreviewPanel.jsx";

export default function DataImporterSyncConfigPanel({
  isAdminRole = false,
  canManageSync = false,
  syncLastRunLabel = "Chưa có",
  syncConfig = null,
  fetchSyncConfig,
  fetchSyncStatus,
  handleSaveSyncConfig,
  syncLoading = false,
  statusLoading = false,
  syncForm = null,
  setSyncForm,
  toneClassMap = {},
  backendMeta = {},
  databaseMeta = {},
  statusCheckedLabel = "Chưa có",
  statusError = "",
  lastSyncSummaryCard = null,
  rangePresets = [],
  manualRange = { from: "", to: "" },
  onApplyRangePreset,
  onManualRangeChange,
  syncRunning = false,
  previewLoading = false,
  onPreview,
  onRunSync,
  mstFilterNotice = "",
  showPreviewRange = false,
  previewRangeLabel = "",
  previewLimited = false,
  previewError = "",
  previewRows = [],
  previewConflictSummary = null,
  previewConflictWarningActive = false,
  syncRecoveryHints = [],
  syncPreflightChecks = [],
  syncPreflightSummary = null,
  syncActivityLog = [],
  syncHistory = [],
  syncResumeJob = null,
  syncResumeLabel = "",
  showPreviewTableInline = true,
  formatDisplayDate,
  syncProgressSteps = [],
  syncMessage = "",
  syncError = "",
  onResumeSync,
  cardSurfaceClass = "",
}) {
  if (!isAdminRole) {
    return null;
  }

  const updateSyncForm = (updater) => {
    setSyncForm?.(updater);
  };

  const syncDescription = `Lần chạy gần nhất: ${syncLastRunLabel} • Trạng thái: ${syncConfig?.lastStatus || "Chưa có"}`;

  if (canManageSync) {
    return (
      <CollapsibleCard
        id="auto-sync"
        title="Đồng bộ tự động từ ECUS5VNACCS"
        description={syncDescription}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSyncConfig}
              className="rounded border px-3 py-1 text-sm"
              disabled={syncLoading}
              data-tooltip="Tải lại cấu hình đồng bộ từ máy chủ"
            >
              Tải lại cấu hình
            </button>

            <button
              type="button"
              onClick={fetchSyncStatus}
              className="rounded border px-3 py-1 text-sm"
              disabled={statusLoading}
              data-tooltip="Kiểm tra kết nối SQL Server"
            >
              {statusLoading ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
            </button>

            <button
              type="button"
              onClick={handleSaveSyncConfig}
              className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
              disabled={syncLoading || !syncForm}
              data-tooltip="Lưu cấu hình đồng bộ ECUS"
            >
              Lưu cấu hình
            </button>
          </div>
        }
        bodyClassName="space-y-3"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
            <span className={`rounded px-2 py-1 ${toneClassMap[backendMeta.tone] || toneClassMap.muted}`}>
              Backend: {backendMeta.label}
            </span>

            <span className={`rounded px-2 py-1 ${toneClassMap[databaseMeta.tone] || toneClassMap.muted}`}>
              SQL Server: {databaseMeta.label}
            </span>
          </div>

          <div className="text-xs text-gray-500">Lần kiểm tra: {statusCheckedLabel}</div>

          {backendMeta.detail || databaseMeta.detail ? (
            <div className="text-xs text-gray-500">
              {[backendMeta.detail, databaseMeta.detail].filter(Boolean).join(" • ")}
            </div>
          ) : null}

          {statusError ? <div className="text-xs text-red-600">{statusError}</div> : null}

          {lastSyncSummaryCard}
        </div>

        {syncForm ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={syncForm.enabled}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({ ...prev, enabled: event.target.checked }))
                  }
                />
                <span>Bật đồng bộ định kỳ</span>
              </label>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="sync-cron">
                  Biểu thức cron
                </label>
                <input
                  id="sync-cron"
                  className="w-full rounded border px-2 py-1 text-sm"
                  value={syncForm.schedule}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({ ...prev, schedule: event.target.value }))
                  }
                  placeholder="0 * * * *"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="sync-range-days">
                  Khoảng mặc định (số ngày)
                </label>
                <input
                  id="sync-range-days"
                  type="number"
                  min="1"
                  className="w-full rounded border px-2 py-1 text-sm"
                  value={syncForm.rangeDays}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({
                      ...prev,
                      rangeDays: Number(event.target.value) || 1,
                    }))
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={syncForm.preferMonthFirst}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({
                      ...prev,
                      preferMonthFirst: event.target.checked,
                    }))
                  }
                />
                <span>Ngày dạng MM/DD/YYYY</span>
              </label>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="sync-server">
                  Máy chủ SQL Server
                </label>
                <input
                  id="sync-server"
                  className="w-full rounded border px-2 py-1 text-sm"
                  value={syncForm.server}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({ ...prev, server: event.target.value }))
                  }
                  placeholder="192.168.x.x\\SQL2019"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="sync-database">
                  Cơ sở dữ liệu
                </label>
                <input
                  id="sync-database"
                  className="w-full rounded border px-2 py-1 text-sm"
                  value={syncForm.database}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({ ...prev, database: event.target.value }))
                  }
                  placeholder="ECUS5VNACCS"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="sync-user">
                  Tài khoản
                </label>
                <input
                  id="sync-user"
                  className="w-full rounded border px-2 py-1 text-sm"
                  value={syncForm.user}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({ ...prev, user: event.target.value }))
                  }
                  placeholder="sa"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="sync-password">
                  Mật khẩu
                </label>
                <input
                  id="sync-password"
                  type="password"
                  className="w-full rounded border px-2 py-1 text-sm"
                  value={syncForm.password}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder={syncForm.hasPassword ? "(giữ nguyên nếu để trống)" : "Nhập mật khẩu"}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="sync-include-mst">
                  Chỉ đồng bộ các MST
                </label>
                <textarea
                  id="sync-include-mst"
                  className="h-24 w-full rounded border px-2 py-1 text-sm"
                  value={syncForm.includeTaxCodesText}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({
                      ...prev,
                      includeTaxCodesText: event.target.value,
                    }))
                  }
                  placeholder="0100109106; 0312345678"
                />
                <p className="text-xs text-gray-500">
                  Nhập nhiều MST cần đồng bộ, phân tách bằng dấu chấm phẩy (;) hoặc xuống dòng. Để trống để đồng bộ tất cả.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="sync-exclude-mst">
                  Danh sách MST loại trừ
                </label>
                <textarea
                  id="sync-exclude-mst"
                  className="h-24 w-full rounded border px-2 py-1 text-sm"
                  value={syncForm.excludeTaxCodesText}
                  onChange={(event) =>
                    updateSyncForm((prev) => ({
                      ...prev,
                      excludeTaxCodesText: event.target.value,
                    }))
                  }
                  placeholder={"0401234567\n0109999999"}
                />
                <p className="text-xs text-gray-500">
                  Các MST nằm trong danh sách này sẽ bị bỏ qua khi đồng bộ. Hỗ trợ nhập theo dòng hoặc dấu chấm phẩy.
                </p>
              </div>
            </div>

            <DataImporterSyncPreviewPanel
              rangePresets={rangePresets}
              manualRange={manualRange}
              onApplyRangePreset={onApplyRangePreset}
              onManualRangeChange={onManualRangeChange}
              syncRunning={syncRunning}
              previewLoading={previewLoading}
              onPreview={onPreview}
              onRunSync={onRunSync}
              mstFilterNotice={mstFilterNotice}
              showPreviewRange={showPreviewRange}
              previewRangeLabel={previewRangeLabel}
              previewLimited={previewLimited}
              previewError={previewError}
              previewRows={previewRows}
              previewConflictSummary={previewConflictSummary}
              previewConflictWarningActive={previewConflictWarningActive}
              syncRecoveryHints={syncRecoveryHints}
              syncPreflightChecks={syncPreflightChecks}
              syncPreflightSummary={syncPreflightSummary}
              syncActivityLog={syncActivityLog}
              syncHistory={syncHistory}
              syncResumeJob={syncResumeJob}
              syncResumeLabel={syncResumeLabel}
              showPreviewTableInline={showPreviewTableInline}
              formatDate={formatDisplayDate}
              syncProgressSteps={syncProgressSteps}
              syncMessage={syncMessage}
              syncError={syncError}
              onResumeSync={onResumeSync}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">Đang tải cấu hình đồng bộ...</p>
        )}
      </CollapsibleCard>
    );
  }

  return (
    <section className={`${cardSurfaceClass} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Đồng bộ ECUS</h2>
          <p className="text-xs text-gray-500">{syncDescription}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchSyncConfig?.();
              fetchSyncStatus?.();
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

        {backendMeta.detail || databaseMeta.detail ? (
          <div className="text-xs text-gray-500">
            {[backendMeta.detail, databaseMeta.detail].filter(Boolean).join(" • ")}
          </div>
        ) : null}

        {statusError ? <div className="text-xs text-red-600">{statusError}</div> : null}

        {lastSyncSummaryCard}
      </div>
    </section>
  );
}
