import React from 'react';

/**
 * Lightweight skeleton placeholder for route-level code splitting.
 * Renders pulsing gray boxes mimicking a typical page layout.
 * Must render within 50ms — no heavy dependencies, pure CSS animation.
 */
export default function PageSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4 p-4"
      aria-hidden="true"
    >
      {/* Header skeleton */}
      <div className="h-8 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />

      {/* Content skeleton rows */}
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-4/6 rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Card-like block skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Table-like skeleton */}
      <div className="space-y-2">
        <div className="h-10 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 w-full rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-8 w-full rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-8 w-full rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}
