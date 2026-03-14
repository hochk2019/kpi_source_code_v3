import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  AgencyCombobox,
  StaffCombobox,
  TeamCombobox,
} from "@/components/dataImporter/DataImporterAssignmentComboboxes.jsx";

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

function getComboboxTrigger(label) {
  return screen.getByText(label).closest("button");
}

describe("DataImporterAssignmentComboboxes", () => {
  it("lets the team combobox select an existing team or create a custom one", async () => {
    const onSelect = vi.fn();
    const teams = [
      { id: "a", name: "Tổ đội A", normalized: "to doi a", members: [] },
      { id: "b", name: "Tổ đội B", normalized: "to doi b", members: [] },
    ];

    const { rerender } = render(
      <TeamCombobox value="" onSelect={onSelect} teams={teams} />,
    );

    fireEvent.click(getComboboxTrigger("Chọn tổ đội"));
    fireEvent.click(await screen.findByRole("option", { name: /Tổ đội B/ }));

    expect(onSelect).toHaveBeenLastCalledWith({ teamName: "Tổ đội B" });

    rerender(<TeamCombobox value="" onSelect={onSelect} teams={teams} />);

    fireEvent.click(getComboboxTrigger("Chọn tổ đội"));
    fireEvent.change(screen.getByPlaceholderText("Tìm tổ đội"), {
      target: { value: "Tổ mới" },
    });
    fireEvent.click(await screen.findByRole("option", { name: /Dùng giá trị "Tổ mới"/ }));

    expect(onSelect).toHaveBeenLastCalledWith({ teamName: "Tổ mới" });
  });

  it("lets the staff combobox prioritize the selected team and return both staff and team", async () => {
    const onSelect = vi.fn();
    const teams = [
      {
        id: "a",
        name: "Tổ đội A",
        normalized: "to doi a",
        members: [{ id: "a-1", name: "Lan", normalized: "lan" }],
      },
      {
        id: "b",
        name: "Tổ đội B",
        normalized: "to doi b",
        members: [{ id: "b-1", name: "Hùng", normalized: "hung" }],
      },
    ];

    render(
      <StaffCombobox
        value=""
        teamValue="Tổ đội B"
        onSelect={onSelect}
        teams={teams}
      />,
    );

    fireEvent.click(getComboboxTrigger("Chọn nhân viên"));

    expect(screen.getByText("Tổ: Tổ đội A")).toBeInTheDocument();
    expect(screen.getByText("Tổ: Tổ đội B")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("option", { name: /Hùng Tổ đội B/ }));

    expect(onSelect).toHaveBeenCalledWith({
      staffName: "Hùng",
      teamName: "Tổ đội B",
    });
  });

  it("deduplicates agency options, shows hints, and allows clearing the selected value", async () => {
    const onSelect = vi.fn();
    const options = [
      { value: "DL01", label: "Đại lý 01", hint: "MST A" },
      { value: "DL01", label: "Đại lý 01", hint: "MST B" },
      { value: "DL02", label: "Đại lý 02", hint: "MST C" },
    ];

    render(
      <AgencyCombobox
        value="DL01"
        onSelect={onSelect}
        options={options}
      />,
    );

    fireEvent.click(getComboboxTrigger("DL01"));

    expect(await screen.findByText("MST A • MST B")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /Bỏ chọn đại lý/ }));

    expect(onSelect).toHaveBeenCalledWith("");
  });
});
