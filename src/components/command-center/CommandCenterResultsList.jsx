import React from 'react';
import { Command as CommandIcon, Pin, PinOff } from 'lucide-react';

function CommandCenterResultRow({
  command,
  active,
  pinned,
  onRun,
  onPinToggle,
  onHover,
}) {
  const Icon = command.icon || CommandIcon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onRun(command)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRun(command);
        }
      }}
      onMouseEnter={onHover}
      className={`group flex w-full items-start justify-between gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent-ring)] ${
        active
          ? 'bg-amber-100/70 text-amber-900 shadow-sm dark:bg-amber-500/10 dark:text-amber-100'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex flex-1 items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition group-hover:bg-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 ${
            active ? 'bg-amber-500/20 dark:bg-amber-500/20' : ''
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-semibold leading-tight">{command.label}</span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            {command.description}
          </span>
        </span>
      </div>

      <div className="flex flex-col items-end gap-2 text-xs text-gray-400">
        {command.usageInfo?.count ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-gray-400">
            {command.usageInfo.count} lần
          </span>
        ) : null}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPinToggle(command.id);
          }}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:bg-gray-200 dark:hover:bg-slate-700 ${
            pinned ? 'border-amber-400 text-amber-500' : 'border-transparent text-gray-400'
          }`}
          aria-label={pinned ? 'Bỏ ghim thao tác' : 'Ghim thao tác'}
        >
          {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function CommandCenterResultsList({
  entries,
  highlightedIndex,
  pinnedIds,
  onRunCommand,
  onHoverCommand,
  onTogglePin,
}) {
  const visibleCommands = entries.filter((entry) => entry.type === 'command');

  return (
    <ul className="grid gap-1">
      {entries.map((entry) => {
        if (entry.type === 'header') {
          return (
            <li
              key={entry.id}
              className="px-3 pt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400 first:pt-0"
            >
              {entry.title}
            </li>
          );
        }

        const { command } = entry;
        const commandIndex = visibleCommands.findIndex((item) => item.command.id === command.id);

        return (
          <li key={command.id}>
            <CommandCenterResultRow
              command={command}
              active={commandIndex === highlightedIndex}
              pinned={pinnedIds.includes(command.id)}
              onRun={onRunCommand}
              onPinToggle={onTogglePin}
              onHover={() => onHoverCommand(commandIndex)}
            />
          </li>
        );
      })}
    </ul>
  );
}
