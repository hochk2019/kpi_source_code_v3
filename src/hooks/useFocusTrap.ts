import { useCallback, useEffect, useRef } from 'react';

import { getFocusableElements } from '@/lib/focusManagement';

export interface UseFocusTrapOptions {
  /** When true, the trap is active: focus is moved in and contained. */
  active: boolean;
  /** Invoked when the Escape key is pressed while the trap is active. */
  onEscape?: () => void;
  /**
   * When true (default), focus is restored to the element that was focused
   * before the trap activated, once it deactivates.
   */
  restoreFocus?: boolean;
  /**
   * When true (default), focus moves to the first focusable element (or the
   * container itself) when the trap activates.
   */
  autoFocus?: boolean;
}

/**
 * Traps keyboard focus within a container while `active` is true, implementing
 * the ARIA modal dialog focus pattern required for WCAG 2.1 AA focus
 * management (Requirement 5.5):
 *
 *  - On activation, focus moves into the container (first focusable element, or
 *    the container itself if it has none).
 *  - Tab / Shift+Tab wrap around the first and last focusable elements so focus
 *    never escapes to background content behind a modal.
 *  - Escape invokes `onEscape` (typically to close the dialog).
 *  - On deactivation, focus is restored to the previously focused element.
 *
 * Attach the returned ref to the element that should contain focus.
 *
 * NOTE: This covers programmatic focus containment. Verifying the full
 * keyboard-only experience still requires manual testing with assistive
 * technologies.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>({
  active,
  onEscape,
  restoreFocus = true,
  autoFocus = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onEscape) {
          event.stopPropagation();
          onEscape();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const focusable = getFocusableElements(container);

      // No focusable children: keep focus on the container itself.
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        // Shift+Tab on the first element wraps to the last.
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last || !container.contains(activeElement)) {
        // Tab on the last element wraps to the first.
        event.preventDefault();
        first.focus();
      }
    },
    [onEscape],
  );

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    if (typeof document === 'undefined') {
      return undefined;
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (autoFocus && container) {
      const focusable = getFocusableElements(container);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        if (!container.hasAttribute('tabindex')) {
          container.setAttribute('tabindex', '-1');
        }
        container.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);

      if (restoreFocus) {
        const previous = previouslyFocusedRef.current;
        if (previous && typeof previous.focus === 'function' && previous.isConnected) {
          previous.focus();
        }
      }
    };
  }, [active, autoFocus, handleKeyDown, restoreFocus]);

  return containerRef;
}

export default useFocusTrap;
