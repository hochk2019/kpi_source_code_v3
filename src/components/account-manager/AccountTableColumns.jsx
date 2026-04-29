// AccountTableColumns.jsx
// Column renderers for AccountManager DataTable

import React from 'react';
import { StatusBadge } from '@/components/designSystem/primitives.jsx';

export function buildAccountTableColumns({
  pendingAccounts,
  onOpenPermissionDialog,
  onOpenDeleteDialog,
}) {
  const renderPermissionCell = (account) => {
    const isPending = pendingAccounts.has(account.username);
    const permissionSummary = account.permissions?.summary || {};
    const hasCustom = permissionSummary.hasCustom || false;
    const roleLabel = account.roleLabel || 'Chưa phân quyền';

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={hasCustom ? 'warning' : 'success'}>
            {roleLabel}
          </StatusBadge>
          {isPending && <span className="text-xs text-amber-600">Đang cập nhật...</span>}
        </div>
        <button
          onClick={() => onOpenPermissionDialog(account)}
          className="text-xs text-blue-600 hover:underline"
        >
          {hasCustom ? 'Sửa quyền' : 'Phân quyền'}
        </button>
      </div>
    );
  };

  const renderActionsCell = (account) => {
    const isPending = pendingAccounts.has(account.username);
    return (
      <div className="space-y-2">
        <button
          onClick={() => onOpenDeleteDialog(account)}
          disabled={isPending}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          Xóa
        </button>
      </div>
    );
  };

  return [
    {
      key: 'username',
      header: 'Tài khoản',
      cell: (account) => (
        <div className="font-medium">{account.username}</div>
      ),
    },
    {
      key: 'staff',
      header: 'Nhân viên',
      cell: (account) => (
        <div>{account.staffName || account.staffId || '-'}</div>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      cell: renderPermissionCell,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      cell: renderActionsCell,
    },
  ];
}
