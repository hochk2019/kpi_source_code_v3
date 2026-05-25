import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import DataImporterFilterPresetControls from "@/components/dataImporter/DataImporterFilterPresetControls.jsx";

afterEach(() => {
  cleanup();
});

function createProps(overrides = {}) {
  return {
    selectedPresetId: "preset-1",
    savedPresets: [
      { id: "preset-1", name: "Preset A" },
      { id: "preset-2", name: "Preset B" },
    ],
    presetBusy: false,
    presetSaving: false,
    presetLoading: false,
    presetError: "Không thể lưu preset",
    appliedPreset: { id: "preset-1", name: "Preset A" },
    appliedPresetUpdatedAt: "10/03/2026 19:30",
    onSelectPreset: vi.fn(),
    onApplySelectedPreset: vi.fn(),
    onSavePresetAsNew: vi.fn(),
    onOverwriteSelectedPreset: vi.fn(),
    onDeleteSelectedPreset: vi.fn(),
    onRefreshPresetList: vi.fn(),
    onClearPresetError: vi.fn(),
    ...overrides,
  };
}

describe("DataImporterFilterPresetControls", () => {
  it("renders the saved preset rail and forwards all interactions", () => {
    const props = createProps();

    render(<DataImporterFilterPresetControls {...props} />);

    expect(screen.getByText(/Bộ lọc đã lưu/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("preset-1");
    expect(
      screen.getByText((_, node) =>
        node?.textContent === "Đang áp dụng: Preset A • Cập nhật 10/03/2026 19:30",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Không thể lưu preset/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "preset-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu preset mới" }));
    fireEvent.click(screen.getByRole("button", { name: "Ghi đè preset" }));
    fireEvent.click(screen.getByRole("button", { name: "Xoá preset" }));
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));

    expect(props.onSelectPreset).toHaveBeenCalledWith("preset-2");
    expect(props.onApplySelectedPreset).toHaveBeenCalledTimes(1);
    expect(props.onSavePresetAsNew).toHaveBeenCalledTimes(1);
    expect(props.onOverwriteSelectedPreset).toHaveBeenCalledTimes(1);
    expect(props.onDeleteSelectedPreset).toHaveBeenCalledTimes(1);
    expect(props.onRefreshPresetList).toHaveBeenCalledTimes(1);
    expect(props.onClearPresetError).toHaveBeenCalledTimes(1);
  });

  it("hides overwrite and delete actions when no preset is selected", () => {
    render(
      <DataImporterFilterPresetControls
        {...createProps({
          selectedPresetId: "",
          presetError: "",
          appliedPreset: null,
          appliedPresetUpdatedAt: "",
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: "Ghi đè preset" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xoá preset" })).toBeNull();
    expect(screen.queryByText(/Đang áp dụng:/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Đóng" })).toBeNull();
  });

  it("disables actions and shows loading labels when preset work is busy", () => {
    render(
      <DataImporterFilterPresetControls
        {...createProps({
          presetBusy: true,
          presetSaving: true,
          presetLoading: true,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ghi đè preset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xoá preset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đồng bộ…" })).toBeDisabled();
  });
});
