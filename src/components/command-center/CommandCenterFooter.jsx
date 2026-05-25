import React from 'react';

export default function CommandCenterFooter({ onClose }) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-gray-400">
      <span>
        Gợi ý: dùng <kbd className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-600">↑↓</kbd> để di chuyển,{' '}
        <kbd className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-600">Enter</kbd> để chọn.
      </span>

      <button
        type="button"
        onClick={onClose}
        className="rounded border border-gray-300 px-2 py-1 text-gray-500 transition hover:bg-gray-100 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
      >
        Đóng
      </button>
    </div>
  );
}
