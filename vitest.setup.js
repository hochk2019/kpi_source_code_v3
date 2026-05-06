import React from "react";
import { beforeEach, afterEach, vi } from "vitest";

import "@testing-library/jest-dom/vitest";

import { clearStorageCache } from "@/lib/storageClient.js";

const DEFAULT_RECHARTS_WIDTH = 960;
const DEFAULT_RECHARTS_HEIGHT = 320;

function normalizeRechartsSize(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && !trimmed.endsWith("%")) {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return fallback;
}

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");

  function ResponsiveContainer({
    children,
    width,
    height,
    minWidth,
    minHeight,
    aspect,
    maxHeight,
    debounce,
    onResize,
    className,
    style,
    ...props
  }) {
    void aspect;
    void maxHeight;
    void debounce;
    void onResize;

    const resolvedWidth = Math.max(
      normalizeRechartsSize(minWidth, 0),
      normalizeRechartsSize(width, DEFAULT_RECHARTS_WIDTH),
    );
    const resolvedHeight = Math.max(
      normalizeRechartsSize(minHeight, 0),
      normalizeRechartsSize(height, DEFAULT_RECHARTS_HEIGHT),
    );

    const child = React.Children.only(children);
    const nextChild = React.isValidElement(child)
      ? React.cloneElement(child, {
          width: child.props?.width ?? resolvedWidth,
          height: child.props?.height ?? resolvedHeight,
        })
      : child;

    return React.createElement(
      "div",
      {
        ...props,
        className,
        style: {
          width: resolvedWidth,
          height: resolvedHeight,
          ...style,
        },
        "data-recharts-responsive-container": "mock",
      },
      nextChild,
    );
  }

  return {
    ...actual,
    ResponsiveContainer,
  };
});

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => ({
    alert: () => Promise.resolve(),
    confirm: () => Promise.resolve(true),
  }),
  AppDialogProvider: ({ children }) => children,
}));

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  clear() {
    this.store.clear();
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  key(index) {
    return Array.from(this.store.keys())[Number(index)] ?? null;
  }

  get length() {
    return this.store.size;
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new LocalStorageMock(),

  writable: true,

  configurable: true,
});

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverMock {
    observe() {}

    unobserve() {}

    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
}

if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: vi.fn(() => ({
      fillRect: vi.fn(),

      clearRect: vi.fn(),

      getImageData: vi.fn(() => ({ data: [] })),

      putImageData: vi.fn(),

      createImageData: vi.fn(),

      setTransform: vi.fn(),

      drawImage: vi.fn(),

      save: vi.fn(),

      restore: vi.fn(),

      beginPath: vi.fn(),

      moveTo: vi.fn(),

      lineTo: vi.fn(),

      closePath: vi.fn(),

      stroke: vi.fn(),

      translate: vi.fn(),

      scale: vi.fn(),

      rotate: vi.fn(),

      arc: vi.fn(),

      fill: vi.fn(),

      measureText: vi.fn(() => ({ width: 0 })),

      transform: vi.fn(),

      rect: vi.fn(),

      clip: vi.fn(),
    })),

    writable: true,

    configurable: true,
  });
}

beforeEach(() => {
  globalThis.localStorage = new LocalStorageMock();

  globalThis.alert = vi.fn();

  clearStorageCache();
});

afterEach(() => {
  vi.clearAllMocks();
});
