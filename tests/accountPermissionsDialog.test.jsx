import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AccountPermissionsDialog from "@/components/account-manager/AccountPermissionsDialog.jsx";

describe("AccountPermissionsDialog", () => {
  it("hiển thị thông tin tài khoản và forward hành động dialog", async () => {
    const user = userEvent.setup();
    const onTogglePermission = vi.fn();
    const onScrollToTop = vi.fn();
    const onScrollToBottom = vi.fn();
    const onClose = vi.fn();

    render(
      <AccountPermissionsDialog
        open
        onOpenChange={vi.fn()}
        permissionAccount={{
          username: "nhanvien",
          name: "Nguyễn Văn A",
          teamName: "Tổ Thuế A",
          role: "staff",
          permissions: { alertsManage: false },
        }}
        permissionAccountPending={false}
        groupedPermissions={[
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
        ]}
        collapsedPermissionGroups={new Set()}
        allPermissionGroupsCollapsed={false}
        noPermissionGroupCollapsed
        canScrollUp
        canScrollDown
        scrollRootRef={createRef()}
        scrollViewportRef={createRef()}
        onTogglePermissionGroup={vi.fn()}
        onCollapseAllPermissionGroups={vi.fn()}
        onExpandAllPermissionGroups={vi.fn()}
        onTogglePermission={onTogglePermission}
        onScrollToTop={onScrollToTop}
        onScrollToBottom={onScrollToBottom}
        onClose={onClose}
      />
    );

    expect(await screen.findByRole("dialog", { name: "Quản lý quyền" })).toBeInTheDocument();
    expect(screen.getByText("nhanvien")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("Tổ Thuế A")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Cuộn lên đầu" }));
    await user.click(screen.getByRole("button", { name: "Cuộn xuống cuối" }));
    await user.click(screen.getByRole("button", { name: "Đóng" }));

    expect(onTogglePermission).toHaveBeenCalledWith("alertsManage", true);
    expect(onScrollToTop).toHaveBeenCalledTimes(1);
    expect(onScrollToBottom).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
