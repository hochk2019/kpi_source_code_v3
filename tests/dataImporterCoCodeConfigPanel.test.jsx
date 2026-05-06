import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import DataImporterCoCodeConfigPanel from "@/components/dataImporter/DataImporterCoCodeConfigPanel.jsx";

afterEach(() => {
  cleanup();
});

function createProps(overrides = {}) {
  return {
    canManageSync: true,
    loading: false,
    saving: false,
    error: "",
    message: "Đã lưu cấu hình mã ưu đãi.",
    form: {
      whitelist: "CA3",
      blacklist: "B01",
    },
    onFormChange: vi.fn(),
    onRefresh: vi.fn(),
    onSave: vi.fn(),
    onReset: vi.fn(),
    updatedLabel: "Cập nhật lúc 10/03/2026 10:30",
    ...overrides,
  };
}

describe("DataImporterCoCodeConfigPanel", () => {
  it("renders populated state and forwards interactions", () => {
    const props = createProps();

    render(<DataImporterCoCodeConfigPanel {...props} />);

    expect(screen.getByText(/Cấu hình mã ưu đãi C\/O/i)).toBeInTheDocument();
    expect(screen.getByText(/Đã lưu cấu hình mã ưu đãi\./i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("CA3")).toBeInTheDocument();
    expect(screen.getByDisplayValue("B01")).toBeInTheDocument();
    expect(screen.getByText(/Cập nhật lúc 10\/03\/2026 10:30/i)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("CA3"), {
      target: { value: "CA3\nVK" },
    });
    fireEvent.change(screen.getByDisplayValue("B01"), {
      target: { value: "B02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));

    expect(props.onFormChange).toHaveBeenCalledWith({
      whitelist: "CA3\nVK",
      blacklist: "B01",
    });
    expect(props.onFormChange).toHaveBeenCalledWith({
      whitelist: "CA3",
      blacklist: "B02",
    });
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("renders disabled and error states", () => {
    render(
      <DataImporterCoCodeConfigPanel
        {...createProps({
          canManageSync: false,
          loading: true,
          saving: true,
          error: "Không tải được cấu hình.",
          message: "",
        })}
      />,
    );

    expect(screen.getByText(/Không tải được cấu hình\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang tải..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang lưu..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Khôi phục" })).toBeDisabled();
    expect(screen.getByDisplayValue("CA3")).toBeDisabled();
    expect(screen.getByDisplayValue("B01")).toBeDisabled();
  });
});
