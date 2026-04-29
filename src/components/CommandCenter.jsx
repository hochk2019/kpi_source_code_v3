import React, { useCallback, useState } from 'react';
import { Search } from 'lucide-react';

import CommandCenterFooter from '@/components/command-center/CommandCenterFooter.jsx';
import CommandCenterResultsList from '@/components/command-center/CommandCenterResultsList.jsx';
import CommandCenterSearchInput from '@/components/command-center/CommandCenterSearchInput.jsx';
import useCommandCenterState from '@/components/command-center/useCommandCenterState.js';
import { useTheme } from '@/designSystem/useTheme.js';

function CommandCenterEmptyState({ suggestions, onRunSuggestion }) {
  return (
    <div className="px-3 py-6">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
        Không tìm thấy kết quả phù hợp.
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Thử từ khóa khác hoặc quay về các thao tác được dùng nhiều bên dưới.
      </p>

      {suggestions.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onRunSuggestion(suggestion)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CommandCenter({
  currentUser,
  onRequestLogin,
  onRequestLogout,
  onRequestChangePassword,
  className = '',
}) {
  const { theme, setTheme } = useTheme();

  const {
    closeDialog,
    dialogId,
    dialogTitleId,
    emptySuggestions,
    entries,
    handleKeyNavigation,
    handleRunCommand,
    highlightedIndex,
    inputRef,
    open,
    openDialog,
    pinned,
    query,
    setHighlightedIndex,
    togglePin,
    updateQuery,
    visibleCommands,
  } = useCommandCenterState({
    currentUser,
    onRequestLogin,
    onRequestLogout,
    onRequestChangePassword,
    setTheme,
    themePreference: theme,
  });

  // UX-005: Inline search state for collapsed header
  const [inlineQuery, setInlineQuery] = useState('');
  const handleInlineChange = useCallback((value) => {
    setInlineQuery(value);
    if (value.trim()) {
      updateQuery(value);
      openDialog();
    }
  }, [updateQuery, openDialog]);

  return (
    <>
      {/* UX-005: Inline search bar in collapsed header */}
      {!open ? (
        <div className={`flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 shadow-sm transition hover:border-gray-400 dark:border-gray-700 dark:bg-slate-900 ${className}`.trim()}>
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={inlineQuery}
            onChange={(e) => handleInlineChange(e.target.value)}
            onFocus={openDialog}
            placeholder="Tìm lệnh... (Ctrl+K)"
            className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none dark:text-gray-200 w-32 sm:w-48"
            aria-label="Tìm kiếm lệnh"
          />
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-24 backdrop-blur-sm">
          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4 dark:border-slate-700">
              <h2 id={dialogTitleId} className="sr-only">
                Command Center
              </h2>
              <CommandCenterSearchInput
                inputRef={inputRef}
                query={query}
                onChange={(event) => updateQuery(event.target.value)}
                onKeyDown={handleKeyNavigation}
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-2 py-3">
              {visibleCommands.length === 0 ? (
                <CommandCenterEmptyState
                  suggestions={emptySuggestions}
                  onRunSuggestion={handleRunCommand}
                />
              ) : (
                <CommandCenterResultsList
                  entries={entries}
                  highlightedIndex={highlightedIndex}
                  pinnedIds={pinned}
                  onRunCommand={handleRunCommand}
                  onHoverCommand={setHighlightedIndex}
                  onTogglePin={togglePin}
                />
              )}
            </div>

            <CommandCenterFooter onClose={closeDialog} />
          </div>
        </div>
      ) : null}
    </>
  );
}
