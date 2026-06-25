/**
 * useDestructiveConfirm — convenience hook for requiring explicit confirmation
 * before executing destructive actions (delete / overwrite / reset).
 *
 * Builds on the existing AppDialog `confirm()` primitive, applying the
 * `destructive` variant and sensible per-action defaults (title + confirm
 * label) so callers only need to provide the action-specific message.
 *
 * Requirement 4.3: WHEN a user performs a destructive action (delete,
 * overwrite, reset), THE KPI_App SHALL require explicit confirmation via a
 * modal dialog before executing.
 *
 * @example
 * const { confirmDelete } = useDestructiveConfirm();
 * if (await confirmDelete('Tài khoản sẽ bị xóa vĩnh viễn.')) {
 *   await deleteAccount();
 * }
 */

import { useCallback, useMemo } from 'react';
import { useAppDialog } from '@/hooks/useAppDialog';
import { t } from '@/lib/i18n.js';

export type DestructiveActionKind = 'delete' | 'overwrite' | 'reset';

export interface DestructiveConfirmOptions {
  /** Override the dialog title. Defaults to a per-action title. */
  title?: string;
  /** Override the confirm button label. Defaults to a per-action label. */
  confirmLabel?: string;
}

/** Resolves the i18n-backed defaults for each destructive action kind. */
export function getDestructiveDefaults(kind: DestructiveActionKind): {
  title: string;
  confirmLabel: string;
} {
  switch (kind) {
    case 'delete':
      return {
        title: t('destructive.delete.title'),
        confirmLabel: t('destructive.delete.confirm'),
      };
    case 'overwrite':
      return {
        title: t('destructive.overwrite.title'),
        confirmLabel: t('destructive.overwrite.confirm'),
      };
    case 'reset':
      return {
        title: t('destructive.reset.title'),
        confirmLabel: t('destructive.reset.confirm'),
      };
    default: {
      // Exhaustiveness guard — unreachable for valid kinds.
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export interface UseDestructiveConfirmReturn {
  /** Generic destructive confirmation for any action kind. */
  confirmDestructive: (
    kind: DestructiveActionKind,
    message: string,
    options?: DestructiveConfirmOptions,
  ) => Promise<boolean>;
  /** Confirm a delete action. */
  confirmDelete: (message: string, options?: DestructiveConfirmOptions) => Promise<boolean>;
  /** Confirm an overwrite action. */
  confirmOverwrite: (message: string, options?: DestructiveConfirmOptions) => Promise<boolean>;
  /** Confirm a reset action. */
  confirmReset: (message: string, options?: DestructiveConfirmOptions) => Promise<boolean>;
}

export function useDestructiveConfirm(): UseDestructiveConfirmReturn {
  const { confirm } = useAppDialog();

  const confirmDestructive = useCallback(
    (kind: DestructiveActionKind, message: string, options?: DestructiveConfirmOptions) => {
      const defaults = getDestructiveDefaults(kind);
      return confirm(message, {
        title: options?.title ?? defaults.title,
        confirmLabel: options?.confirmLabel ?? defaults.confirmLabel,
        variant: 'destructive',
      });
    },
    [confirm],
  );

  const confirmDelete = useCallback(
    (message: string, options?: DestructiveConfirmOptions) =>
      confirmDestructive('delete', message, options),
    [confirmDestructive],
  );

  const confirmOverwrite = useCallback(
    (message: string, options?: DestructiveConfirmOptions) =>
      confirmDestructive('overwrite', message, options),
    [confirmDestructive],
  );

  const confirmReset = useCallback(
    (message: string, options?: DestructiveConfirmOptions) =>
      confirmDestructive('reset', message, options),
    [confirmDestructive],
  );

  return useMemo(
    () => ({ confirmDestructive, confirmDelete, confirmOverwrite, confirmReset }),
    [confirmDestructive, confirmDelete, confirmOverwrite, confirmReset],
  );
}

export default useDestructiveConfirm;
