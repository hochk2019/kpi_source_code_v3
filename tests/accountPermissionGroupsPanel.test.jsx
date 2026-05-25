import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AccountPermissionGroupsPanel from "@/components/account-manager/AccountPermissionGroupsPanel.jsx";


const groups = [
  {
    category: "Quản trị hệ thống",
    items: [
      {
        key: "accountManage",
        label: "Quản lý tài khoản",
        description: "Tạo và cập nhật tài khoản người dùng.",
      },
      {
        key: "rulesEdit",
        label: "Quy tắc KPI",
        description: "Chỉnh sửa công thức KPI.",
      },
    ],
  },
];


describe("AccountPermissionGroupsPanel", () => {
  it("hiển thị count và trạng thái thu gọn cho biến thể compact", async () => {
    const user = userEvent.setup();
    const onToggleGroup = vi.fn();
    const onPermissionChange = vi.fn();
    const countLabelFormatter = (enabledCount, totalCount) => `${enabledCount}/${totalCount} quyền`;
    const { rerender } = render(
      <AccountPermissionGroupsPanel
        groups={groups}
        permissionValues={{ accountManage: true, rulesEdit: false }}
        collapsedGroups={new Set()}
        onToggleGroup={onToggleGroup}
        scope="account-create"
        onPermissionChange={onPermissionChange}
        countLabelFormatter={countLabelFormatter}
        headingVariant="compact"
      />
    );

    expect(screen.getByText(/Quản trị hệ thống/i)).toBeInTheDocument();
    expect(screen.getByText(/1\/2 quyền/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thu gọn" }));
    expect(onToggleGroup).toHaveBeenCalledWith("Quản trị hệ thống");

    rerender(
      <AccountPermissionGroupsPanel
        groups={groups}
        permissionValues={{ accountManage: true, rulesEdit: false }}
        collapsedGroups={new Set(["Quản trị hệ thống"])}
        onToggleGroup={onToggleGroup}
        scope="account-create"
        onPermissionChange={onPermissionChange}
        countLabelFormatter={countLabelFormatter}
        headingVariant="compact"
      />
    );

    expect(screen.getByRole("button", { name: "Mở rộng" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox", { name: "Quy tắc KPI" })).not.toBeInTheDocument();
  });

  it("khóa checkbox theo predicate và gửi thay đổi cho quyền đang bật", async () => {
    const user = userEvent.setup();
    const onPermissionChange = vi.fn();

    render(
      <AccountPermissionGroupsPanel
        groups={groups}
        permissionValues={{ accountManage: true, rulesEdit: false }}
        collapsedGroups={new Set()}
        onToggleGroup={vi.fn()}
        scope="permission-dialog"
        onPermissionChange={onPermissionChange}
        isPermissionDisabled={(item) => item.key === "accountManage"}
        countLabelFormatter={(enabledCount, totalCount) => `${enabledCount}/${totalCount} quyền đang bật`}
      />
    );

    expect(screen.getByText(/1\/2 quyền đang bật/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Quản lý tài khoản/i })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /Quy tắc KPI/i }));
    expect(onPermissionChange).toHaveBeenCalledWith("rulesEdit", true);
  });
});
