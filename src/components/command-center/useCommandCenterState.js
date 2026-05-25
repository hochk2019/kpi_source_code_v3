import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { subscribeCommand } from '@/lib/commandBus.js';
import { buildCommandCenterCommands } from '@/components/command-center/commandCenterCommands.js';
import {
  formatCommandEntries,
  getCommandCenterEmptySuggestions,
} from '@/components/command-center/commandCenterResults.js';
import {
  loadCommandCenterUsage,
  registerCommandCenterUsage,
} from '@/components/command-center/commandCenterUsage.js';
import {
  readCommandCenterPins,
  subscribeToCommandCenterPins,
  writeCommandCenterPins,
} from '@/components/command-center/pinStorage.js';

export function useCommandCenterState({
  currentUser,
  onRequestLogin,
  onRequestLogout,
  onRequestChangePassword,
  setTheme,
  themePreference,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState(() => readCommandCenterPins());
  const [usage, setUsage] = useState(() => loadCommandCenterUsage());
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dialogId = useId();
  const dialogTitleId = useId();

  const commands = useMemo(
    () =>
      buildCommandCenterCommands({
        currentUser,
        onRequestLogin,
        onRequestLogout,
        onRequestChangePassword,
        setTheme,
        themePreference,
      }),
    [
      currentUser,
      onRequestChangePassword,
      onRequestLogin,
      onRequestLogout,
      setTheme,
      themePreference,
    ],
  );

  const entries = useMemo(
    () => formatCommandEntries(commands, pinned, usage, query),
    [commands, pinned, query, usage],
  );
  const visibleCommands = useMemo(
    () => entries.filter((entry) => entry.type === 'command'),
    [entries],
  );
  const emptySuggestions = useMemo(
    () => getCommandCenterEmptySuggestions(commands, pinned, usage),
    [commands, pinned, usage],
  );
  const activeCommand = visibleCommands[highlightedIndex]?.command || null;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHighlightedIndex(0);
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (highlightedIndex < visibleCommands.length) {
      return;
    }

    setHighlightedIndex(0);
  }, [highlightedIndex, visibleCommands.length]);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeCommand((id) => {
      if (id === 'open:command-center') {
        openDialog();
      }
    });

    return () => unsubscribe();
  }, [openDialog]);

  useEffect(() => {
    setPinned(readCommandCenterPins());
    const unsubscribe = subscribeToCommandCenterPins((nextPins) => {
      setPinned(nextPins);
    });

    return () => unsubscribe();
  }, []);

  const handleRunCommand = useCallback((command) => {
    if (!command || typeof command.run !== 'function') {
      return;
    }

    closeDialog();
    setUsage((previousUsage) => registerCommandCenterUsage(previousUsage, command.id));

    window.setTimeout(() => {
      try {
        command.run();
      } catch (error) {
        console.error('Không thể thực thi command', command.id, error);
      }
    }, 10);
  }, [closeDialog]);

  const togglePin = useCallback((commandId) => {
    setPinned((previousPins) => {
      const nextPins = previousPins.includes(commandId)
        ? previousPins.filter((item) => item !== commandId)
        : [...previousPins, commandId];
      return writeCommandCenterPins(nextPins);
    });
  }, []);

  const handleKeyNavigation = useCallback((event) => {
    if (!visibleCommands.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((previousIndex) => (previousIndex + 1) % visibleCommands.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex(
        (previousIndex) => (previousIndex - 1 + visibleCommands.length) % visibleCommands.length,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleRunCommand(activeCommand);
    }
  }, [activeCommand, handleRunCommand, visibleCommands.length]);

  const updateQuery = useCallback((nextQuery) => {
    setQuery(nextQuery);
    setHighlightedIndex(0);
  }, []);

  return {
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
  };
}

export default useCommandCenterState;
