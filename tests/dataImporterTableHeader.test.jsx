import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import DataImporterTableHeader from "@/components/dataImporter/DataImporterTableHeader.jsx";

afterEach(() => {
  cleanup();
});

function renderHeader(props = {}) {
  const renderResizeHandle = vi.fn((columnKey) => <span>{`resize-${columnKey}`}</span>);
  const registerHeaderRef = vi.fn();
  const getFrozenStyle = vi.fn(() => undefined);
  const getColumnStyle = vi.fn(() => undefined);

  render(
    <table>
      <DataImporterTableHeader
        hiddenColumns={new Set()}
        selectionEnabled
        historyEnabled
        updateEnabled
        deleteEnabled
        frozenOffsets={{ selection: 0, date: 0, declaration: 0, mst: 0 }}
        frozenHeaderClass="sticky-header"
        renderResizeHandle={renderResizeHandle}
        registerHeaderRef={registerHeaderRef}
        getFrozenStyle={getFrozenStyle}
        getColumnStyle={getColumnStyle}
        columnLabels={{
          date: "Ngày đăng ký",
          declaration: "Số tờ khai",
          mst: "MST",
          company: "Doanh nghiệp",
          type: "Loại hình",
          co: "C/O",
          items: "Số dòng hàng",
          staff: "Nhân viên",
          team: "Tổ đội",
          agency: "Đại lý",
          status: "Trạng thái",
          licenses: "Số GP",
          kpi: "KPI",
        }}
        {...props}
      />
    </table>,
  );

  return { renderResizeHandle, registerHeaderRef, getFrozenStyle, getColumnStyle };
}

describe("DataImporterTableHeader", () => {
  it("hiển thị đầy đủ các cột grid và resize handle tương ứng", () => {
    const { renderResizeHandle } = renderHeader();

    expect(screen.getByText("Chọn")).toBeInTheDocument();
    expect(screen.getByText("Ngày đăng ký")).toBeInTheDocument();
    expect(screen.getByText("Số tờ khai")).toBeInTheDocument();
    expect(screen.getByText("MST")).toBeInTheDocument();
    expect(screen.getByText("Doanh nghiệp")).toBeInTheDocument();
    expect(screen.getByText("Nhật ký")).toBeInTheDocument();
    expect(screen.getByText("Cập nhật")).toBeInTheDocument();
    expect(screen.getByText("Xóa / Khôi phục")).toBeInTheDocument();
    expect(screen.getByText("resize-date")).toBeInTheDocument();
    expect(screen.getByText("resize-update")).toBeInTheDocument();
    expect(renderResizeHandle).toHaveBeenCalledWith("date");
    expect(renderResizeHandle).toHaveBeenCalledWith("history");
    expect(renderResizeHandle).toHaveBeenCalledWith("update");
  });

  it("ẩn các cột đã tắt và bỏ cột tùy chọn khi feature flag false", () => {
    renderHeader({
      hiddenColumns: new Set(["agency", "licenses", "kpi"]),
      selectionEnabled: false,
      historyEnabled: false,
      updateEnabled: false,
      deleteEnabled: false,
      frozenOffsets: {},
    });

    expect(screen.queryByText("Chọn")).toBeNull();
    expect(screen.queryByText("Nhật ký")).toBeNull();
    expect(screen.queryByText("Cập nhật")).toBeNull();
    expect(screen.queryByText("Xóa / Khôi phục")).toBeNull();
    expect(screen.queryByText("Đại lý")).toBeNull();
    expect(screen.queryByText("Số GP")).toBeNull();
    expect(screen.queryByText("KPI")).toBeNull();
    expect(screen.getByText("Doanh nghiệp")).toBeInTheDocument();
  });
});
