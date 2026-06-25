import React from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RuntimeErrorBoundary from '@/components/errorBoundaries/RuntimeErrorBoundary.jsx';
import { PageHeader } from '@/components/designSystem/PageHeader';
import { BackgroundStatusIndicator } from '@/components/appShell/BackgroundStatusIndicator';

import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { t } from '@/lib/i18n.js';
import type { NavSection, TabDefinition } from '@/lib/appShellNavigation.ts';
import type { AuthAccountView } from '@/types/index.js';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AppShellFrameProps {
  sections: NavSection[];
  value: string;
  onValueChange: (value: string) => void;
  currentTab: TabDefinition | null;
  currentSection: NavSection | null;
  currentUser: AuthAccountView | null | undefined;
  onOpenCommandCenter?: () => void;
  children: React.ReactNode;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getInitialExpandedSectionId(sections: NavSection[], currentSectionId: string | null): string | null {
  return currentSectionId || sections[0]?.id || null;
}

function useCompactShellLayout(query = '(max-width: 1023px)'): boolean {
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
    const handleChange = (event: MediaQueryListEvent) => {
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
  onOpenCommandCenter,
  children,
}: AppShellFrameProps) {
  const username = currentUser?.username || 'guest';
  const role = currentUser?.role || 'viewer';
  const currentSectionId = currentSection?.id || null;
  const currentTabLabel = currentTab?.label || t('shell.defaultTabLabel');
  const currentTabDescription =
    currentTab?.commandDescription || currentTab?.tooltip || t('shell.defaultDescription');
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
        <aside className="ds-app-shell__sidebar" aria-label={t('shell.nav.ariaLabel')}>
          <div className="ds-app-shell__brand flex items-center justify-between">
            <div className="flex flex-col">
              <p className="ds-app-shell__eyebrow">{t('shell.brand.eyebrow')}</p>
              <h1 className="ds-app-shell__brand-title">KPI Command</h1>
            </div>
            <button
              className="text-ds-text-muted hover:text-ds-accent transition-colors"
              title={t('shell.brand.infoTooltip')}
            >
              <Info className="w-5 h-5" />
            </button>
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
                    </span>
                    <span className="ds-app-shell__group-toggle-meta">{sectionSummary}</span>
                  </button>

                  <div id={panelId} hidden={isCompactLayout && !isExpanded}>
                    <TabsList
                      unstyled
                      aria-label={section.label}
                      className="ds-app-shell__nav-list"
                    >
                      {section.tabs.map((tab) => (
                        <Tooltip key={tab.id} delayDuration={300}>
                          <TooltipTrigger asChild>
                            <TabsTrigger
                              unstyled
                              value={tab.id}
                              className="ds-app-shell__nav-trigger"
                            >
                              <span className="ds-app-shell__nav-label">{tab.label}</span>
                            </TabsTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="right">{tab.tooltip}</TooltipContent>
                        </Tooltip>
                      ))}
                    </TabsList>
                  </div>
                </section>
              );
            })}
          </div>
        </aside>

        <div className="ds-app-shell__main">
          <PageHeader
            eyebrow={currentSection?.label || t('shell.compact.defaultSection')}
            title={currentTabLabel}
            info={currentTabDescription}
            meta={[
              <span key="user" className="ds-app-shell__meta-pill">{t('shell.hero.userLabel', { username })}</span>,
              <span key="role" className="ds-app-shell__role-pill">{role}</span>,
            ]}
            actions={typeof onOpenCommandCenter === 'function' ? (
              <button
                type="button"
                onClick={onOpenCommandCenter}
                className="ds-app-shell__command-search"
                aria-label={t('shell.hero.commandCenterAriaLabel')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span className="ds-app-shell__command-search-label">{t('shell.hero.searchPlaceholder')}</span>
                <kbd className="ds-app-shell__command-search-kbd">Ctrl K</kbd>
              </button>
            ) : null}
          />

          <div className="ds-app-shell__content">
            <RuntimeErrorBoundary
              level="panel"
              title={t('shell.error.title')}
              description={t('shell.error.description')}
              resetKeys={[value]}
            >
              {children}
            </RuntimeErrorBoundary>
          </div>
        </div>
      </div>

      {/* Persistent, non-blocking background operation indicator (Req 4.5) */}
      <BackgroundStatusIndicator />
    </Tabs>
  );
}
