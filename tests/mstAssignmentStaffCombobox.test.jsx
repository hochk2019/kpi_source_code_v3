import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const sharedStaffComboboxMock = vi.fn(({ placeholder }) => (
  <div data-testid="shared-staff-combobox">{placeholder}</div>
));

vi.mock("@/components/shared/StaffCombobox.jsx", () => ({
  default: (props) => sharedStaffComboboxMock(props),
}));

import MstAssignmentStaffCombobox from "@/components/mst-assignment/shared/MstAssignmentStaffCombobox.jsx";

describe("MstAssignmentStaffCombobox", () => {
  it("gắn preset cho luồng MST assignment", () => {
    render(
      <MstAssignmentStaffCombobox
        value="Nguyễn Văn A"
        teamValue="Nhóm 1"
        teams={[]}
        placeholder="Chọn nhân viên"
      />,
    );

    expect(screen.getByTestId("shared-staff-combobox")).toHaveTextContent("Chọn nhân viên");
    expect(sharedStaffComboboxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowCustom: true,
        preserveTeamOnCustom: true,
        preserveTeamOnClear: true,
        value: "Nguyễn Văn A",
        teamValue: "Nhóm 1",
      }),
    );
  });
});
