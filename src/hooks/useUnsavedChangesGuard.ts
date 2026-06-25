/**
 * useUnsavedChangesGuard — intercepts navigation when a form has unsaved
 * changes and asks the user to confirm before discarding them.
 *
 * The KPI app navigates between Page_Modules via an internal tab value
 * (see useKpiShellState) rather than react-router routes, so this hook does
 * not bind to a router. Instead it exposes `guardNavigation(navigate)` which
 * callers wrap around their navigation action (e.g. handleTabChange). When the
 * form is dirty, a confirmation dialog (built on the AppDialog `confirm()`
 * primitive) is shown; navigation proceeds only if the user confirms.
 *
 * It also guards full-page exits (refresh / tab close) via the browser
 * `beforeunload` event while the form is dirty.
 *
 * Dirty detection compares current field values against the initial state
 * (Property 6 / Requirement 5.1). The comparison helpers are pure and exported
 * so they can be exercised directly by property tests.
 *
 * Requirement 5.1: WHEN a form contains unsaved changes and the user attempts
 * to navigate away, THE KPI_App SHALL display a confirmation dialog warning of
 * potential data loss.
 *
 * @example
 * const guard = useUnsavedChangesGuard({ initialValues: saved, currentValues: form });
 * const onTabChange = (tab: string) => guard.guardNavigation(() => handleTabChange(tab));
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppDialog } from '@/hooks/useAppDialog';
import { t } from '@/lib/i18n.js';

// ─── Pure Dirty-Detection Helpers ──────────────────────────────────────────

/**
 * Structural deep-equality used for comparing form field values. Handles
 * primitives, arrays, plain objects, Date, and NaN. Returns true when the two
 * values are equivalent.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  // NaN is handled by Object.is above; from here both must be the same kind.
  if (typeof a !== typeof b) {
    return false;
  }

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) {
    return false;
  }

  if (aIsArray && bIsArray) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => valuesEqual(item, b[index]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(bObj, key) && valuesEqual(aObj[key], bObj[key]),
  );
}

/**
 * Returns true when `current` differs from `initial` in any field — i.e. the
 * form is "dirty". When every field equals its initial value, returns false.
 *
 * Property 6: changed field → dirty=true; all fields equal initial → dirty=false.
 *
 * @param initial Snapshot of the form's clean (saved) state.
 * @param current The current form field values.
 * @param isEqual Optional custom equality comparator (defaults to deep-equal).
 */
export function isFormDirty<T>(
  initial: T,
  current: T,
  isEqual: (a: unknown, b: unknown) => boolean = valuesEqual,
): boolean {
  return !isEqual(initial, current);
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export interface UseUnsavedChangesGuardOptions<T> {
  /** Snapshot of the form's clean (saved) state. Used for dirty detection. */
  initialValues?: T;
  /** Current form field values. Compared against `initialValues`. */
  currentValues?: T;
  /**
   * Explicit dirty flag. When provided, it overrides value comparison — useful
   * when the consumer already tracks dirtiness (e.g. react-hook-form's
   * `formState.isDirty`).
   */
  dirty?: boolean;
  /** Custom equality comparator for value-based dirty detection. */
  isEqual?: (a: unknown, b: unknown) => boolean;
  /** Override the confirmation dialog message. */
  message?: string;
  /** Override the confirmation dialog title. */
  title?: string;
  /** Override the confirm button label. */
  confirmLabel?: string;
  /** Guard full-page exits (refresh / tab close) while dirty. Default: true. */
  guardBrowserUnload?: boolean;
}

export interface UseUnsavedChangesGuardReturn {
  /** Whether the form currently has unsaved changes. */
  isDirty: boolean;
  /**
   * Ask the user to confirm discarding unsaved changes. Resolves true when the
   * form is clean (no prompt needed) or the user confirms; false otherwise.
   */
  confirmNavigation: () => Promise<boolean>;
  /**
   * Wrap a navigation action. If the form is dirty, shows the confirmation
   * dialog and only runs `navigate` when the user confirms. Resolves true when
   * navigation proceeded, false when it was cancelled.
   */
  guardNavigation: (navigate: () => void | Promise<void>) => Promise<boolean>;
}

export function useUnsavedChangesGuard<T = unknown>(
  options: UseUnsavedChangesGuardOptions<T> = {},
): UseUnsavedChangesGuardReturn {
  const { confirm } = useAppDialog();
  const { guardBrowserUnload = true, isEqual } = options;

  const isDirty = useMemo(() => {
    if (typeof options.dirty === 'boolean') {
      return options.dirty;
    }
    if (options.initialValues === undefined && options.currentValues === undefined) {
      return false;
    }
    return isFormDirty(options.initialValues as T, options.currentValues as T, isEqual);
  }, [options.dirty, options.initialValues, options.currentValues, isEqual]);

  // Mirror dirtiness into a ref so the beforeunload listener (registered once)
  // always reads the latest value without re-subscribing on every change.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (!guardBrowserUnload || typeof window === 'undefined') {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) {
        return undefined;
      }
      // Triggering the native confirmation requires preventDefault + returnValue.
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [guardBrowserUnload]);

  const confirmNavigation = useCallback(async (): Promise<boolean> => {
    if (!isDirtyRef.current) {
      return true;
    }
    return confirm(options.message ?? t('unsaved.message'), {
      title: options.title ?? t('unsaved.title'),
      confirmLabel: options.confirmLabel ?? t('unsaved.confirm'),
      variant: 'destructive',
    });
  }, [confirm, options.message, options.title, options.confirmLabel]);

  const guardNavigation = useCallback(
    async (navigate: () => void | Promise<void>): Promise<boolean> => {
      const proceed = await confirmNavigation();
      if (proceed) {
        await navigate();
      }
      return proceed;
    },
    [confirmNavigation],
  );

  return { isDirty, confirmNavigation, guardNavigation };
}

export default useUnsavedChangesGuard;
