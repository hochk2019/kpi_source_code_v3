import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTheme } from 'next-themes';

import {
  buildCommandCenterCommands,
  formatCommandCenterResults,
} from './CommandCenter.jsx';

const MAX_RESULTS = 8;

export default function GlobalSearch({
  currentUser,
  onRequestLogin,
  onRequestLogout,
  onRequestChangePassword,
}) {
  const { theme, setTheme } = useTheme();
  const containerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const commands = useMemo(
    () =>
      buildCommandCenterCommands({
        currentUser,
        onRequestLogin,
        onRequestLogout,
        onRequestChangePassword,
        setTheme,
        themePreference: theme,
      }),
    [currentUser, onRequestLogin, onRequestLogout, onRequestChangePassword, setTheme, theme],
  );

  const results = useMemo(() => {
    const entries = formatCommandCenterResults(commands, [], {}, query).filter(
      (entry) => entry.type === 'command',
    );

    if (!query.trim()) {
      return entries
        .filter((entry) =>
          ['navigation', 'data', 'support'].includes(entry.command.group || 'misc'),
        )
        .slice(0, MAX_RESULTS);
    }

    return entries.slice(0, MAX_RESULTS);
  }, [commands, query]);

  const hasResults = results.length > 0;
  const activeCommand = results[highlightedIndex]?.command || null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
        setHighlightedIndex(0);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(0);
    }
  }, [open]);

  const handleRunCommand = (command) => {
    if (!command || typeof command.run !== 'function') {
      return;
    }
    setOpen(false);
    setQuery('');
    setHighlightedIndex(0);
    window.setTimeout(() => {
      try {
        command.run();
      } catch (error) {
        console.error('Không thể thực thi command', command.id, error);
      }
    }, 10);
  };

  const handleKeyDown = (event) => {
    if (!hasResults) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeCommand) {
        handleRunCommand(activeCommand);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-[220px] flex-1 text-left">
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm transition focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200 dark:border-slate-700 dark:bg-slate-900/60 ${
          open ? 'border-amber-400' : 'border-gray-300'
        }`}
      >
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Tìm nhanh module, báo cáo, người dùng..."
          className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />
      </div>
      {open && hasResults ? (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {results.map((entry, index) => {
            const { command } = entry;
            const Icon = command.icon;
            const active = index === highlightedIndex;
            return (
              <li key={command.id}>
                <button
                  type="button"
                  onClick={() => handleRunCommand(command)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent-ring)] ${
                    active
                      ? 'bg-amber-100/70 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                    {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold leading-tight">{command.label}</span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {command.description}
                    </span>
                  </span>
                  <span className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {GROUP_TITLES_MAP[command.group] || 'Khác'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && !hasResults ? (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-4 text-sm text-gray-500 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-gray-400">
          Không có kết quả phù hợp, hãy thử từ khóa khác.
        </div>
      ) : null}
    </div>
  );
}

const GROUP_TITLES_MAP = {
  navigation: 'Module',
  data: 'Dữ liệu',
  reports: 'Báo cáo',
  support: 'Hỗ trợ',
  account: 'Tài khoản',
  display: 'Hiển thị',
};
