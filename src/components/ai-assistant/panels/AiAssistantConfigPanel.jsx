import React from 'react';

import clsx from 'clsx';

import {
  isOllamaProvider,
  resolveProviderHealth,
} from '@/components/ai-assistant/providerConfig.js';

export default function AiAssistantConfigPanel({
  configState,
  controlClass,
  compactControlClass,
  secondaryButtonClass,
  providerPresets,
  formatUsage,
}) {
  const {
    configError,
    configLoading,
    configSaving,
    draft,
    draftDefaultProvider,
    handleAddProvider,
    handleCachingChange,
    handleConfigReset,
    handleConfigSubmit,
    handleDraftFieldChange,
    handleProviderChange,
    handleRemoveProvider,
    handleTestProvider,
    loadConfig,
    newProviderPreset,
    providerTests,
    setNewProviderPreset,
  } = configState;

  return (
    <section className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--ds-border-subtle)] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--ds-text-primary)]">Cấu hình trợ lý AI</h2>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            Điều chỉnh nhà cung cấp, cache và prompt hệ thống cho toàn bộ tổ chức.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadConfig}
            className={secondaryButtonClass}
            disabled={configLoading}
          >
            {configLoading ? 'Đang tải…' : 'Làm mới'}
          </button>
          <button
            type="button"
            onClick={handleConfigReset}
            className={secondaryButtonClass}
            disabled={configLoading || !draft}
          >
            Khôi phục
          </button>
        </div>
      </header>
      {configError ? <p className="px-4 pt-3 text-xs text-red-600">{configError}</p> : null}
      <form onSubmit={handleConfigSubmit} className="space-y-6 px-4 py-4">
        {!draft && configLoading ? <p className="text-sm text-[color:var(--ds-text-muted)]">Đang tải cấu hình…</p> : null}
        {draft ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--ds-text-primary)]">
                <input
                  type="checkbox"
                  checked={draft.enabled !== false}
                  onChange={(event) => handleDraftFieldChange('enabled', event.target.checked)}
                  className="h-4 w-4 rounded border-[color:var(--ds-border-subtle)] text-amber-500 focus:ring-amber-400"
                />
                Bật trợ lý AI
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-[color:var(--ds-text-primary)]">Nhà cung cấp mặc định</span>
                <select
                  value={draft.defaultProvider}
                  onChange={(event) => handleDraftFieldChange('defaultProvider', event.target.value)}
                  className={controlClass}
                >
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {draft.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label || provider.id}
                      {isOllamaProvider(provider) ? ' • Nội bộ (đề xuất)' : ''}
                    </option>
                  ))}
                </select>
                {isOllamaProvider(draftDefaultProvider) ? (
                  <p className="text-xs text-emerald-600">
                    Đang sử dụng mô hình Ollama nội bộ — dữ liệu hỏi đáp sẽ được giữ trong mạng doanh nghiệp.
                  </p>
                ) : (
                  <p className="text-xs text-[color:var(--ds-text-muted)]">
                    Khuyến nghị chọn &quot;Ollama cục bộ&quot; để đảm bảo dữ liệu không rời khỏi hệ thống.
                  </p>
                )}
                {draft.defaultProvider && providerTests[draft.defaultProvider]?.status === 'error' ? (
                  <p className="text-xs text-red-600">
                    Không thể kết nối nhà cung cấp mặc định, vui lòng kiểm tra lại dịch vụ Ollama hoặc chọn nhà cung cấp khác.
                  </p>
                ) : null}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-[color:var(--ds-text-primary)]">Nhà cung cấp dự phòng</span>
                <select
                  value={draft.fallbackProvider || ''}
                  onChange={(event) => handleDraftFieldChange('fallbackProvider', event.target.value)}
                  className={controlClass}
                >
                  <option value="">Không dùng dự phòng</option>
                  {draft.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label || provider.id}
                      {isOllamaProvider(provider) ? ' • Nội bộ' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-[color:var(--ds-text-primary)]">Giới hạn token trả lời</span>
                <input
                  type="number"
                  min="1"
                  value={draft.maxTokens}
                  onChange={(event) => handleDraftFieldChange('maxTokens', event.target.value)}
                  className={controlClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-[color:var(--ds-text-primary)]">Nhiệt độ (Temperature)</span>
                <input
                  type="number"
                  step="0.1"
                  value={draft.temperature}
                  onChange={(event) => handleDraftFieldChange('temperature', event.target.value)}
                  className={controlClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-[color:var(--ds-text-primary)]">Giới hạn độ dài prompt</span>
                <input
                  type="number"
                  min="1"
                  value={draft.maxInputLength}
                  onChange={(event) => handleDraftFieldChange('maxInputLength', event.target.value)}
                  className={controlClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-[color:var(--ds-text-primary)]">Timeout (ms)</span>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={draft.timeoutMs}
                  onChange={(event) => handleDraftFieldChange('timeoutMs', event.target.value)}
                  className={controlClass}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-[color:var(--ds-text-primary)]">Prompt hệ thống</span>
              <textarea
                value={draft.systemPrompt}
                onChange={(event) => handleDraftFieldChange('systemPrompt', event.target.value)}
                rows={3}
                className={clsx('min-h-[96px]', controlClass)}
                placeholder="Hướng dẫn mặc định cho mọi câu hỏi"
              />
            </label>

            <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3">
              <h3 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Cache tiết kiệm token</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--ds-text-primary)]">
                  <input
                    type="checkbox"
                    checked={draft.caching?.enabled !== false}
                    onChange={(event) => handleCachingChange('enabled', event.target.checked)}
                    className="h-4 w-4 rounded border-[color:var(--ds-border-subtle)] text-amber-500 focus:ring-amber-400"
                  />
                  Bật cache
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>TTL (phút)</span>
                  <input
                    type="number"
                    min="1"
                    value={draft.caching?.ttlMinutes}
                    onChange={(event) => handleCachingChange('ttlMinutes', event.target.value)}
                    className={controlClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Số bản ghi tối đa</span>
                  <input
                    type="number"
                    min="1"
                    value={draft.caching?.maxEntries}
                    onChange={(event) => handleCachingChange('maxEntries', event.target.value)}
                    className={controlClass}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Nhà cung cấp</h3>
              <div className="rounded border border-dashed border-amber-300 bg-[color:var(--ds-surface-card)]/70 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col text-xs font-medium text-[color:var(--ds-text-primary)]">
                    <span>Preset nhà cung cấp</span>
                    <select
                      value={newProviderPreset}
                      onChange={(event) => setNewProviderPreset(event.target.value)}
                      className={clsx('mt-1', compactControlClass)}
                    >
                      {providerPresets.map((preset) => (
                        <option key={preset.key} value={preset.key}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddProvider(newProviderPreset)}
                    className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-600"
                  >
                    Thêm nhà cung cấp
                  </button>
                  <p className="text-xs text-gray-500">
                    Có thể khai báo nhiều nhà cung cấp để chuyển đổi nhanh theo tình huống vận hành.
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-xs text-gray-500">
                <p>Lưu ý: điền khóa API trực tiếp nếu chưa thiết lập biến môi trường tương ứng trên máy chủ.</p>
                <ul className="list-disc space-y-0.5 pl-4 text-[color:var(--ds-text-muted)]">
                  <li>
                    Google AI Studio: endpoint mặc định <code className="font-mono">https://generativelanguage.googleapis.com</code>, model đề xuất <code className="font-mono">gemini-1.5-flash</code>, khóa có dạng <code className="font-mono">AIza...</code>.
                  </li>
                  <li>
                    OpenAI: endpoint <code className="font-mono">https://api.openai.com/v1</code>, model ví dụ <code className="font-mono">gpt-4o-mini</code>, khóa mang tiền tố <code className="font-mono">sk-</code>.
                  </li>
                  <li>
                    Anthropic Claude: endpoint <code className="font-mono">https://api.anthropic.com</code>, version <code className="font-mono">2023-06-01</code>, khóa bắt đầu bằng <code className="font-mono">sk-ant-</code>.
                  </li>
                  <li>
                    Azure OpenAI: điền Deployment name và API Version (ví dụ <code className="font-mono">2024-08-01-preview</code>), endpoint dạng <code className="font-mono">https://&lt;tên-dịch-vụ&gt;.openai.azure.com</code>.
                  </li>
                </ul>
              </div>

              {draft.providers.map((provider) => {
                const testState = providerTests[provider.id] || null;
                const healthMeta = resolveProviderHealth(testState);

                return (
                  <div
                    key={provider.id}
                    className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                            {provider.label || provider.id}
                          </p>
                          {isOllamaProvider(provider) ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Nội bộ (Ollama)
                            </span>
                          ) : null}
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                              healthMeta.className
                            )}
                          >
                            {healthMeta.label}
                          </span>
                        </div>
                        <p className="text-xs uppercase tracking-wide text-[color:var(--ds-text-muted)]">{provider.id}</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium text-[color:var(--ds-text-primary)]">
                        <input
                          type="checkbox"
                          checked={provider.enabled !== false}
                          onChange={(event) => handleProviderChange(provider.id, { enabled: event.target.checked })}
                          className="h-4 w-4 rounded border-[color:var(--ds-border-subtle)] text-amber-500 focus:ring-amber-400"
                        />
                        Kích hoạt
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveProvider(provider.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm">
                        <span>Tên hiển thị</span>
                        <input
                          type="text"
                          value={provider.label}
                          onChange={(event) => handleProviderChange(provider.id, { label: event.target.value })}
                          className={controlClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>Endpoint</span>
                        <input
                          type="text"
                          value={provider.endpoint}
                          onChange={(event) => handleProviderChange(provider.id, { endpoint: event.target.value })}
                          className={controlClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>Deployment / Model</span>
                        <input
                          type="text"
                          value={provider.deployment || provider.model || ''}
                          onChange={(event) => {
                            if (provider.type === 'azure' || provider.type === 'azure-openai') {
                              handleProviderChange(provider.id, { deployment: event.target.value });
                            } else {
                              handleProviderChange(provider.id, { model: event.target.value });
                            }
                          }}
                          className={controlClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>API Version / Key env</span>
                        <input
                          type="text"
                          value={provider.type === 'azure' || provider.type === 'azure-openai' ? provider.apiVersion : provider.apiKeyEnv}
                          onChange={(event) => {
                            if (provider.type === 'azure' || provider.type === 'azure-openai') {
                              handleProviderChange(provider.id, { apiVersion: event.target.value });
                            } else {
                              handleProviderChange(provider.id, { apiKeyEnv: event.target.value });
                            }
                          }}
                          className={controlClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>Nhiệt độ riêng</span>
                        <input
                          type="number"
                          step="0.1"
                          value={provider.temperature}
                          onChange={(event) => handleProviderChange(provider.id, { temperature: event.target.value })}
                          className={controlClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>Max tokens riêng</span>
                        <input
                          type="number"
                          min="1"
                          value={provider.maxTokens}
                          onChange={(event) => handleProviderChange(provider.id, { maxTokens: event.target.value })}
                          className={controlClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm md:col-span-2">
                        <span>API Key trực tiếp</span>
                        <input
                          type="password"
                          value={provider.apiKey || ''}
                          onChange={(event) => handleProviderChange(provider.id, {
                            apiKey: event.target.value,
                            clearStoredKey: false,
                          })}
                          placeholder={
                            provider.hasStoredKey && provider.apiKeyPreview
                              ? `Đang lưu: •••${provider.apiKeyPreview}`
                              : 'Ví dụ: AIza..., sk-..., hoặc để trống nếu dùng biến môi trường'
                          }
                          className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span>Để trống nếu dùng biến môi trường {provider.apiKeyEnv || '(chưa đặt)'}.</span>
                          {provider.hasStoredKey ? (
                            <button
                              type="button"
                              onClick={() => handleProviderChange(provider.id, {
                                apiKey: '',
                                clearStoredKey: true,
                                hasStoredKey: false,
                                apiKeyPreview: '',
                              })}
                              className="text-red-600 hover:underline"
                            >
                              Xóa khóa đã lưu
                            </button>
                          ) : null}
                        </div>
                      </label>
                      <div className="md:col-span-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestProvider(provider.id)}
                            className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)]"
                          >
                            Kiểm tra khóa API
                          </button>
                          {testState?.status === 'testing' ? (
                            <span className="text-xs text-[color:var(--ds-text-muted)]">Đang kiểm tra…</span>
                          ) : null}
                          {testState?.status === 'stale' ? (
                            <span className="text-xs text-amber-600">Đã thay đổi cấu hình, cần kiểm tra lại.</span>
                          ) : null}
                          {testState?.status === 'success' ? (
                            <span className="text-xs text-emerald-600">
                              Thành công: {testState.message || 'Đã phản hồi'}
                            </span>
                          ) : null}
                          {testState?.status === 'error' ? (
                            <span className="text-xs text-red-500">Lỗi: {testState.error}</span>
                          ) : null}
                        </div>
                        {testState?.usage ? (
                          <p className="mt-1 text-[10px] text-[color:var(--ds-text-muted)]">
                            {formatUsage(testState.usage)}
                            {testState.checkedAt ? ` • ${new Date(testState.checkedAt).toLocaleString('vi-VN')}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleConfigReset}
                className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                disabled={configSaving || configLoading}
              >
                Hủy thay đổi
              </button>
              <button
                type="submit"
                disabled={configSaving}
                className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {configSaving ? 'Đang lưu…' : 'Lưu cấu hình'}
              </button>
            </div>
          </>
        ) : null}
      </form>
    </section>
  );
}
