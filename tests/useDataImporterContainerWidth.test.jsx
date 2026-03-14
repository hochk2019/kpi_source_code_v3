import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterContainerWidth from "@/components/dataImporter/useDataImporterContainerWidth.js";

describe("useDataImporterContainerWidth", () => {
  let originalResizeObserver;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;

    window.requestAnimationFrame = vi.fn((callback) => {
      callback();
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    if (typeof originalResizeObserver === "undefined") {
      delete globalThis.ResizeObserver;
    } else {
      globalThis.ResizeObserver = originalResizeObserver;
    }
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.restoreAllMocks();
  });

  it("tracks the root width via ResizeObserver when available", async () => {
    let observedElement = null;
    let resizeCallback = null;
    const disconnect = vi.fn();

    globalThis.ResizeObserver = class {
      constructor(callback) {
        resizeCallback = callback;
      }

      observe(element) {
        observedElement = element;
      }

      disconnect() {
        disconnect();
      }
    };

    const element = document.createElement("div");
    Object.defineProperty(element, "offsetWidth", {
      configurable: true,
      get: () => Number(element.dataset.width || 0),
    });
    element.dataset.width = "512";

    const rootRef = { current: element };
    const { result, unmount } = renderHook(() => useDataImporterContainerWidth({ rootRef }));

    await waitFor(() => {
      expect(result.current).toBe(512);
      expect(observedElement).toBe(element);
    });

    act(() => {
      element.dataset.width = "640";
      resizeCallback?.();
    });

    await waitFor(() => {
      expect(result.current).toBe(640);
    });

    unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("falls back to window resize events when ResizeObserver is unavailable", async () => {
    delete globalThis.ResizeObserver;
    window.innerWidth = 777;

    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { result, unmount } = renderHook(() =>
      useDataImporterContainerWidth({
        rootRef: { current: null },
      }),
    );

    await waitFor(() => {
      expect(result.current).toBe(777);
      expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    });

    act(() => {
      window.innerWidth = 640;
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current).toBe(640);
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
