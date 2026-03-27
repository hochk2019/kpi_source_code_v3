import React from "react";

import {
  ADMIN_ROLE,
  ROLE_OPTIONS,
  getPasswordMinLengthPlaceholder,
} from "@/auth/localAuth.js";
import { FilterSelect, StatusBadge } from "@/components/designSystem/primitives.jsx";
import { SectionHeader } from "@/components/designSystem/shellPrimitives.jsx";
import AccountPermissionGroupsPanel from "@/components/account-manager/AccountPermissionGroupsPanel.jsx";
import {
  CONTROL_CLASS,
  GROUP_TOGGLE_BUTTON_CLASS,
} from "@/components/account-manager/accountManagerPermissions.js";
import StaffCombobox from "@/components/shared/StaffCombobox.jsx";

export default function AccountCreateFormPanel({
  form,
  error,
  groupedPermissions,
  collapsedPermissionGroups,
  allPermissionGroupsCollapsed,
  noPermissionGroupCollapsed,
  staffTeams,
  staffOptions,
  onSubmit,
  onReset,
  onUsernameChange,
  onNameChange,
  onPasswordChange,
  onSelectStaff,
  onRoleChange,
  onTogglePermissionGroup,
  onCollapseAllPermissionGroups,
  onExpandAllPermissionGroups,
  onPermissionChange,
}) {
  return (
    <>
      <SectionHeader
        title="Tạo tài khoản mới"
        description="Điền thông tin đăng nhập, gắn nhân viên KPI (nếu có) và xác định quyền tương ứng trước khi tạo tài khoản."
      />

      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Tài khoản *</label>
          <input
            className={CONTROL_CLASS}
            value={form.username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="username"
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Nhân viên KPI</label>
          <StaffCombobox
            value={form.memberId}
            onSelect={onSelectStaff}
            teams={staffTeams}
            disabled={staffOptions.length === 0}
            ariaLabel="Nhân viên KPI cho tài khoản mới"
            selectionMode="member"
            searchPlaceholder="Tìm theo tên nhân viên hoặc tổ đội…"
            clearGroupLabel="Tùy chọn chung"
            clearLabel="Không gắn nhân viên"
            showClearWhenEmpty
            buttonClassName={`${CONTROL_CLASS} flex w-full items-center justify-between gap-2 text-left ${
              staffOptions.length === 0 ? "cursor-not-allowed opacity-60" : ""
            }`}
            popoverClassName="w-[320px] p-0"
            groupHeadingFormatter={(team) => team.name}
          />
          {form.memberId ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Sẽ gắn tài khoản với {form.memberName || form.memberId}
              {form.teamName ? ` • ${form.teamName}` : ""}
            </p>
          ) : (
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Tùy chọn: gắn tài khoản với nhân viên trong danh sách KPI.
            </p>
          )}
          {staffOptions.length === 0 ? (
            <StatusBadge tone="warning">
              Chưa có dữ liệu tổ đội. Hãy cập nhật trong mục Quản lý tổ đội trước.
            </StatusBadge>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Họ tên hiển thị</label>
          <input
            className={CONTROL_CLASS}
            value={form.name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Tên người dùng"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Mật khẩu tạm *</label>
          <input
            type="password"
            className={CONTROL_CLASS}
            value={form.password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder={getPasswordMinLengthPlaceholder()}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Vai trò</label>
          <FilterSelect
            value={form.role}
            onChange={onRoleChange}
            options={ROLE_OPTIONS}
            placeholder="Chọn vai trò"
            triggerClassName="w-full"
          />
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[color:var(--ds-text-primary)]">Quyền chức năng</div>
              <p className="text-xs text-[color:var(--ds-text-muted)]">
                Chọn quyền tương ứng cho tài khoản. Những quyền bị làm mờ thuộc nhóm chỉ dành cho quản trị viên.
              </p>
            </div>
            {groupedPermissions.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-[color:var(--ds-text-muted)]">
                <button
                  type="button"
                  onClick={onCollapseAllPermissionGroups}
                  className={GROUP_TOGGLE_BUTTON_CLASS}
                  disabled={allPermissionGroupsCollapsed}
                >
                  Thu gọn tất cả
                </button>
                <button
                  type="button"
                  onClick={onExpandAllPermissionGroups}
                  className={GROUP_TOGGLE_BUTTON_CLASS}
                  disabled={noPermissionGroupCollapsed}
                >
                  Mở rộng tất cả
                </button>
              </div>
            ) : null}
          </div>

          <AccountPermissionGroupsPanel
            groups={groupedPermissions}
            permissionValues={form.permissions}
            collapsedGroups={collapsedPermissionGroups}
            onToggleGroup={onTogglePermissionGroup}
            scope="account-create"
            onPermissionChange={onPermissionChange}
            isPermissionDisabled={(item) => item.key === "accountManage" && form.role !== ADMIN_ROLE}
            countLabelFormatter={(enabledCount, totalCount) => `${enabledCount}/${totalCount} quyền`}
            headingVariant="compact"
          />
        </div>

        {error ? <div className="md:col-span-2 text-sm text-red-600">{error}</div> : null}

        <div className="md:col-span-2 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            data-tooltip="Tạo tài khoản mới với thông tin và quyền đã chọn"
          >
            Tạo tài khoản
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded border border-[color:var(--ds-border-subtle)] px-4 py-2 text-sm text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
            data-tooltip="Xóa nội dung biểu mẫu và nhập lại từ đầu"
          >
            Nhập lại
          </button>
        </div>
      </form>
    </>
  );
}
