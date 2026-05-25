import { COMMAND_CENTER_GROUP_TITLES } from '@/components/command-center/commandCenterCommands.js';

const RECENT_COMMAND_LIMIT = 5;

function toTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareByLabel(left, right) {
  return left.label.localeCompare(right.label, 'vi');
}

function compareRecent(left, right) {
  const lastUsedDelta = toTimestamp(right.usageInfo?.lastUsedAt) - toTimestamp(left.usageInfo?.lastUsedAt);
  if (lastUsedDelta !== 0) {
    return lastUsedDelta;
  }

  const usageDelta = (right.usageInfo?.count || 0) - (left.usageInfo?.count || 0);
  if (usageDelta !== 0) {
    return usageDelta;
  }

  return compareByLabel(left, right);
}

function createHeader(group) {
  return {
    type: 'header',
    id: `header:${group}`,
    title: COMMAND_CENTER_GROUP_TITLES[group] || 'Khác',
  };
}

function createCommandEntry(command) {
  return {
    type: 'command',
    command,
  };
}

function createSectionEntries(group, commands) {
  if (!commands.length) {
    return [];
  }

  return [createHeader(group), ...commands.map((command) => createCommandEntry(command))];
}

function groupCommandsByDomain(commands) {
  const groupMap = new Map();

  for (const command of commands) {
    const group = command.group || 'khac';
    if (!groupMap.has(group)) {
      groupMap.set(group, []);
    }
    groupMap.get(group).push(command);
  }

  const entries = [];
  for (const [group, groupedCommands] of groupMap.entries()) {
    entries.push(...createSectionEntries(group, groupedCommands.sort(compareByLabel)));
  }

  return entries;
}

function decorateCommands(commands, pinnedIds, usage, query) {
  const normalizedQuery = query.trim().toLowerCase();

  return commands
    .filter((command) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [command.label, command.description, ...(command.keywords || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .map((command) => ({
      ...command,
      isPinned: pinnedIds.includes(command.id),
      usageInfo: usage?.[command.id] || { count: 0, lastUsedAt: null },
    }));
}

export function formatCommandEntries(commands, pinnedIds = [], usage = {}, query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  const decorated = decorateCommands(commands, pinnedIds, usage, query);

  if (normalizedQuery) {
    return groupCommandsByDomain(decorated);
  }

  const pinned = decorated.filter((command) => command.isPinned).sort(compareRecent);
  const pinnedIdsSet = new Set(pinned.map((command) => command.id));

  const recent = decorated
    .filter((command) => !pinnedIdsSet.has(command.id) && (command.usageInfo?.count || 0) > 0)
    .sort(compareRecent)
    .slice(0, RECENT_COMMAND_LIMIT);
  const recentIdsSet = new Set(recent.map((command) => command.id));

  const remaining = decorated.filter(
    (command) => !pinnedIdsSet.has(command.id) && !recentIdsSet.has(command.id),
  );

  return [
    ...createSectionEntries('pinned', pinned),
    ...createSectionEntries('recent', recent),
    ...groupCommandsByDomain(remaining),
  ];
}

export function getCommandCenterEmptySuggestions(commands, pinnedIds = [], usage = {}, limit = 3) {
  const decorated = decorateCommands(commands, pinnedIds, usage, '');
  const pinned = decorated.filter((command) => command.isPinned).sort(compareRecent);
  const recent = decorated
    .filter((command) => !command.isPinned && (command.usageInfo?.count || 0) > 0)
    .sort(compareRecent);
  const fallback = decorated
    .filter((command) => !command.isPinned && !(command.usageInfo?.count || 0))
    .sort(compareByLabel);

  return [...pinned, ...recent, ...fallback].slice(0, limit);
}
