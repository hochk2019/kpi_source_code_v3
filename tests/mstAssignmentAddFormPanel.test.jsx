import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import MstAssignmentAddFormPanel from "@/components/mst-assignment/forms/MstAssignmentAddFormPanel.jsx";

function StaffComboboxStub({
  placeholder,
  ariaLabel,
  searchAriaLabel,
  onSelect,
}) {
  return (
    <div>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() =>
          onSelect({
            staffName: ariaLabel.includes("Nhập") ? "Nguyễn Văn A" : "Trần Thị B",
            teamName: "Đội 1",
            isCustom: false,
          })
        }
      >
        {placeholder}
      </button>
      <span>{searchAriaLabel}</span>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe("mst assignment add form panel", () => {
  it("renders the extracted form and wires all callbacks", async () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    const onMstChange = vi.fn();
    const onCompanyChange = vi.fn();
    const onImportSelect = vi.fn();
    const onExportSelect = vi.fn();
    const onTeamChange = vi.fn();
    const onEffectiveFromChange = vi.fn();
    const onEffectiveToChange = vi.fn();
    const onCancel = vi.fn();

    render(
      <MstAssignmentAddFormPanel
        StaffComboboxComponent={StaffComboboxStub}
        draft={{
          mst: "0312345678",
          company: "Công ty A",
          person_import: "",
          person_export: "",
          team: "Đội 1",
          effective_from: "2024-01-01",
          effective_to: "",
        }}
        addError="Ngày kết thúc phải sau hoặc bằng ngày bắt đầu."
        rosterTeams={[{ value: "Đội 1", label: "Đội 1", members: [] }]}
        onSubmit={onSubmit}
        onMstChange={onMstChange}
        onCompanyChange={onCompanyChange}
        onImportSelect={onImportSelect}
        onExportSelect={onExportSelect}
        onTeamChange={onTeamChange}
        onEffectiveFromChange={onEffectiveFromChange}
        onEffectiveToChange={onEffectiveToChange}
        onCancel={onCancel}
      />
    );

    fireEvent.change(screen.getByLabelText("Mã số thuế"), {
      target: { value: "0300000001" },
    });
    expect(onMstChange).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Tên công ty"), {
      target: { value: "Công ty B" },
    });
    expect(onCompanyChange).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Tổ đội (tuỳ chọn)"), {
      target: { value: "Đội 2" },
    });
    expect(onTeamChange).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Áp dụng từ ngày"), {
      target: { value: "2024-02-01" },
    });
    expect(onEffectiveFromChange).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Đến hết ngày (tuỳ chọn)"), {
      target: { value: "2024-02-29" },
    });
    expect(onEffectiveToChange).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Người phụ trách Nhập" }));
    expect(onImportSelect).toHaveBeenCalledWith({
      staffName: "Nguyễn Văn A",
      teamName: "Đội 1",
      isCustom: false,
    });

    await userEvent.click(screen.getByRole("button", { name: "Người phụ trách Xuất" }));
    expect(onExportSelect).toHaveBeenCalledWith({
      staffName: "Trần Thị B",
      teamName: "Đội 1",
      isCustom: false,
    });

    expect(screen.getByText("Tìm người phụ trách Nhập")).toBeInTheDocument();
    expect(screen.getByText("Tìm người phụ trách Xuất")).toBeInTheDocument();
    expect(
      screen.getByText("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Thêm vào danh sách" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("hides the error area when the draft is valid", () => {
    render(
      <MstAssignmentAddFormPanel
        StaffComboboxComponent={StaffComboboxStub}
        draft={{
          mst: "",
          company: "",
          person_import: "",
          person_export: "",
          team: "",
          effective_from: "",
          effective_to: "",
        }}
        addError=""
        rosterTeams={[]}
        onSubmit={vi.fn()}
        onMstChange={vi.fn()}
        onCompanyChange={vi.fn()}
        onImportSelect={vi.fn()}
        onExportSelect={vi.fn()}
        onTeamChange={vi.fn()}
        onEffectiveFromChange={vi.fn()}
        onEffectiveToChange={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText(/Ngày kết thúc phải sau hoặc bằng ngày bắt đầu/)).not.toBeInTheDocument();
  });
});
