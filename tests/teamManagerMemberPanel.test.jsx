import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TeamManagerMemberPanel from "@/components/team-manager/TeamManagerMemberPanel.jsx";

function renderPanel(overrides = {}) {
  const props = {
    selectedTeam: {
      id: "team-1",
      name: "Team Alpha",
      members: [
        { id: "member-1", name: "Nguyen Van A" },
        { id: "member-2", name: "Tran Thi B" },
      ],
    },
    canEdit: true,
    isReadOnly: false,
    newMemberName: "",
    onNewMemberNameChange: vi.fn(),
    onAddMember: vi.fn((event) => event.preventDefault()),
    selectedMemberId: "member-1",
    onSelectMember: vi.fn(),
    memberAssignments: new Map([["nguyen van a", [{ mst: "0312345678" }]]]),
    activeMember: { id: "member-1", name: "Nguyen Van A" },
    memberNameDraft: "Nguyen Van A",
    onMemberNameDraftChange: vi.fn(),
    onCommitMemberName: vi.fn(),
    onMemberNameKey: vi.fn(),
    teams: [
      { id: "team-1", name: "Team Alpha" },
      { id: "team-2", name: "Team Beta" },
    ],
    selectedTeamId: "team-1",
    onMoveMember: vi.fn(),
    onRemoveMember: vi.fn(),
    memberCompanies: [{ mst: "0312345678" }],
    ...overrides,
  };

  render(<TeamManagerMemberPanel {...props} />);
  return props;
}

describe("TeamManagerMemberPanel", () => {
  it("renders member list and forwards member actions", () => {
    const props = renderPanel();

    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    expect(screen.getByText("1 DN")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tran Thi B 0 DN" }));
    expect(props.onSelectMember).toHaveBeenCalledWith("member-2");

    fireEvent.click(screen.getByRole("button", { name: "Cập nhật tên" }));
    expect(props.onCommitMemberName).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Xóa thành viên" }));
    expect(props.onRemoveMember).toHaveBeenCalledWith("member-1");
  });

  it("shows read-only guidance when editing is disabled", () => {
    renderPanel({
      canEdit: false,
      isReadOnly: true,
      activeMember: null,
      memberCompanies: [],
    });

    expect(
      screen.getByText("Đăng nhập bằng tài khoản được cấp quyền để thêm thành viên mới."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chọn một thành viên để xem chi tiết và lịch sử doanh nghiệp được phân công."),
    ).toBeInTheDocument();
  });
});
