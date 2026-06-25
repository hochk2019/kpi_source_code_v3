import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type BreadcrumbsProps } from "./Breadcrumbs";

export interface PageLayoutProps {
  /** Page title shown in the header */
  title: string;
  /** Optional action buttons rendered in the header (right side) */
  actions?: ReactNode;
  /** Optional sidebar content rendered beside the main content area */
  sidebar?: ReactNode;
  /** Main content area */
  children: ReactNode;
  /** Additional className for the root container */
  className?: string;
  /** Whether to show breadcrumb navigation (default: true) */
  showBreadcrumbs?: boolean;
  /** Custom route labels for breadcrumb display */
  breadcrumbLabels?: BreadcrumbsProps["routeLabels"];
  /** Override the route path used for breadcrumbs */
  breadcrumbPath?: string;
}

/**
 * Unified page layout wrapper applied across all 13 Page_Modules.
 * Provides a consistent structure: page header (title + actions), content area, optional sidebar.
 *
 * @example
 * <PageLayout title="Dashboard" actions={<Button>Export</Button>}>
 *   <MainContent />
 * </PageLayout>
 *
 * @example with sidebar
 * <PageLayout title="Reports" sidebar={<FilterPanel />}>
 *   <ReportList />
 * </PageLayout>
 */
export function PageLayout({
  title,
  actions,
  sidebar,
  children,
  className,
  showBreadcrumbs = true,
  breadcrumbLabels,
  breadcrumbPath,
}: PageLayoutProps) {
  return (
    <div className={cn("page-layout flex flex-col h-full", className)}>
      {/* Page Header */}
      <header className="page-layout__header flex flex-col px-6 py-4 border-b border-ds-border-subtle shrink-0">
        {showBreadcrumbs && breadcrumbPath != null && (
          <Breadcrumbs
            routePath={breadcrumbPath}
            routeLabels={breadcrumbLabels}
            className="mb-2"
          />
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ds-text-primary sm:text-xl truncate">
            {title}
          </h1>
          {actions ? (
            <div className="page-layout__actions flex items-center gap-2 shrink-0">
              {actions}
            </div>
          ) : null}
        </div>
      </header>

      {/* Content Area (with optional sidebar) */}
      <div className="page-layout__body flex flex-1 min-h-0">
        {sidebar ? (
          <aside className="page-layout__sidebar w-64 shrink-0 border-r border-ds-border-subtle overflow-y-auto p-4">
            {sidebar}
          </aside>
        ) : null}
        <main className="page-layout__content flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default PageLayout;
