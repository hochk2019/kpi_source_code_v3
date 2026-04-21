import React from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import AppShellWorkflowGuide from '@/components/appShell/AppShellWorkflowGuide.jsx';

import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { Info } from 'lucide-react';

function getInitialExpandedSectionId(sections, currentSectionId) {
  return currentSectionId || sections[0]?.id || null;
}

function useCompactShellLayout(query = '(max-width: 1023px)') {
  const getMatches = React.useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(query).matches;
  }, [query]);

  const [matches, setMatches] = React.useState(getMatches);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [getMatches, query]);

  return matches;
}

export default function AppShellFrame({
  sections,
  value,
  onValueChange,
  currentTab,
  currentSection,
  currentUser,
  workflowGuide,
  onOpenCommandCenter,
  children,
}) {
  const username = currentUser?.username || 'guest';
  const role = currentUser?.role || 'viewer';
  const currentSectionId = currentSection?.id || null;
  const currentTabLabel = currentTab?.label || 'Bảng điều hành KPI';
  const currentTabDescription =
    currentTab?.commandDescription || currentTab?.tooltip || 'Chọn một module để bắt đầu thao tác.';
  const totalTabs = React.useMemo(
    () => sections.reduce((count, section) => count + section.tabs.length, 0),
    [sections],
  );
  const compactSummary = `${totalTabs} module`;
  const isCompactLayout = useCompactShellLayout();
  const navPanelIdPrefix = React.useId();
  const [expandedSectionId, setExpandedSectionId] = React.useState(() =>
    getInitialExpandedSectionId(sections, currentSectionId),
  );

  React.useEffect(() => {
    if (!sections.length) {
      setExpandedSectionId(null);
      return;
    }

    const hasExpandedSection = sections.some((section) => section.id === expandedSectionId);
    if (!hasExpandedSection) {
      setExpandedSectionId(getInitialExpandedSectionId(sections, currentSectionId));
    }
  }, [currentSectionId, expandedSectionId, sections]);

  React.useEffect(() => {
    if (!isCompactLayout || !currentSectionId) {
      return;
    }

    setExpandedSectionId(currentSectionId);
  }, [currentSectionId, isCompactLayout]);

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className="ds-app-shell"
      data-shell-layout={isCompactLayout ? 'compact' : 'full'}
    >
      <div
        className="ds-app-shell__layout"
        data-shell-layout={isCompactLayout ? 'compact' : 'full'}
      >
        <aside className="ds-app-shell__sidebar" aria-label="Điều hướng ứng dụng">
          <div className="ds-app-shell__brand flex items-center justify-between">
            <div className="flex flex-col">
              <p className="ds-app-shell__eyebrow">Hệ thống Điều hành</p>
              <h1 className="ds-app-shell__brand-title">KPI Command</h1>
            </div>
            <button
              className="text-gray-400 hover:text-blue-500 transition-colors"
              title="Điều hướng theo domain để giữ shell gọn, rõ ngữ cảnh và giảm thời gian tìm đúng workflow."
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          <div className="ds-app-shell__compact-status" aria-label="Tổng quan compact shell">
            <p className="ds-app-shell__compact-label">{currentSection?.label || 'Điều hướng'}</p>
            <div className="ds-app-shell__compact-title-row">
              <p className="ds-app-shell__compact-title">{currentTabLabel}</p>
              <span className="ds-app-shell__compact-count">{compactSummary}</span>
            </div>
            <p className="ds-app-shell__compact-caption">{currentTab?.tooltip || currentTabDescription}</p>
          </div>

          <div className="ds-app-shell__nav-groups">
            {sections.map((section) => {
              const panelId = `${navPanelIdPrefix}-${section.id}`;
              const isActiveSection = currentSectionId === section.id;
              const isExpanded = !isCompactLayout || expandedSectionId === section.id;
              const sectionSummary =
                isActiveSection && currentTab?.label
                  ? currentTab.label
                  : `${section.tabs.length} module`;

              return (
                <section
                  key={section.id}
                  className="ds-app-shell__nav-group"
                  data-active={isActiveSection ? 'true' : 'false'}
                  data-expanded={isExpanded ? 'true' : 'false'}
                >
                  <button
                    type="button"
                    className="ds-app-shell__group-toggle"
                    onClick={() => setExpandedSectionId(section.id)}
                    aria-controls={panelId}
                    aria-expanded={isCompactLayout ? isExpanded : undefined}
                    disabled={!isCompactLayout}
                  >
                    <span className="ds-app-shell__group-copy">
                      <span className="ds-app-shell__group-title">{section.label}</span>
                      <span className="ds-app-shell__group-description">{section.description}</span>
                    </span>
                    <span className="ds-app-shell__group-toggle-meta">{sectionSummary}</span>
                  </button>

                  <div id={panelId} hidden={isCompactLayout && !isExpanded}>
                    <TabsList
                      unstyled
                      orientation="vertical"
                      aria-label={section.label}
                      className="ds-app-shell__nav-list"
                    >
                      {section.tabs.map((tab) => (
                        <TabsTrigger
                          unstyled
                          key={tab.id}
                          value={tab.id}
                          className="ds-app-shell__nav-trigger"
                        >
                          <span className="ds-app-shell__nav-label">{tab.label}</span>
                          <span className="ds-app-shell__nav-caption">{tab.tooltip}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                </section>
              );
            })}
          </div>
        </aside>

        <div className="ds-app-shell__main">
          <header className="ds-app-shell__hero">
            <div className="ds-app-shell__hero-copy">
              <p className="ds-app-shell__eyebrow">{currentSection?.label || 'Điều hướng'}</p>
              <div className="ds-app-shell__hero-title-row flex items-center gap-2">
                <h2 className="ds-app-shell__hero-title">{currentTabLabel}</h2>
                <span className="ds-app-shell__role-pill ml-2">{role}</span>
                <button
                  className="text-gray-400 hover:text-blue-500 transition-colors ml-2"
                  title={currentTabDescription}
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="ds-app-shell__hero-meta" aria-label="Ngữ cảnh hiện tại">
              <span className="ds-app-shell__meta-pill">Người dùng {username}</span>
              {typeof onOpenCommandCenter === 'function' ? (
                <button
                  type="button"
                  onClick={onOpenCommandCenter}
                  className="ds-app-shell__command-button"
                >
                  Mở Command Center
                </button>
              ) : null}
            </div>
          </header>

          {workflowGuide ? <AppShellWorkflowGuide {...workflowGuide} /> : null}

          <div className="ds-app-shell__content">{children}</div>
        </div>
      </div>
    </Tabs>
  );
}
