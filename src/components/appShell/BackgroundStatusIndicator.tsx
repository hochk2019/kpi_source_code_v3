import React from 'react';
import {
  Loader2,
  RefreshCw,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n.js';
import { useBackgroundOperations } from '@/hooks/useBackgroundOperations';
import type {
  BackgroundOperation,
  BackgroundOperationKind,
  BackgroundOperationsStore,
} from '@/lib/backgroundOperationsStore';

// ─── Helpers ───────────────────────────────────────────────────────────────

const KIND_ICON: Record<BackgroundOperationKind, typeof RefreshCw> = {
  sync: RefreshCw,
  import: Upload,
  export: Download,
};

function KindIcon({ kind, className }: { kind: BackgroundOperationKind; className?: string }) {
  const Icon = KIND_ICON[kind] ?? RefreshCw;
  return <Icon className={className} aria-hidden="true" />;
}

function OperationRow({ operation }: { operation: BackgroundOperation }) {
  const { status, label, kind } = operation;
  return (
    <li className="flex items-center gap-2 text-sm text-ds-text-primary">
      {status === 'running' && (
        <Loader2 className="w-4 h-4 shrink-0 animate-spin text-ds-accent" aria-hidden="true" />
      )}
      {status === 'success' && (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-ds-success" aria-hidden="true" />
      )}
      {status === 'error' && (
        <AlertCircle className="w-4 h-4 shrink-0 text-ds-destructive" aria-hidden="true" />
      )}
      <KindIcon kind={kind} className="w-3.5 h-3.5 shrink-0 text-ds-text-muted" />
      <span className="truncate">{label}</span>
      {typeof operation.progress === 'number' && status === 'running' && (
        <span className="ml-auto tabular-nums text-ds-text-muted">
          {Math.round(operation.progress * 100)}%
        </span>
      )}
    </li>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export interface BackgroundStatusIndicatorProps {
  /** Injectable store (primarily for testing). Defaults to the shared store. */
  store?: BackgroundOperationsStore;
  /** Additional className for the root container. */
  className?: string;
}

/**
 * Persistent, non-blocking status indicator rendered inside the application
 * shell. It surfaces in-progress background operations (sync, import, export)
 * as a fixed pill in the bottom-right corner. Renders nothing when there are
 * no active operations, so it never blocks the UI.
 *
 * Requirement 4.5.
 */
export function BackgroundStatusIndicator({ store, className }: BackgroundStatusIndicatorProps) {
  const { running } = useBackgroundOperations(store);

  if (running.length === 0) {
    return null;
  }

  const count = running.length;
  const summary =
    count === 1
      ? running[0].label
      : t('shell.background.activeCount', { count });

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('shell.background.ariaLabel')}
      className={cn(
        'ds-app-shell__bg-status fixed bottom-4 right-4 z-50 max-w-xs',
        'rounded-xl border border-ds-border-subtle bg-ds-surface-card shadow-ds-soft',
        'px-4 py-3',
        className,
      )}
      data-operation-count={count}
    >
      <div className="flex items-center gap-2 mb-1">
        <Loader2 className="w-4 h-4 shrink-0 animate-spin text-ds-accent" aria-hidden="true" />
        <span className="text-sm font-medium text-ds-text-primary truncate">{summary}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {running.map((operation) => (
          <OperationRow key={operation.id} operation={operation} />
        ))}
      </ul>
    </div>
  );
}

export default BackgroundStatusIndicator;
