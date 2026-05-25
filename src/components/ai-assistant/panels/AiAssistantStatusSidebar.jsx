import React from 'react';

import { resolveProviderLabel } from '@/components/ai-assistant/providerConfig.js';

export default function AiAssistantStatusSidebar({
  canManage,
  configState,
  formatDateTime,
  formatUsage,
}) {
  const {
    cacheSummary,
    clearCacheLoading,
    config,
    configLoading,
    handleClearCache,
    loadProfile,
    profile,
    profileError,
    profileLoading,
  } = configState;

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Trạng thái</h3>
          <button
            type="button"
            onClick={loadProfile}
            className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            disabled={profileLoading}
          >
            {profileLoading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>
        {profileError ? <p className="mt-2 text-xs text-red-600">{profileError}</p> : null}
        <dl className="mt-3 space-y-2 text-sm text-gray-700">
          <div className="flex justify-between gap-4">
            <dt>Kích hoạt</dt>
            <dd className="font-medium">{profile?.enabled === false ? 'Đang tắt' : 'Đang bật'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Mặc định</dt>
            <dd className="text-right">{resolveProviderLabel(profile, config, profile?.defaultProvider)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Dự phòng</dt>
            <dd className="text-right">
              {profile?.fallbackProvider ? resolveProviderLabel(profile, config, profile.fallbackProvider) : 'Không dùng'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Cache</dt>
            <dd className="text-right">
              {profile?.caching?.enabled === false
                ? 'Đang tắt'
                : `TTL ${profile?.caching?.ttlMinutes ?? 0} phút / ${profile?.caching?.maxEntries ?? 0} bản ghi`}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-xs text-gray-500">
            <dt>Cập nhật</dt>
            <dd className="text-right">{formatDateTime(profile?.updatedAt)}</dd>
          </div>
        </dl>

        <div className="mt-4 space-y-2 text-xs text-gray-600">
          <p className="font-semibold text-gray-700">Danh sách nhà cung cấp</p>
          {profile?.providers?.length ? (
            <ul className="space-y-1">
              {profile.providers.map((provider) => (
                <li key={provider.id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-gray-700">{provider.label}</span>
                  <span className="text-[11px] uppercase tracking-wide text-gray-400">
                    {provider.enabled !== false ? 'Đang bật' : 'Tắt'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Chưa có cấu hình nhà cung cấp.</p>
          )}
        </div>
      </div>

      {canManage ? (
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Cache gần đây</h3>
            <button
              type="button"
              onClick={handleClearCache}
              className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              disabled={clearCacheLoading}
            >
              {clearCacheLoading ? 'Đang xóa…' : 'Xóa cache'}
            </button>
          </div>
          {configLoading ? <p className="mt-2 text-xs text-gray-500">Đang tải dữ liệu cache…</p> : null}
          {!configLoading && cacheSummary.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">Chưa có dữ liệu được cache.</p>
          ) : null}
          {!configLoading && cacheSummary.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs text-gray-600">
              {cacheSummary.slice(0, 5).map((entry) => (
                <li key={entry.key} className="rounded border border-gray-100 bg-gray-50 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-500">
                    <span>{resolveProviderLabel(profile, config, entry.providerId)}</span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 font-medium text-gray-700">{entry.promptPreview}</p>
                  <p className="mt-1 text-gray-600">{entry.responsePreview}</p>
                  {entry.actor ? <p className="mt-1 text-[11px] text-gray-500">Người hỏi: {entry.actor}</p> : null}
                  {entry.usage ? <p className="mt-1 text-[11px] text-gray-500">Token: {formatUsage(entry.usage)}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
