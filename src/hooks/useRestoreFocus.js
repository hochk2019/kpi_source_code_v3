import { useEffect, useRef } from "react";

const canUseDOM = typeof window !== "undefined" && typeof document !== "undefined";

function isHTMLElement(node) {
  return typeof HTMLElement !== "undefined" && node instanceof HTMLElement;
}

function focusElement(element) {
  if (!isHTMLElement(element) || typeof element.focus !== "function") {
    return;
  }
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export default function useRestoreFocus(active, options = {}) {
  const { focusTargetRef = null } = options;
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!active || !canUseDOM) {
      return undefined;
    }

    previouslyFocusedRef.current = isHTMLElement(document.activeElement)
      ? document.activeElement
      : null;

    const target = focusTargetRef?.current;
    if (isHTMLElement(target)) {
      const frame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
      frame(() => {
        focusElement(target);
      });
    }

    return () => {
      if (isHTMLElement(previouslyFocusedRef.current)) {
        focusElement(previouslyFocusedRef.current);
        previouslyFocusedRef.current = null;
      }
    };
  }, [active, focusTargetRef]);
}
