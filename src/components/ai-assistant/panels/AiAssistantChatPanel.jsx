import React from 'react';
import { t } from '@/lib/i18n.js';
import clsx from 'clsx';

import { isOllamaProvider } from '@/components/ai-assistant/providerConfig.js';

export default function AiAssistantChatPanel({
  assistantModes,
  canManage,
  configState,
  conversation,
  historyPanel,
  insightState,
  compactControlClass,
  controlClass,
  formatDateTime,
  formatUsage,
  secondaryButtonClass,
  snapshotState,
  summaryRangeOptions,
}) {
  const {
    activeMode,
    context,
    handleClearHistory,
    handleModeChange,
    handleSendPrompt,
    handleSuggestionClick,
    historyLoading,
    messages,
    modeId,
    prompt,
    scope,
    selectedProviderId,
    sending,
    setContext,
    setPrompt,
    setScope,
    setSelectedProviderId,
  } = conversation;
  const {
    availableProviders,
    handlePingConnection,
    loadProfile,
    pingLoading,
    pingPrompt,
    pingProviderId,
    pingState,
    pingUsageSummary,
    profileDefaultProvider,
    profileLoading,
    providerOptions,
    setPingPrompt,
    setPingProviderId,
  } = configState;
  const {
    handleFetchSnapshot,
    handleGenerateSummary,
    selectedHistoryEntry,
    selectedHistoryMetrics,
    snapshotError,
    snapshotHistory,
    snapshotHistoryError,
    snapshotHistoryLoading,
    snapshotLoading,
    snapshotPreviewMetrics,
    snapshotRange,
    summaryError,
    summaryLoading,
    summaryResult,
    setSnapshotRange,
  } = snapshotState;
  const {
    feedbackSubmitting,
    handleCloseHistoryEntry,
    handleInsightFeedback,
    handleRefreshInsights,
    handleRunInsightJob,
    handleToggleNotify,
    handleViewHistoryEntry,
    insightRunLoading,
    insights,
    insightsError,
    insightsLoading,
    insightsMeta,
    notifyOnAnomaly,
    notifySaving,
  } = insightState;

  return (
    <section className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--ds-border-subtle)] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--ds-text-primary)]">Chat với trợ lý AI</h2>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            Hỏi về KPI, dữ liệu tờ khai hoặc quy trình nội bộ. Tất cả câu trả lời đều bằng tiếng Việt.
          </p>
          {isOllamaProvider(profileDefaultProvider) ? (
            <p className="mt-1 flex items-center gap-2 text-[11px] font-medium text-emerald-600">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Dữ liệu câu hỏi được xử lý hoàn toàn nội bộ qua Ollama cục bộ.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={historyLoading || messages.length === 0}
            className={secondaryButtonClass}
          >
            Xóa hội thoại
          </button>
          <button
            type="button"
            onClick={loadProfile}
            className={secondaryButtonClass}
            disabled={profileLoading}
          >
            {profileLoading ? 'Đang tải…' : 'Tải lại cấu hình'}
          </button>
        </div>
      </header>

      <div className="border-t border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
              Chế độ hội thoại
              <span className="ml-2 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                {activeMode?.scope || 'general'}
              </span>
            </p>
            <p className="text-xs text-[color:var(--ds-text-muted)]">{activeMode?.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {assistantModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleModeChange(mode.id)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium transition',
                  mode.id === modeId
                    ? 'bg-amber-500 text-white shadow'
                    : 'border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] text-[color:var(--ds-text-secondary)] hover:border-amber-400 hover:bg-amber-500/10 hover:text-amber-500'
                )}
                aria-pressed={mode.id === modeId}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {activeMode?.suggestions?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeMode.suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-700 transition hover:bg-amber-50"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3 rounded border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]/60 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[color:var(--ds-text-primary)]">Nhà cung cấp kiểm thử</span>
              <select
                value={pingProviderId}
                onChange={(event) => setPingProviderId(event.target.value)}
                className={clsx('min-w-[200px]', compactControlClass)}
                disabled={availableProviders.length === 0}
              >
                {availableProviders.length === 0 ? (
                  <option value="">Chưa có nhà cung cấp</option>
                ) : (
                  availableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                      {provider.isDefault ? ' • Mặc định' : provider.isFallback ? ' • Dự phòng' : ''}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs">
              <span className="font-medium text-[color:var(--ds-text-primary)]">Thông điệp kiểm thử</span>
              <input
                type="text"
                value={pingPrompt}
                onChange={(event) => setPingPrompt(event.target.value)}
                className={clsx('flex-1', compactControlClass)}
                placeholder="Ví dụ: Ping hệ thống"
              />
            </label>
            <button
              type="button"
              onClick={handlePingConnection}
              disabled={pingLoading || availableProviders.length === 0}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pingLoading ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
            </button>
          </div>
          {pingState.status === 'testing' ? (
            <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">Đang kiểm tra kết nối…</p>
          ) : null}
          {pingState.status === 'success' ? (
            <div className="mt-2 text-xs text-emerald-600">
              <span>
                Đã phản hồi từ {pingState.provider?.label || pingState.provider?.id || 'nhà cung cấp'}: {pingState.message || 'OK'}
              </span>
              <span className="block text-[10px] text-[color:var(--ds-text-muted)]">
                {pingState.timestamp
                  ? new Date(pingState.timestamp).toLocaleString('vi-VN', { hour12: false })
                  : ''}
                {pingUsageSummary ? ` • ${pingUsageSummary}` : ''}
              </span>
            </div>
          ) : null}
          {pingState.status === 'error' ? <p className="mt-2 text-xs text-red-500">Lỗi: {pingState.error}</p> : null}
          {availableProviders.length === 0 ? (
            <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">
              Chưa có nhà cung cấp nào được cấu hình để kiểm thử.
            </p>
          ) : null}
        </div>

        <div className="mt-3 space-y-3 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]/60 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-[color:var(--ds-text-secondary)]">
              Khoảng thời gian
              <select
                value={snapshotRange}
                onChange={(event) => setSnapshotRange(event.target.value)}
                className={compactControlClass}
              >
                {summaryRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={(event) => handleFetchSnapshot({ force: event?.shiftKey })}
              disabled={snapshotLoading}
              className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1.5 text-xs font-medium text-[color:var(--ds-text-secondary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              title="Nhấn Shift khi bấm để buộc tải lại từ máy chủ"
            >
              {snapshotLoading ? 'Đang tải...' : 'Lấy snapshot'}
            </button>
            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={summaryLoading || snapshotLoading}
              className="rounded bg-[color:var(--ds-text-primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ds-text-inverse)] shadow transition hover:bg-[color:var(--ds-text-primary)]/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {summaryLoading ? 'Đang tóm tắt…' : 'Tạo tóm tắt KPI'}
            </button>
          </div>
          {snapshotLoading ? <p className="text-xs text-[color:var(--ds-text-muted)]">Đang lấy dữ liệu KPI...</p> : null}
          {snapshotError ? <p className="text-xs text-red-400">{snapshotError}</p> : null}
          {snapshotPreviewMetrics && !snapshotLoading ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-[color:var(--ds-text-secondary)]">
              {snapshotPreviewMetrics.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {summaryLoading ? <p className="text-xs text-[color:var(--ds-text-muted)]">Đang tạo tóm tắt KPI bằng AI...</p> : null}
          {summaryError ? <p className="text-xs text-red-400">{summaryError}</p> : null}
          {summaryResult ? (
            <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/70 p-3 text-sm text-[color:var(--ds-text-primary)]">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--ds-text-muted)]">
                <span>{summaryResult.rangeLabel}</span>
                {summaryResult.providerId ? <span>• Provider: {summaryResult.providerId}</span> : null}
                {summaryResult.cached ? <span>• Cache</span> : null}
                {summaryResult.usage ? <span>• {formatUsage(summaryResult.usage)}</span> : null}
                {summaryResult.generatedAt ? (
                  <span>• {new Date(summaryResult.generatedAt).toLocaleString('vi-VN', { hour12: false })}</span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{summaryResult.text || 'Không có phản hồi.'}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-3 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Insight AI tự động</h3>
            {insightsMeta?.schedule?.nextRun ? (
              <p className="text-xs text-[color:var(--ds-text-muted)]">
                {`Lần chạy kế tiếp: ${formatDateTime(insightsMeta.schedule.nextRun)}`}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshInsights}
              disabled={insightsLoading}
              className={secondaryButtonClass}
            >
              {insightsLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
            {canManage ? (
              <button
                type="button"
                onClick={handleRunInsightJob}
                disabled={insightRunLoading || insightsLoading}
                className={clsx(secondaryButtonClass, 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600')}
              >
                {insightRunLoading ? 'Đang chạy...' : 'Chạy ngay'}
              </button>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyOnAnomaly}
                onChange={handleToggleNotify}
                disabled={notifySaving}
              />
              <span>Nhận thông báo khi insight cảnh báo bất thường</span>
            </label>
            {notifySaving ? <p className="mt-1 text-[11px] text-amber-600">Đang lưu tuỳ chọn…</p> : null}
          </div>
        ) : null}

        {insightsError ? <p className="text-xs text-red-500">{insightsError}</p> : null}
        {insightsLoading ? (
          <p className="text-sm text-[color:var(--ds-text-muted)]">Đang tải insight AI...</p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-[color:var(--ds-text-muted)]">Chưa có insight AI nào.</p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => {
              const viewer = insight.feedback?.viewer || null;
              const viewerHelpful = viewer?.helpful === true;
              const viewerNotHelpful = viewer?.helpful === false;
              const saving = !!feedbackSubmitting[insight.insightId];
              const rangeLabel = insight.meta?.rangeLabel
                || (insight.range ? `${insight.range.from || '---'} → ${insight.range.to || '---'}` : 'Khoảng thời gian không xác định');

              return (
                <div
                  key={insight.insightId}
                  className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/60 p-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--ds-text-primary)]">{rangeLabel}</p>
                      <p className="text-xs text-[color:var(--ds-text-muted)]">
                        {`Tạo lúc ${formatDateTime(insight.createdAt)} • ${insight.status}`}
                      </p>
                    </div>
                    <div className="text-xs text-[color:var(--ds-text-muted)]">{`Tokens: ${insight.tokens?.total ?? 0}`}</div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ds-text-primary)]">
                    {insight.response || 'Không có nội dung.'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleInsightFeedback(insight.insightId, true)}
                        disabled={saving}
                        className={clsx(
                          compactControlClass,
                          viewerHelpful && 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        )}
                      >
                        Hữu ích
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsightFeedback(insight.insightId, false)}
                        disabled={saving}
                        className={clsx(
                          compactControlClass,
                          viewerNotHelpful && 'bg-rose-100 text-rose-700 border-rose-300'
                        )}
                      >
                        Chưa hữu ích
                      </button>
                    </div>
                    <span className="text-xs text-[color:var(--ds-text-muted)]">
                      {`${insight.feedback?.helpful ?? 0} hữu ích · ${insight.feedback?.notHelpful ?? 0} chưa hữu ích`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-dashed border-[color:var(--ds-border-subtle)] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]">
              Lịch sử snapshot KPI
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => snapshotState.loadSnapshotHistory(6)}
                disabled={snapshotHistoryLoading}
                className={secondaryButtonClass}
              >
                {snapshotHistoryLoading ? 'Đang tải...' : 'Tải lại'}
              </button>
              {selectedHistoryEntry ? (
                <button type="button" onClick={handleCloseHistoryEntry} className={secondaryButtonClass}>
                  Thu gọn
                </button>
              ) : null}
            </div>
          </div>
          {snapshotHistoryError ? <p className="mt-1 text-xs text-red-500">{snapshotHistoryError}</p> : null}
          {snapshotHistoryLoading && snapshotHistory.length === 0 ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">Đang tải lịch sử snapshot...</p>
          ) : snapshotHistory.length === 0 ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">Chưa có snapshot nào được lưu.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {snapshotHistory.map((entry) => {
                const selected = selectedHistoryEntry?.id === entry.id;

                return (
                  <li
                    key={entry.id}
                    className={clsx(
                      'rounded border px-3 py-2 text-xs transition',
                      selected
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[color:var(--ds-text-primary)]">
                          {entry.range?.from && entry.range?.to
                            ? `${entry.range.from} → ${entry.range.to}`
                            : 'Khoảng thời gian không xác định'}
                        </p>
                        <p className="text-[11px] text-[color:var(--ds-text-muted)]">
                          {`Tạo lúc ${formatDateTime(entry.generatedAt)}`}
                          {entry.rulesVersion ? ` • Quy tắc ${entry.rulesVersion}` : ''}
                          {entry.rosterVersion ? ` • Roster ${entry.rosterVersion}` : ''}
                          {entry.source ? ` • ${entry.source === 'cron' ? 'Tự động' : 'Thủ công'}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.insightId ? (
                          <span className="text-[11px] text-[color:var(--ds-text-muted)]">Insight: {entry.insightId}</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleViewHistoryEntry(entry.id)}
                          className={secondaryButtonClass}
                        >
                          {selected ? 'Đang xem' : 'Xem snapshot'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedHistoryEntry ? (
          <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                  {selectedHistoryEntry.range?.from && selectedHistoryEntry.range?.to
                    ? `${selectedHistoryEntry.range.from} → ${selectedHistoryEntry.range.to}`
                    : 'Khoảng thời gian không xác định'}
                </p>
                <p className="text-xs text-[color:var(--ds-text-muted)]">
                  {`Snapshot lúc ${formatDateTime(selectedHistoryEntry.generatedAt)}`}
                </p>
              </div>
              <button type="button" onClick={handleCloseHistoryEntry} className={secondaryButtonClass}>
                Đóng
              </button>
            </div>
            {selectedHistoryMetrics.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[color:var(--ds-text-secondary)]">
                {selectedHistoryMetrics.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">Không có dữ liệu tóm tắt.</p>
            )}
          </div>
        ) : null}

        {insightsMeta?.state?.lastRunAt ? (
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            {`Lần chạy gần nhất: ${formatDateTime(insightsMeta.state.lastRunAt)} (trạng thái: ${insightsMeta.state.lastStatus})`}
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSendPrompt} className="space-y-4 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[color:var(--ds-text-primary)]">Câu hỏi</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              className={clsx('min-h-[120px]', controlClass)}
              placeholder="Ví dụ: Tóm tắt điểm KPI tháng 8 cho nhóm A11"
            />
          </label>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-[color:var(--ds-text-primary)]">Phạm vi</span>
              <input
                type="text"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className={controlClass}
                placeholder="general, ecus, kpi…"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-[color:var(--ds-text-primary)]">Nhà cung cấp</span>
              <select
                value={selectedProviderId || ''}
                onChange={(event) => setSelectedProviderId(event.target.value)}
                className={controlClass}
              >
                <option value="">Tự động (theo cấu hình mặc định)</option>
                {providerOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                    {provider.isDefault ? ' • Mặc định' : provider.isFallback ? ' • Dự phòng' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[color:var(--ds-text-primary)]">Ngữ cảnh bổ sung (tùy chọn)</span>
          <textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            rows={3}
            className={clsx('min-h-[72px]', controlClass)}
            placeholder="Thêm số liệu, chính sách hoặc ghi chú hỗ trợ trả lời chính xác"
          />
        </label>
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={sending || historyLoading}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {sending ? 'Đang gửi…' : historyLoading ? 'Đang tải…' : 'Gửi yêu cầu'}
          </button>
        </div>
      </form>

      {historyPanel}
    </section>
  );
}
