import React from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import AppShellWorkflowGuide from '@/components/appShell/AppShellWorkflowGuide.jsx';

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

  return (
    <Tabs value={value} onValueChange={onValueChange} className="ds-app-shell">
      <div className="ds-app-shell__layout">
        <aside className="ds-app-shell__sidebar" aria-label="Dieu huong ung dung">
          <div className="ds-app-shell__brand">
            <p className="ds-app-shell__eyebrow">Operator shell</p>
            <h1 className="ds-app-shell__brand-title">KPI Control Center</h1>
            <p className="ds-app-shell__brand-copy">
              Dieu huong theo domain de giam fan-out thao tac va giu command surfaces nhat quan.
            </p>
          </div>

          <div className="ds-app-shell__nav-groups">
            {sections.map((section) => (
              <section key={section.id} className="ds-app-shell__nav-group">
                <div className="ds-app-shell__group-copy">
                  <p className="ds-app-shell__group-title">{section.label}</p>
                  <p className="ds-app-shell__group-description">{section.description}</p>
                </div>
                <TabsList
                  orientation="vertical"
                  aria-label={section.label}
                  className="ds-app-shell__nav-list"
                >
                  {section.tabs.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id} className="ds-app-shell__nav-trigger">
                      <span className="ds-app-shell__nav-label">{tab.label}</span>
                      <span className="ds-app-shell__nav-caption">{tab.tooltip}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </section>
            ))}
          </div>
        </aside>

        <div className="ds-app-shell__main">
          <header className="ds-app-shell__hero">
            <div className="ds-app-shell__hero-copy">
              <p className="ds-app-shell__eyebrow">{currentSection?.label || 'Dieu huong'}</p>
              <div className="ds-app-shell__hero-title-row">
                <h2 className="ds-app-shell__hero-title">{currentTab?.label || 'KPI Control Center'}</h2>
                <span className="ds-app-shell__role-pill">{role}</span>
              </div>
              <p className="ds-app-shell__hero-description">
                {currentTab?.commandDescription || currentTab?.tooltip || 'Chon mot module de bat dau thao tac.'}
              </p>
            </div>

            <div className="ds-app-shell__hero-meta" aria-label="Ngu canh hien tai">
              <span className="ds-app-shell__meta-pill">Nguoi dung {username}</span>
              <span className="ds-app-shell__meta-pill">Workflow {currentTab?.label || 'Tong quan'}</span>
              {typeof onOpenCommandCenter === 'function' ? (
                <button
                  type="button"
                  onClick={onOpenCommandCenter}
                  className="ds-app-shell__command-button"
                >
                  Command Center
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
