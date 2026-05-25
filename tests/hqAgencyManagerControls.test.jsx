import React from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HQAgencyManagerControls from "@/components/hq-agency-manager/HQAgencyManagerControls.jsx";

vi.mock("@/components/designSystem/primitives.jsx", () => ({
  FilterSelect: ({ emptyLabel, onChange, options, value }) => (
    <select
      data-testid={`filter-select-${emptyLabel || "status"}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{emptyLabel || "placeholder"}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

function renderControls(overrides = {}) {
  const props = {
    agencyFilter: "",
    agencySelectOptions: [
      { value: "AIR", label: "AIR" },
      { value: "SEA", label: "SEA" },
    ],
    canEdit: true,
    dirty: true,
    fileRef: { current: null },
    filteredCount: 12,
    hasRows: true,
    historyOverview: {
      total: 3,
      lastTimestamp: new Date("2026-03-27T10:15:00.000Z"),
      lastActor: "admin",
      lastMst: "0101234567",
      last24h: 2,
    },
    isReadOnly: false,
    loadError: null,
    onAddRow: vi.fn(),
    onAgencyFilterChange: vi.fn(),
    onFilePick: vi.fn(),
    onImport: vi.fn(),
    onNextPage: vi.fn(),
    onPrevPage: vi.fn(),
    onRefreshHistory: vi.fn(),
    onReload: vi.fn(),
    onResetFilters: vi.fn(),
    onSave: vi.fn(),
    onSearchChange: vi.fn(),
    onStatusFilterChange: vi.fn(),
    safePage: 2,
    search: "",
    selectedFile: "hq.xlsx",
    statusFilter: "all",
    totalPages: 4,
    ...overrides,
  };

  function Harness() {
    const [agencyFilter, setAgencyFilter] = React.useState(props.agencyFilter);
    const [search, setSearch] = React.useState(props.search);
    const [statusFilter, setStatusFilter] = React.useState(props.statusFilter);

    return (
      <HQAgencyManagerControls
        {...props}
        agencyFilter={agencyFilter}
        onAgencyFilterChange={(value) => {
          setAgencyFilter(value);
          props.onAgencyFilterChange(value);
        }}
        onSearchChange={(value) => {
          setSearch(value);
          props.onSearchChange(value);
        }}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          props.onStatusFilterChange(value);
        }}
        search={search}
        statusFilter={statusFilter}
      />
    );
  }

  return {
    ...render(<Harness />),
    props,
  };
}

describe("HQAgencyManagerControls", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders history summary and dispatches toolbar actions", async () => {
    const user = userEvent.setup();
    const { props } = renderControls();

    expect(
      screen.getByText((_, el) => el?.textContent === "3 bản ghi"),
    ).toBeInTheDocument();
    expect(screen.getByText(/24h/)).toBeInTheDocument();
    expect(screen.getByText(/Update:/)).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "12 mục • 2/4"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tải lại" }));
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    await user.click(screen.getByRole("button", { name: "Làm mới" }));
    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(screen.getByRole("button", { name: "+ Thêm dòng" }));
    await user.click(screen.getByRole("button", { name: "Xóa lọc" }));
    await user.click(screen.getByRole("button", { name: "«" }));
    await user.click(screen.getByRole("button", { name: "»" }));
    await user.type(screen.getByPlaceholderText("Tìm MST, Công ty..."), "demo");

    expect(props.onReload).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onRefreshHistory).toHaveBeenCalledTimes(1);
    expect(props.onImport).toHaveBeenCalledTimes(1);
    expect(props.onAddRow).toHaveBeenCalledTimes(1);
    expect(props.onResetFilters).toHaveBeenCalledTimes(1);
    expect(props.onPrevPage).toHaveBeenCalledTimes(1);
    expect(props.onNextPage).toHaveBeenCalledTimes(1);
    expect(props.onSearchChange).toHaveBeenNthCalledWith(1, "d");
    expect(props.onSearchChange).toHaveBeenLastCalledWith("demo");
  });

  it("renders read-only messaging and forwards filter changes", async () => {
    const user = userEvent.setup();
    const { props } = renderControls({
      canEdit: false,
      dirty: false,
      hasRows: false,
      historyOverview: {
        total: 0,
        lastTimestamp: null,
        lastActor: "",
        lastMst: "",
        last24h: 0,
      },
      isReadOnly: true,
      loadError: "Không thể tải danh sách Đại lý HQ. Vui lòng thử lại.",
      selectedFile: "",
      statusFilter: "pending",
    });

    expect(screen.getByText(/Chế độ chỉ xem/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu cấu hình" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import Excel" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("filter-select-Tất cả đại lý"), "SEA");
    await user.selectOptions(screen.getByTestId("filter-select-status"), "recent");

    expect(props.onAgencyFilterChange).toHaveBeenCalledWith("SEA");
    expect(props.onStatusFilterChange).toHaveBeenCalledWith("recent");
  });
});
