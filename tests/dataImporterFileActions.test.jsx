import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import DataImporterFileActions from "@/components/dataImporter/DataImporterFileActions.jsx";

afterEach(() => {
  cleanup();
});

function createProps(overrides = {}) {
  return {
    fileInputRef: { current: null },
    onFileChange: vi.fn(),
    onOpenFilePicker: vi.fn(),
    onImport: vi.fn(),
    onLoadSavedRows: vi.fn(),
    onOpenDeletedList: vi.fn(),
    isReadOnlyForEdits: false,
    canEdit: true,
    canImport: true,
    canViewSavedRows: true,
    selectedFile: "imports.xlsx",
    modeLabel: "Đang xem dữ liệu đã lưu",
    ...overrides,
  };
}

describe("DataImporterFileActions", () => {
  it("renders the full action rail and forwards interactions", () => {
    const props = createProps();

    render(<DataImporterFileActions {...props} />);

    const fileInput = screen.getByTestId("import-file-input");
    expect(fileInput).toHaveAttribute("type", "file");
    expect(screen.getByText("Đã chọn: imports.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Đang xem dữ liệu đã lưu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chọn file XLSX" }));
    fireEvent.click(screen.getByRole("button", { name: "Import XLSX" }));
    fireEvent.click(screen.getByRole("button", { name: "Hiển thị dữ liệu đã lưu" }));
    fireEvent.click(screen.getByRole("button", { name: "Danh sách tờ khai đã xóa" }));
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["demo"], "demo.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })],
      },
    });

    expect(props.onOpenFilePicker).toHaveBeenCalledTimes(1);
    expect(props.onImport).toHaveBeenCalledTimes(1);
    expect(props.onLoadSavedRows).toHaveBeenCalledTimes(1);
    expect(props.onOpenDeletedList).toHaveBeenCalledTimes(1);
    expect(props.onFileChange).toHaveBeenCalledTimes(1);
  });

  it("hides edit-only actions and disables the file input in read-only mode", () => {
    render(
      <DataImporterFileActions
        {...createProps({
          isReadOnlyForEdits: true,
          canEdit: false,
          canImport: false,
          canViewSavedRows: false,
          selectedFile: "",
        })}
      />,
    );

    expect(screen.getByTestId("import-file-input")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Chọn file XLSX" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import XLSX" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Danh sách tờ khai đã xóa" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hiển thị dữ liệu đã lưu" })).toBeInTheDocument();
  });

  it("shows import button disabled when import is not currently allowed", () => {
    render(
      <DataImporterFileActions
        {...createProps({
          canImport: false,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Import XLSX" })).toBeDisabled();
  });
});
