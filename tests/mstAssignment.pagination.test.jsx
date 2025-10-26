import React, { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  PageSizeControl,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_STORAGE_KEY,
  MIN_PAGE_SIZE,
  normalizePageSize,
  readStoredPageSize,
} from "@/components/MSTAssignment.jsx";

import usePagination from "@/hooks/usePagination.js";

const createItems = (count) => Array.from({ length: count }, (_, index) => ({ id: index }));

function PaginationHarness({ items, initialPageSize = PAGE_SIZE_OPTIONS[0] }) {
  const { pageSize, currentPageItems, setPageSize } = usePagination(items, {
    initialPage: 1,
    initialPageSize,
    minPageSize: MIN_PAGE_SIZE,
  });

  useEffect(() => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  return (
    <div>
      <PageSizeControl
        value={pageSize}
        onChange={setPageSize}
        options={PAGE_SIZE_OPTIONS}
        minValue={MIN_PAGE_SIZE}
        selectId="test-page-size"
      />
      <div data-testid="page-length">{currentPageItems.length}</div>
    </div>
  );
}

describe("readStoredPageSize", () => {
  it("trả về fallback khi localStorage không khả dụng", () => {
    expect(readStoredPageSize(null, 15, MIN_PAGE_SIZE)).toBe(15);
  });

  it("chuẩn hóa giá trị nhỏ hơn tối thiểu", () => {
    const storage = { getItem: vi.fn().mockReturnValue("5") };
    expect(readStoredPageSize(storage, 15, MIN_PAGE_SIZE)).toBe(MIN_PAGE_SIZE);
  });

  it("đọc giá trị hợp lệ và chuẩn hóa chuỗi", () => {
    const storage = { getItem: vi.fn().mockReturnValue("42") };
    expect(readStoredPageSize(storage, 15, MIN_PAGE_SIZE)).toBe(42);
    expect(storage.getItem).toHaveBeenCalledWith(PAGE_SIZE_STORAGE_KEY);
  });

  it("bắt ngoại lệ và trả về fallback an toàn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("read error");
      }),
    };
    expect(readStoredPageSize(storage, 12, MIN_PAGE_SIZE)).toBe(12);
    warnSpy.mockRestore();
  });
});

describe("normalizePageSize", () => {
  it("ép kiểu và chuẩn hóa giá trị hợp lệ", () => {
    expect(normalizePageSize("25", MIN_PAGE_SIZE)).toBe(25);
  });

  it("làm tròn xuống và giữ tối thiểu", () => {
    expect(normalizePageSize(9.7, MIN_PAGE_SIZE)).toBe(MIN_PAGE_SIZE);
  });

  it("trả về tối thiểu khi giá trị không hợp lệ", () => {
    expect(normalizePageSize("abc", MIN_PAGE_SIZE)).toBe(MIN_PAGE_SIZE);
  });
});

describe("PageSizeControl", () => {
  const items = createItems(120);

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("thay đổi giữa các lựa chọn cố định", () => {
    render(<PaginationHarness items={items} initialPageSize={15} />);
    const select = screen.getByLabelText("Số dòng mỗi trang");

    expect(screen.getByTestId("page-length").textContent).toBe("15");

    fireEvent.change(select, { target: { value: "30" } });
    expect(screen.getByTestId("page-length").textContent).toBe("30");

    fireEvent.change(select, { target: { value: "50" } });
    expect(screen.getByTestId("page-length").textContent).toBe("50");
  });

  it("áp dụng giá trị tùy chỉnh và lưu xuống localStorage", () => {
    render(<PaginationHarness items={items} initialPageSize={15} />);
    const select = screen.getByLabelText("Số dòng mỗi trang");

    fireEvent.change(select, { target: { value: "custom" } });
    const input = screen.getByLabelText("Nhập số dòng tùy chỉnh");

    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.blur(input);
    expect(screen.getByTestId("page-length").textContent).toBe("12");
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe("12");

    // giá trị nhỏ hơn tối thiểu sẽ bị ép về 10
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(screen.getByTestId("page-length").textContent).toBe(String(MIN_PAGE_SIZE));
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe(String(MIN_PAGE_SIZE));
  });
});
