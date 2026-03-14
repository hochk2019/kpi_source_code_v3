import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import DataImporterQueryFilterControls from "@/components/dataImporter/DataImporterQueryFilterControls.jsx";

afterEach(() => {
  cleanup();
});

function createProps(overrides = {}) {
  return {
    query: "alpha",
    mainSearchHelpTextId: "search-help",
    datePreset: "30d",
    dateRangePresets: [
      { key: "none", label: "Tất cả" },
      { key: "30d", label: "30 ngày" },
    ],
    searchRange: { from: "2026-03-01", to: "2026-03-10" },
    filterNoStaff: true,
    filterNoTeam: false,
    coFilterMode: "min",
    coFilterMin: 5,
    coFilterActive: true,
    coFilterMatches: 12,
    coFilterOptions: [
      { value: "all", label: "Tất cả" },
      { value: "has", label: "Có C/O" },
      { value: "min", label: "Tối thiểu số dòng" },
    ],
    onQueryChange: vi.fn(),
    onClearQuery: vi.fn(),
    onDatePresetChange: vi.fn(),
    onSearchRangeFromChange: vi.fn(),
    onSearchRangeToChange: vi.fn(),
    onClearSearchRange: vi.fn(),
    onFilterNoStaffChange: vi.fn(),
    onFilterNoTeamChange: vi.fn(),
    onCoFilterModeChange: vi.fn(),
    onCoFilterMinChange: vi.fn(),
    ...overrides,
  };
}

describe("DataImporterQueryFilterControls", () => {
  it("renders the full query/date/co filter block and forwards interactions", () => {
    const props = createProps();

    render(<DataImporterQueryFilterControls {...props} />);

    expect(screen.getByRole("searchbox", { name: "Tìm nhanh danh sách tờ khai" })).toHaveValue("alpha");
    expect(screen.getByText(/Nhập từ khóa để tìm nhanh/)).toHaveAttribute("id", "search-help");
    expect(screen.getByRole("combobox", { name: "Khoảng" })).toHaveValue("30d");
    expect(screen.getByLabelText("Từ ngày")).toHaveValue("2026-03-01");
    expect(screen.getByLabelText("Đến ngày")).toHaveValue("2026-03-10");
    expect(screen.getByLabelText("Chưa gán Nhân viên")).toBeChecked();
    expect(screen.getByLabelText("Chưa gán Tổ đội")).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Lọc C/O" })).toHaveValue("min");
    expect(screen.getByLabelText("Tối thiểu dòng C/O")).toHaveValue(5);
    expect(screen.getByText("Đáp ứng C/O: 12 tờ khai")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhanh danh sách tờ khai" }), {
      target: { value: "beta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Khoảng" }), {
      target: { value: "none" },
    });
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-02-01" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-02-28" } });
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc ngày" }));
    fireEvent.click(screen.getByLabelText("Chưa gán Nhân viên"));
    fireEvent.click(screen.getByLabelText("Chưa gán Tổ đội"));
    fireEvent.change(screen.getByRole("combobox", { name: "Lọc C/O" }), {
      target: { value: "has" },
    });
    fireEvent.change(screen.getByLabelText("Tối thiểu dòng C/O"), { target: { value: "8" } });

    expect(props.onQueryChange).toHaveBeenCalledWith("beta");
    expect(props.onClearQuery).toHaveBeenCalledTimes(1);
    expect(props.onDatePresetChange).toHaveBeenCalledWith("none");
    expect(props.onSearchRangeFromChange).toHaveBeenCalledWith("2026-02-01");
    expect(props.onSearchRangeToChange).toHaveBeenCalledWith("2026-02-28");
    expect(props.onClearSearchRange).toHaveBeenCalledTimes(1);
    expect(props.onFilterNoStaffChange).toHaveBeenCalledWith(false);
    expect(props.onFilterNoTeamChange).toHaveBeenCalledWith(true);
    expect(props.onCoFilterModeChange).toHaveBeenCalledWith("has");
    expect(props.onCoFilterMinChange).toHaveBeenCalledWith("8");
  });

  it("hides optional controls when range and C/O threshold are inactive", () => {
    render(
      <DataImporterQueryFilterControls
        {...createProps({
          query: "",
          datePreset: "none",
          searchRange: { from: "", to: "" },
          filterNoStaff: false,
          coFilterMode: "all",
          coFilterActive: false,
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: "Xóa tìm kiếm" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa lọc ngày" })).toBeNull();
    expect(screen.queryByLabelText("Tối thiểu dòng C/O")).toBeNull();
    expect(screen.queryByText(/Đáp ứng C\/O:/)).toBeNull();
  });

  it("still forwards custom preset selection", () => {
    const props = createProps();

    render(<DataImporterQueryFilterControls {...props} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Khoảng" }), {
      target: { value: "custom" },
    });

    expect(props.onDatePresetChange).toHaveBeenCalledWith("custom");
  });
});
