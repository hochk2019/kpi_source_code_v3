import * as React from "react";

export function useComposedRefs(...refs) {
  return React.useCallback(
    (node) => {
      refs.forEach((ref) => {
        if (typeof ref === "function") {
          ref(node);
        } else if (ref !== null && ref !== undefined) {
          ref.current = node;
        }
      });
    },
    refs
  );
}

export function composeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref !== null && ref !== undefined) {
        ref.current = node;
      }
    });
  };
}
