import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AccountCreateFormPanel from "@/components/account-manager/AccountCreateFormPanel.jsx";

const baseProps = {
  form: {
    username: "newuser",
    name: "",
    password: "MatKhauMoi!",
    role: "staff",
    permissions: { alertsManage: true, accountManage: false },
    memberId: "",
    memberName: "",
    teamId: "",
    teamName: "",
  },
  error: "",
  groupedPermissions: [
    {
      category: "Giám sát dữ liệu",
      items: [
        {
          key: "alertsManage",
          label: "Quản lý cảnh báo thiếu thông tin",
          description: "desc",
          category: "Giám sát dữ liệu",
        },
      ],
    },
  ],
  collapsedPermissionGroups: new Set(),
  allPermissionGroupsCollapsed: false,
  noPermissionGroupCollapsed: true,
  staffTeams: [],
  staffOptions: [],
  onSubmit: vi.fn((event) => event.preventDefault()),
  onReset: vi.fn(),
  onUsernameChange: vi.fn(),
  onNameChange: vi.fn(),
  onPasswordChange: vi.fn(),
  onSelectStaff: vi.fn(),
  onRoleChange: vi.fn(),
  onTogglePermissionGroup: vi.fn(),
  onCollapseAllPermissionGroups: vi.fn(),
  onExpandAllPermissionGroups: vi.fn(),
  onPermissionChange: vi.fn(),
};

describe("AccountCreateFormPanel", () => {
  it("hiển thị cảnh báo roster rỗng và gọi các callback toolbar", async () => {
    const user = userEvent.setup();
    const props = {
      ...baseProps,
      onReset: vi.fn(),
      onCollapseAllPermissionGroups: vi.fn(),
    };

    render(<AccountCreateFormPanel {...props} />);

    expect(screen.getByText((content) => content.includes('Chưa có dữ liệu tổ đội'))).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Nhân viên KPI cho tài khoản mới" })
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Thu gọn tất cả" }));
    await user.click(screen.getByRole("button", { name: "Nhập lại" }));

    expect(props.onCollapseAllPermissionGroups).toHaveBeenCalledTimes(1);
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });
});
