/**
 * useFormFeedback — toast notifications for form save / submit outcomes, built
 * on the shared sonner-backed toast wrapper (`@/shared/toast`).
 *
 * Covers:
 * - Requirement 5.3: WHEN a save or submit operation succeeds, THE KPI_App
 *   SHALL display a toast notification confirming success within 500ms.
 * - Requirement 5.4: IF a save or submit operation fails, THEN THE KPI_App
 *   SHALL display an error toast with a retry action and preserve all form
 *   input values.
 *
 * The `submit` helper never mutates or clears the caller's form values — it
 * returns the original values untouched on failure so the form retains user
 * input (Requirement 5.4 value preservation).
 */

import { useCallback, useMemo } from 'react';
import { toast } from '@/shared/toast';

const DEFAULT_SUCCESS_MESSAGE = 'Đã lưu thành công.';
const DEFAULT_ERROR_MESSAGE = 'Lưu thất bại, vui lòng thử lại.';
const DEFAULT_RETRY_LABEL = 'Thử lại';

export interface NotifyErrorOptions {
  /** Optional retry handler — rendered as an action button on the error toast. */
  onRetry?: () => void;
  /** Override the retry action label. */
  retryLabel?: string;
  /** Optional secondary description line. */
  description?: string;
}

export interface SubmitOptions {
  /** Success toast message. Defaults to a generic save-success message. */
  successMessage?: string;
  /** Error toast message. Defaults to a generic save-failure message. */
  errorMessage?: string;
  /** Retry action label on the error toast. */
  retryLabel?: string;
}

export type SubmitResult<T, V> =
  | { ok: true; data: T }
  /** On failure the original `values` are returned unchanged for preservation. */
  | { ok: false; error: unknown; values: V };

export interface UseFormFeedbackReturn {
  /** Show a success toast (Requirement 5.3). */
  notifySuccess: (message?: string, description?: string) => void;
  /** Show an error toast with an optional retry action (Requirement 5.4). */
  notifyError: (message?: string, options?: NotifyErrorOptions) => void;
  /**
   * Run an async save/submit action with automatic toast feedback.
   * On success shows a success toast; on failure shows an error toast whose
   * retry action re-runs the same action, and returns the untouched `values`.
   */
  submit: <T, V>(
    action: () => Promise<T>,
    values: V,
    options?: SubmitOptions,
  ) => Promise<SubmitResult<T, V>>;
}

export function useFormFeedback(): UseFormFeedbackReturn {
  const notifySuccess = useCallback((message?: string, description?: string) => {
    toast.success(message ?? DEFAULT_SUCCESS_MESSAGE, description ? { description } : undefined);
  }, []);

  const notifyError = useCallback((message?: string, options: NotifyErrorOptions = {}) => {
    const { onRetry, retryLabel, description } = options;
    const toastOptions: Record<string, unknown> = {};
    if (description) toastOptions.description = description;
    if (onRetry) {
      toastOptions.action = {
        label: retryLabel ?? DEFAULT_RETRY_LABEL,
        onClick: onRetry,
      };
    }
    toast.error(message ?? DEFAULT_ERROR_MESSAGE, toastOptions);
  }, []);

  const submit = useCallback(
    async <T, V>(
      action: () => Promise<T>,
      values: V,
      options: SubmitOptions = {},
    ): Promise<SubmitResult<T, V>> => {
      try {
        const data = await action();
        notifySuccess(options.successMessage);
        return { ok: true, data };
      } catch (error) {
        // Preserve form values: never touch `values`, just surface a retry.
        notifyError(options.errorMessage, {
          retryLabel: options.retryLabel,
          onRetry: () => {
            void submit(action, values, options);
          },
        });
        return { ok: false, error, values };
      }
    },
    [notifySuccess, notifyError],
  );

  return useMemo(
    () => ({ notifySuccess, notifyError, submit }),
    [notifySuccess, notifyError, submit],
  );
}

export default useFormFeedback;
