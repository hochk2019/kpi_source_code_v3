import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import AssigneeCell from "@/components/mst-assignment/table/AssigneeCell.jsx";
import PersonColumnHeader from "@/components/mst-assignment/table/PersonColumnHeader.jsx";

afterEach(() => {
  cleanup();
});

describe("PersonColumnHeader", () => {
  it("hiển thị nhãn 2 dòng với tooltip đầy đủ", () => {
    render(
      <table>
        <thead>
          <tr>
            <th>
              <PersonColumnHeader columnKey="person_import" />
            </th>
          </tr>
        </thead>
      </table>
    );

    expect(screen.getByText("Phụ trách")).toBeInTheDocument();
    expect(screen.getByText("Nhập")).toBeInTheDocument();
    const header = screen.getByTitle("Người phụ trách Nhập");
    expect(header).toHaveAttribute("data-column", "person_import");
  });
});

describe("AssigneeCell", () => {
  it("giới hạn hiển thị ở 2 dòng cho chế độ xem", () => {
    const longName = "Nguyễn Thị Thanh Hương - Bộ phận Logistics Quốc tế";
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <AssigneeCell
                value={longName}
                isReadOnly
                historyEntries={[]}
                historyLabel="Phụ trách Nhập"
                showTeamHint
                teamValue="Nhóm 1"
              />
            </td>
          </tr>
        </tbody>
      </table>
    );

    const display = screen.getByText(longName);
    expect(display).toHaveAttribute("data-assignee-state", "filled");
    expect(display).toHaveStyle({ WebkitLineClamp: "2" });
    expect(screen.getByText("Tổ: Nhóm 1")).toBeInTheDocument();
  });

  it("hiển thị nút chọn nhân viên ở chế độ chỉnh sửa", () => {
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <AssigneeCell
                value=""
                isReadOnly={false}
                placeholder="Chọn nhân viên nhập"
                teams={[]}
                teamValue=""
                historyEntries={[]}
                historyLabel="Phụ trách Nhập"
              />
            </td>
          </tr>
        </tbody>
      </table>
    );

    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeInTheDocument();
    expect(screen.getByText("Chọn nhân viên nhập")).toBeInTheDocument();
  });
});
