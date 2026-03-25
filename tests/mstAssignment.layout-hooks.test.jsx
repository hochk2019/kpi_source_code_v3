import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  COLUMN_VISIBILITY_STORAGE_PREFIX,
  COLUMN_WIDTH_STORAGE_KEY,
  DEFAULT_COLUMN_WIDTHS,
  useMSTAssignmentColumnLayout,
} from "@/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js";
import useMSTAssignmentPageSize, {
  PAGE_SIZE_STORAGE_KEY,
} from "@/components/mst-assignment/hooks/useMSTAssignmentPageSize.js";

function ColumnLayoutHarness({ actor = "alice" }) {
  const {
    columnMenuOpen,
    columnStyleMap,
    handleColumnResizeStart,
    isColumnVisible,
    setColumnMenuOpen,
    toggleColumnVisibility,
    visibleColumnKeys,
  } = useMSTAssignmentColumnLayout({ actor });

  return (
    <div>
      <button onMouseDown={(event) => handleColumnResizeStart("company", event)}>
        resize-company
      </button>
      <button onClick={() => toggleColumnVisibility("status")}>toggle-status</button>
      <button onClick={() => setColumnMenuOpen((prev) => !prev)}>toggle-menu</button>
      <div data-testid="company-width">{columnStyleMap.company.width}</div>
      <div data-testid="status-visible">{String(isColumnVisible("status"))}</div>
      <div data-testid="menu-open">{String(columnMenuOpen)}</div>
      <div data-testid="visible-count">{visibleColumnKeys.length}</div>
    </div>
  );
}

function PageSizeHarness() {
  const { initialPageSize, persistPageSize } = useMSTAssignmentPageSize();

  return (
    <div>
      <div data-testid="initial-page-size">{initialPageSize}</div>
      <button onClick={() => persistPageSize(42)}>persist-page-size</button>
    </div>
  );
}

describe("useMSTAssignmentColumnLayout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("ghi nho resize va visibility theo actor hien tai", () => {
    window.localStorage.setItem(
      COLUMN_WIDTH_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_COLUMN_WIDTHS,
        company: 360,
      })
    );

    render(<ColumnLayoutHarness actor="alice" />);

    expect(screen.getByTestId("company-width").textContent).toBe("360px");
    expect(screen.getByTestId("status-visible").textContent).toBe("true");
    expect(screen.getByTestId("menu-open").textContent).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "toggle-menu" }));
    expect(screen.getByTestId("menu-open").textContent).toBe("true");

    fireEvent.mouseDown(screen.getByRole("button", { name: "resize-company" }), {
      button: 0,
      clientX: 360,
    });
    fireEvent.mouseMove(window, { clientX: 420 });
    fireEvent.mouseUp(window, { clientX: 420 });
    vi.runAllTimers();

    expect(screen.getByTestId("company-width").textContent).toBe("420px");

    fireEvent.click(screen.getByRole("button", { name: "toggle-status" }));
    expect(screen.getByTestId("status-visible").textContent).toBe("false");
    expect(screen.getByTestId("visible-count").textContent).toBe("7");

    const storedWidths = JSON.parse(window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY));
    expect(storedWidths.company).toBe(420);

    const storedVisibility = JSON.parse(
      window.localStorage.getItem(`${COLUMN_VISIBILITY_STORAGE_PREFIX}:alice`)
    );
    expect(storedVisibility.status).toBe(false);
  });
});

describe("useMSTAssignmentPageSize", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("doc gia tri da luu va persist page size moi", () => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, "25");

    render(<PageSizeHarness />);

    expect(screen.getByTestId("initial-page-size").textContent).toBe("25");

    fireEvent.click(screen.getByRole("button", { name: "persist-page-size" }));
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe("42");
  });
});
