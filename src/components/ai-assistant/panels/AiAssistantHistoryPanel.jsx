import React from 'react';

import clsx from 'clsx';

import { resolveProviderLabel } from '@/components/ai-assistant/providerConfig.js';

export default function AiAssistantHistoryPanel({
  config,
  conversation,
  controlClass,
  formatDateTime,
  formatUsage,
  profile,
  secondaryButtonClass,
}) {
  const {
    filteredMessages,
    hasHistoryFilter,
    historyKeyword,
    historyLoading,
    messages,
    setHistoryKeyword,
  } = conversation;

  return (
    <div className="border-t border-[color:var(--ds-border-subtle)] px-4 py-4">
      <h3 className="mb-3 text-sm font-semibold text-[color:var(--ds-text-primary)]">Lịch sử hội thoại</h3>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={historyKeyword}
          onChange={(event) => setHistoryKeyword(event.target.value)}
          placeholder="Tìm nội dung hoặc scope..."
          className={clsx('min-w-[180px] flex-1', controlClass)}
        />
        <span className="text-xs text-[color:var(--ds-text-muted)]">
          {hasHistoryFilter
            ? `${filteredMessages.length}/${messages.length} đoạn khớp`
            : `${messages.length} đoạn hội thoại`}
        </span>
        {hasHistoryFilter ? (
          <button
            type="button"
            onClick={() => setHistoryKeyword('')}
            className={clsx(secondaryButtonClass, 'px-2')}
          >
            Xóa lọc
          </button>
        ) : null}
      </div>
      <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        {historyLoading ? <p className="text-gray-500">Đang tải lịch sử hội thoại…</p> : null}
        {!historyLoading && filteredMessages.length === 0 ? (
          <p className="text-gray-500">
            {hasHistoryFilter
              ? 'Không tìm thấy hội thoại phù hợp với từ khóa.'
              : 'Chưa có hội thoại nào. Hãy nhập câu hỏi ở trên để bắt đầu.'}
          </p>
        ) : null}
        {filteredMessages.map((message) => {
          const usageText = formatUsage(message.usage);
          const providerLabel = message.role === 'assistant'
            ? resolveProviderLabel(profile, config, message.providerId)
            : null;

          return (
            <div
              key={message.id}
              className={clsx(
                'max-w-full rounded border px-3 py-2 text-sm shadow-sm',
                message.role === 'user' && 'self-end border-amber-200 bg-amber-50 text-amber-900',
                message.role === 'assistant' && 'self-start border-white bg-white text-gray-800',
                message.role === 'error' && 'self-start border-red-200 bg-red-50 text-red-700'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                  {message.role === 'user' ? 'Người dùng' : null}
                  {message.role === 'assistant' ? (message.cached ? 'AI (cache)' : 'AI') : null}
                  {message.role === 'error' ? 'Lỗi' : null}
                </span>
                <span>{formatDateTime(message.createdAt)}</span>
              </div>
              {message.scope ? (
                <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">Scope: {message.scope}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {message.text || (message.role === 'assistant' ? 'Không có nội dung trả về.' : '')}
              </p>
              {providerLabel ? <p className="mt-2 text-xs text-gray-500">Nhà cung cấp: {providerLabel}</p> : null}
              {usageText ? <p className="mt-1 text-xs text-gray-500">Token: {usageText}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
