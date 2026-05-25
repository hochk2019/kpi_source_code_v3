import React from 'react';

import DataHealthPolicySourcesPanel from '@/components/data-health-dashboard/DataHealthPolicySourcesPanel.jsx';

const policyInputClass =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500';

const policyCheckboxClass =
  'h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100';

const POLICY_NUMERIC_FIELDS = [
  { key: 'autoNotifyAfterDays', label: 'Số ngày nhắc nhở tự động' },
  { key: 'notifyCooldownHours', label: 'Thời gian chờ giữa các lần nhắc (giờ)' },
  { key: 'evaluationWindowDays', label: 'Cửa sổ đánh giá (ngày)' },
  { key: 'autoLockAfterGroups', label: 'Tự khóa sau số nhóm trùng' },
  { key: 'minGroupSizeForLock', label: 'Số bản ghi tối thiểu để khóa' },
  { key: 'autoUnlockAfterDays', label: 'Tự mở khóa sau (ngày)' },
];

export default function DataHealthPolicyConfigSection({
  canEditPolicy = false,
  policyLoading = false,
  policySaving = false,
  policyError = '',
  policyActionsDisabled = false,
  policyInputsDisabled = false,
  policyForm = null,
  policySourcesPanel = {},
  onReloadPolicy,
  onSavePolicy,
  onPolicyFieldChange,
}) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Chính sách tự động trùng 11 số</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tinh chỉnh ngưỡng cảnh báo, trạng thái khóa nguồn và theo dõi lần đánh giá gần nhất.
          </p>
          {!canEditPolicy ? (
            <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
              Tài khoản hiện chỉ có quyền xem cấu hình, không thể chỉnh sửa thông số.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReloadPolicy}
            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
            disabled={policyLoading || policySaving}
          >
            {policyLoading ? 'Đang tải…' : 'Tải lại'}
          </button>
          <button
            type="button"
            onClick={onSavePolicy}
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={policyActionsDisabled}
          >
            {policySaving ? 'Đang lưu…' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {policyError ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200">
          {policyError}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {POLICY_NUMERIC_FIELDS.map((field) => (
              <label key={field.key} className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                {field.label}
                <input
                  type="number"
                  min="0"
                  value={policyForm?.[field.key] ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value;
                    onPolicyFieldChange?.(field.key, raw === '' ? '' : Number(raw));
                  }}
                  disabled={policyInputsDisabled}
                  readOnly={!canEditPolicy}
                  className={policyInputClass}
                />
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={!!policyForm?.autoLockEnabled}
              onChange={(event) => {
                onPolicyFieldChange?.('autoLockEnabled', event.target.checked);
              }}
              disabled={policyInputsDisabled}
              className={policyCheckboxClass}
            />
            Bật chế độ khóa nguồn tự động khi vượt ngưỡng
          </label>
        </div>

        <DataHealthPolicySourcesPanel
          statusSummary={policySourcesPanel.statusSummary}
          sources={policySourcesPanel.sources}
          lockedSources={policySourcesPanel.lockedSources}
          actionsDisabled={policySourcesPanel.actionsDisabled}
          onLockSource={policySourcesPanel.onLockSource}
          onUnlockSource={policySourcesPanel.onUnlockSource}
        />
      </div>
    </section>
  );
}
