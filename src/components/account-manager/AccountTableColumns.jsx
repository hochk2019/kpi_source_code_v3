// AccountTableColumns.jsx
// Column renderers for AccountManager DataTable

import React from 'react';
import { StatusBadge } from '@/components/designSystem/primitives.jsx';
import { t } from '@/lib/i18n.js';

export function buildAccountTableColumns({
  pendingAccounts,
  onOpenPermissionDialog,
  onOpenDeleteDialog,
}) {
  const renderPermissionCell = (account) => {
    const isPending = pendingAccounts.has(account.username);
    const permissionSummary = account.permissions?.summary || {};
    const hasCustom = permissionSummary.hasCustom || false;
    const roleLabel = account.roleLabel || t('permission.noAssignment');

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={hasCustom ? 'warning' : 'success'}>
            {roleLabel}
          </StatusBadge>
          {isPending && <span className="text-xs text-amber-600">{t('common.loading')}</span>}
        </div>
        <button
          onClick={() => onOpenPermissionDialog(account)}
          className="text-xs text-blue-600 hover:underline"
        >
          {hasCustom ? t('permission.edit') : t('permission.assign')}
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
          {t('common.delete')}
        </button>
      </div>
    );
  };

  return [
    {
      key: 'username',
      header: t('table.column.account'),
      cell: (account) => (
        <div className="font-medium">{account.username}</div>
      ),
    },
    {
      key: 'staff',
      header: t('table.column.staff'),
      cell: (account) => (
        <div>{account.staffName || account.staffId || '-'}</div>
      ),
    },
    {
      key: 'role',
      header: t('table.column.role'),
      cell: renderPermissionCell,
    },
    {
      key: 'actions',
      header: t('table.column.actions'),
      cell: renderActionsCell,
    },
  ];
}
