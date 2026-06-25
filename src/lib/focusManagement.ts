/**
 * Reusable focus-management utilities for keyboard-only navigation and
 * WCAG 2.1 AA focus management (Requirement 5.5).
 *
 * These helpers are intentionally framework-agnostic and side-effect free so
 * they can be unit-tested in isolation and reused by hooks/components that
 * need to manage focus (modals, drawers, popovers, roving tabindex widgets).
 *
 * NOTE: Full WCAG 2.1 AA conformance also requires manual verification with
 * assistive technologies (screen readers) and keyboard-only walkthroughs.
 * These utilities cover programmatic focus order/containment only.
 */

/**
 * CSS selector matching elements that are natively focusable or made focusable
 * via a non-negative tabindex. Elements with `tabindex="-1"` are intentionally
 * excluded because they are programmatically focusable but not part of the
 * sequential Tab order.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Returns true when an element is visible and therefore eligible to receive
 * keyboard focus. Hidden elements (display:none, visibility:hidden, the
 * `hidden` attribute, or zero layout box) are skipped so the Tab order matches
 * what a sighted keyboard user actually traverses.
 */
export function isFocusable(element: Element | null): element is HTMLElement {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  if (element.hidden) {
    return false;
  }

  const tabIndexAttr = element.getAttribute('tabindex');
  if (tabIndexAttr != null && Number(tabIndexAttr) < 0) {
    return false;
  }

  // jsdom does not implement layout, so `offsetParent`/getClientRects are not
  // reliable there. Guard so the utility behaves predictably in both browser
  // and test environments.
  if (typeof element.getClientRects === 'function') {
    const hasLayoutBoxes = element.getClientRects().length > 0;
    const isDetached = !element.isConnected;
    if (!hasLayoutBoxes && !isDetached && typeof window !== 'undefined') {
      const style = window.getComputedStyle?.(element);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Collects all keyboard-focusable descendants of `container` in DOM (Tab)
 * order. Returns an empty array when the container is null/undefined.
 */
export function getFocusableElements(container: HTMLElement | null | undefined): HTMLElement[] {
  if (!container) {
    return [];
  }

  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );

  return candidates.filter((element) => isFocusable(element));
}

/**
 * Returns the first and last focusable elements within a container, used to
 * implement Tab/Shift+Tab wrap-around for focus traps. Both are null when the
 * container has no focusable descendants.
 */
export function getFocusBoundary(container: HTMLElement | null | undefined): {
  first: HTMLElement | null;
  last: HTMLElement | null;
} {
  const elements = getFocusableElements(container);
  return {
    first: elements[0] ?? null,
    last: elements[elements.length - 1] ?? null,
  };
}

/**
 * Computes the next index for a roving-tabindex widget given an arrow-key
 * direction. Wraps around the ends so keyboard users can cycle continuously.
 *
 * @param currentIndex active item index (clamped into range)
 * @param length       total number of items (>= 0)
 * @param direction    +1 to move forward, -1 to move backward
 */
export function getRovingTabIndex(
  currentIndex: number,
  length: number,
  direction: 1 | -1,
): number {
  if (length <= 0) {
    return -1;
  }

  const safeIndex = Number.isFinite(currentIndex)
    ? ((Math.trunc(currentIndex) % length) + length) % length
    : 0;

  return (safeIndex + direction + length) % length;
}
