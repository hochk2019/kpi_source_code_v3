import { useEffect, useState } from "react";

function resolveContainerWidth(rootRef) {
  return rootRef?.current?.offsetWidth ?? window.innerWidth ?? 0;
}

export default function useDataImporterContainerWidth({ rootRef, initialWidth = 0 }) {
  const [containerWidth, setContainerWidth] = useState(initialWidth);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let frame = null;

    const updateWidth = () => {
      const commitWidth = () => {
        frame = null;
        setContainerWidth(resolveContainerWidth(rootRef));
      };

      if (typeof window.requestAnimationFrame === "function") {
        frame = window.requestAnimationFrame(commitWidth);
        return;
      }

      commitWidth();
    };

    updateWidth();

    let resizeObserver = null;

    if (typeof ResizeObserver !== "undefined" && rootRef?.current) {
      resizeObserver = new ResizeObserver(() => updateWidth());
      resizeObserver.observe(rootRef.current);
    } else {
      window.addEventListener("resize", updateWidth);
    }

    return () => {
      if (frame !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frame);
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", updateWidth);
      }
    };
  }, [rootRef]);

  return containerWidth;
}
