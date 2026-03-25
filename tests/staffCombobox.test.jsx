import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import StaffCombobox from "@/components/shared/StaffCombobox.jsx";

afterEach(() => {
  cleanup();
});

const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

const teams = [
  {
    id: "team-a",
    name: "Tổ Thuế A",
    members: [{ id: "mem-1", name: "Nguyễn Văn A", normalized: "nguyen van a" }],
  },
  {
    id: "team-b",
    name: "Tổ Nhập khẩu",
    members: [{ id: "mem-2", name: "Phạm Hải", normalized: "pham hai" }],
  },
];

function openCombobox(label = "Chọn nhân viên") {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
}

describe("StaffCombobox", () => {
  it("returns member payload in member selection mode", async () => {
    const onSelect = vi.fn();

    render(
      <StaffCombobox
        value=""
        teams={teams}
        onSelect={onSelect}
        selectionMode="member"
        ariaLabel="Nhân viên KPI"
      />,
    );

    openCombobox("Nhân viên KPI");
    fireEvent.click(await screen.findByRole("option", { name: /Nguyễn Văn A Tổ Thuế A/i }));

    expect(onSelect).toHaveBeenCalledWith({
      id: "mem-1",
      name: "Nguyễn Văn A",
      teamId: "team-a",
      teamName: "Tổ Thuế A",
      normalizedName: "nguyen van a",
      normalizedTeam: "to thue a",
    });
  });

  it("marks custom assignment values explicitly", async () => {
    const onSelect = vi.fn();

    render(
      <StaffCombobox
        value=""
        teams={teams}
        onSelect={onSelect}
        teamValue="Tổ Thuế A"
        ariaLabel="Người phụ trách nhập"
      />,
    );

    openCombobox("Người phụ trách nhập");
    fireEvent.change(screen.getByPlaceholderText("Tìm nhân viên"), {
      target: { value: "Nhân sự mới" },
    });
    fireEvent.click(await screen.findByRole("option", { name: /Dùng giá trị "Nhân sự mới"/i }));

    expect(onSelect).toHaveBeenCalledWith({
      staffName: "Nhân sự mới",
      teamName: "",
      isCustom: true,
    });
  });
});
