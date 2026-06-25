import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BreadcrumbSegment {
  /** Display label for this segment */
  label: string;
  /** Route path for this segment */
  path: string;
}

export interface BreadcrumbsProps {
  /** Override the current route path (defaults to useLocation().pathname) */
  routePath?: string;
  /** Custom labels map: path segment → display label (e.g. { "data-import": "Data Import" }) */
  routeLabels?: Record<string, string>;
  /** Additional className for the root nav element */
  className?: string;
}

// ─── Pure Logic ─────────────────────────────────────────────────────────────

/**
 * Convert a path segment to title case.
 * Handles kebab-case segments.
 *
 * @example
 * toTitleCase("data-import") → "Data Import"
 * toTitleCase("monthly") → "Monthly"
 */
export function toTitleCase(segment: string): string {
  return segment
    .split("-")
    .map((word) => (word.length === 0 ? "" : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/**
 * Generate breadcrumb segments from a route path.
 *
 * Properties:
 * - Always includes "Home" as the first breadcrumb (path: "/")
 * - Each segment's path is a prefix of the next
 * - Final segment's path equals the input route path
 * - Converts path segments to title case for labels
 * - Supports a routeLabels map for custom labels
 *
 * @example
 * generateBreadcrumbs("/reports/monthly")
 * // → [
 * //   { label: "Home", path: "/" },
 * //   { label: "Reports", path: "/reports" },
 * //   { label: "Monthly", path: "/reports/monthly" },
 * // ]
 */
export function generateBreadcrumbs(
  routePath: string,
  routeLabels?: Record<string, string>,
): BreadcrumbSegment[] {
  // Normalize: remove trailing slash (unless it's the root)
  const normalizedPath = routePath === "/" ? "/" : routePath.replace(/\/+$/, "");

  // Always start with Home
  const crumbs: BreadcrumbSegment[] = [{ label: "Home", path: "/" }];

  // If we're at root, just return Home
  if (normalizedPath === "/") {
    return crumbs;
  }

  // Split path into segments (filter out empty strings from leading slash)
  const segments = normalizedPath.split("/").filter(Boolean);

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = routeLabels?.[segment] ?? toTitleCase(segment);
    crumbs.push({ label, path: currentPath });
  }

  return crumbs;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Breadcrumb navigation component that generates breadcrumbs from the current route path.
 *
 * - If `routePath` is provided, renders breadcrumbs from that path (no Router context needed).
 * - If `routePath` is not provided, uses React Router's `useLocation()` (requires Router context).
 *
 * Integrates with the existing ui/breadcrumb primitives.
 */
export function Breadcrumbs({ routePath, routeLabels, className }: BreadcrumbsProps) {
  if (routePath) {
    return (
      <BreadcrumbsRenderer
        currentPath={routePath}
        routeLabels={routeLabels}
        className={className}
      />
    );
  }

  return (
    <BreadcrumbsWithLocation routeLabels={routeLabels} className={className} />
  );
}

/** Internal: Renders breadcrumbs using useLocation() — must be inside a Router */
function BreadcrumbsWithLocation({
  routeLabels,
  className,
}: Omit<BreadcrumbsProps, "routePath">) {
  const location = useLocation();
  return (
    <BreadcrumbsRenderer
      currentPath={location.pathname}
      routeLabels={routeLabels}
      className={className}
    />
  );
}

/** Internal: Pure rendering of breadcrumb items from a resolved path */
function BreadcrumbsRenderer({
  currentPath,
  routeLabels,
  className,
}: {
  currentPath: string;
  routeLabels?: Record<string, string>;
  className?: string;
}) {
  const crumbs = generateBreadcrumbs(currentPath, routeLabels);

  // Don't render breadcrumbs if we're at root (only "Home" would show)
  if (crumbs.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <React.Fragment key={crumb.path}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.path}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default Breadcrumbs;
