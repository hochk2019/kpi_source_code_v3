import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  APP_SHELL_FALLBACK_TAB,
  getVisibleAppNavigationSections,
  getVisibleAppTabIds,
  getVisibleAppTabs,
  resolveVisibleAppTab,
} from '@/lib/appShellNavigation';
import {
  APP_SHELL_WORKFLOW_TARGETS,
  getAppTabRootId,
  resolveAppShellFocusTarget,
} from '@/components/appShell/appShellWorkflowState.js';

function resolveTabRootFallbackTarget(targetId) {
  if (!targetId) {
    return null;
  }

  if (targetId.startsWith('app-tab-root-')) {
    return targetId;
  }

  const matchingTabId = Object.entries(APP_SHELL_WORKFLOW_TARGETS).find(([, targets]) =>
    Object.values(targets).includes(targetId),
  )?.[0];

  return matchingTabId ? getAppTabRootId(matchingTabId) : null;
}

function ensureLoadedTab(previousTabs, tabId) {
  if (previousTabs.has(tabId)) {
    return previousTabs;
  }

  return new Set([...previousTabs, tabId]);
}

export function useKpiShellState({
  activeTab = APP_SHELL_FALLBACK_TAB,
  currentUser,
  onTabChange,
  navigationIntent = null,
}) {
  const visibleTabs = useMemo(() => getVisibleAppTabs(currentUser), [currentUser]);
  const navigationSections = useMemo(
    () => getVisibleAppNavigationSections(currentUser),
    [currentUser],
  );
  const allowedTabs = useMemo(() => getVisibleAppTabIds(currentUser), [currentUser]);
  const initialTab = useMemo(
    () => resolveVisibleAppTab(activeTab, currentUser),
    [activeTab, currentUser],
  );

  const [tabValue, setTabValue] = useState(initialTab);
  const [loadedTabs, setLoadedTabs] = useState(() => new Set([initialTab]));
  const [pendingFocusTarget, setPendingFocusTarget] = useState(null);

  const markTabLoaded = useCallback((tabId) => {
    setLoadedTabs((previousTabs) => ensureLoadedTab(previousTabs, tabId));
  }, []);

  useEffect(() => {
    const nextTab = resolveVisibleAppTab(activeTab, currentUser);
    markTabLoaded(nextTab);
    setTabValue(nextTab);
  }, [activeTab, currentUser, markTabLoaded]);

  useEffect(() => {
    if (allowedTabs.has(tabValue)) {
      return;
    }

    const fallbackTab = resolveVisibleAppTab(tabValue, currentUser);
    markTabLoaded(fallbackTab);
    setTabValue(fallbackTab);

    if (fallbackTab !== tabValue) {
      onTabChange?.(fallbackTab);
    }
  }, [allowedTabs, currentUser, markTabLoaded, onTabChange, tabValue]);

  const handleTabChange = useCallback(
    (value) => {
      if (!allowedTabs.has(value)) {
        return;
      }

      setTabValue(value);
      markTabLoaded(value);
      onTabChange?.(value);
    },
    [allowedTabs, markTabLoaded, onTabChange],
  );

  useEffect(() => {
    const nextTarget = resolveAppShellFocusTarget(navigationIntent?.tab, navigationIntent?.focus);
    if (nextTarget) {
      setPendingFocusTarget(nextTarget);
    }
  }, [navigationIntent]);

  useEffect(() => {
    if (!pendingFocusTarget || typeof window === 'undefined') {
      return undefined;
    }

    let attempts = 0;
    let timeoutId = null;

    const scrollToTarget = () => {
      const target = document.getElementById(pendingFocusTarget);
      if (target) {
        if (typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
        setPendingFocusTarget(null);
        return;
      }

      const fallbackTargetId = resolveTabRootFallbackTarget(pendingFocusTarget);
      if (fallbackTargetId && fallbackTargetId !== pendingFocusTarget) {
        const fallbackTarget = document.getElementById(fallbackTargetId);
        if (fallbackTarget) {
          if (typeof fallbackTarget.scrollIntoView === 'function') {
            fallbackTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          if (typeof fallbackTarget.focus === 'function') {
            fallbackTarget.focus({ preventScroll: true });
          }
          setPendingFocusTarget(null);
          return;
        }
      }

      attempts += 1;
      if (attempts < 8) {
        timeoutId = window.setTimeout(scrollToTarget, 90);
      }
    };

    timeoutId = window.setTimeout(scrollToTarget, 60);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pendingFocusTarget, tabValue]);

  const requestTabNavigation = useCallback(
    (tabId, focus = null) => {
      const targetId = resolveAppShellFocusTarget(tabId, focus);
      if (targetId) {
        setPendingFocusTarget(targetId);
      }
      handleTabChange(tabId);
    },
    [handleTabChange],
  );

  const currentTab = useMemo(
    () => visibleTabs.find((tab) => tab.id === tabValue) || visibleTabs[0] || null,
    [tabValue, visibleTabs],
  );
  const currentSection = useMemo(
    () =>
      navigationSections.find((section) =>
        section.tabs.some((tab) => tab.id === currentTab?.id),
      ) ||
      navigationSections[0] ||
      null,
    [currentTab, navigationSections],
  );

  return {
    currentSection,
    currentTab,
    handleTabChange,
    loadedTabs,
    navigationSections,
    requestTabNavigation,
    tabValue,
    visibleTabs,
  };
}

export default useKpiShellState;
