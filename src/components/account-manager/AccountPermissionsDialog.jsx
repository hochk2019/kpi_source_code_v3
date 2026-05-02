import React from "react";

import { ADMIN_ROLE } from "@/auth/localAuth.js";
import { t } from "@/lib/i18n.js";
import {
  AppDialog,
  AppDialogClose,
  AppDialogContent,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
  StatusBadge,
} from "@/components/designSystem/primitives.jsx";
import AccountPermissionGroupsPanel from "@/components/account-manager/AccountPermissionGroupsPanel.jsx";
import { GROUP_TOGGLE_BUTTON_CLASS } from "@/components/account-manager/accountManagerPermissions.js";
import { ScrollArea } from "@/components/ui/scroll-area.jsx";

export default function AccountPermissionsDialog({
  open,
  onOpenChange,
  permissionAccount,
  permissionAccountPending,
  groupedPermissions,
  collapsedPermissionGroups,
  allPermissionGroupsCollapsed,
  noPermissionGroupCollapsed,
  canScrollUp,
  canScrollDown,
  scrollRootRef,
  scrollViewportRef,
  onTogglePermissionGroup,
  onCollapseAllPermissionGroups,
  onExpandAllPermissionGroups,
  onTogglePermission,
  onScrollToTop,
  onScrollToBottom,
  onClose,
}) {
  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="xl"
        className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-h-[85vh]"
      >
        <AppDialogHeader className="px-6 pb-3 pt-6">
          <AppDialogTitle>{t('permission.title')}</AppDialogTitle>
          <AppDialogDescription>
            {permissionAccount
              ? t('permission.description', { username: permissionAccount.username })
              : t('permission.selectAccount')}
          </AppDialogDescription>
        </AppDialogHeader>

        <ScrollArea
          ref={scrollRootRef}
          viewportRef={scrollViewportRef}
          type="always"
          className="flex-1 min-h-0 px-6 pb-6 pt-2 [--scrollbar-size:0.625rem]"
        >
          <div className="space-y-4">
            {permissionAccount ? (
              <>
                <div className="rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-subtle)] px-4 py-3 text-sm text-[color:var(--ds-text-secondary)]">
                  <p className="font-semibold text-[color:var(--ds-text-primary)]">
                    {permissionAccount.username}
                  </p>
                  {permissionAccount.name &&
                  permissionAccount.name !== permissionAccount.username ? (
                    <p className="text-xs text-[color:var(--ds-text-muted)]">
                      {permissionAccount.name}
                    </p>
                  ) : null}
                  {permissionAccount.teamName ? (
                    <p className="text-xs text-[color:var(--ds-text-muted)]">
                      {permissionAccount.teamName}
                    </p>
                  ) : null}
                </div>

                {permissionAccountPending ? (
                  <StatusBadge tone="info">{t('common.loading')}</StatusBadge>
                ) : null}

                {groupedPermissions.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[color:var(--ds-text-muted)]">
                    <button
                      type="button"
                      onClick={onCollapseAllPermissionGroups}
                      className={GROUP_TOGGLE_BUTTON_CLASS}
                      disabled={allPermissionGroupsCollapsed}
                    >
                      {t('common.collapseAll')}
                    </button>
                    <button
                      type="button"
                      onClick={onExpandAllPermissionGroups}
                      className={GROUP_TOGGLE_BUTTON_CLASS}
                      disabled={noPermissionGroupCollapsed}
                    >
                      {t('common.expandAll')}
                    </button>
                  </div>
                ) : null}

                <AccountPermissionGroupsPanel
                  groups={groupedPermissions}
                  permissionValues={permissionAccount.permissions}
                  collapsedGroups={collapsedPermissionGroups}
                  onToggleGroup={onTogglePermissionGroup}
                  scope="permission-dialog"
                  onPermissionChange={onTogglePermission}
                  isPermissionDisabled={(item) =>
                    permissionAccountPending ||
                    (item.key === "accountManage" && permissionAccount.role !== ADMIN_ROLE)
                  }
                  countLabelFormatter={(enabledCount, totalCount) =>
                    t('permission.enabledCount', { enabled: enabledCount, total: totalCount })
                  }
                />
              </>
            ) : (
              <p className="text-sm text-[color:var(--ds-text-muted)]">
                {t('permission.notFound')}
              </p>
            )}
          </div>
        </ScrollArea>

        <AppDialogFooter className="flex flex-wrap items-center justify-end gap-2 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={onScrollToTop}
            className={GROUP_TOGGLE_BUTTON_CLASS}
            disabled={!canScrollUp}
          >
            {t('common.scrollToTop')}
          </button>
          <button
            type="button"
            onClick={onScrollToBottom}
            className={GROUP_TOGGLE_BUTTON_CLASS}
            disabled={!canScrollDown}
          >
            {t('common.scrollToBottom')}
          </button>

          <AppDialogClose asChild>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded border border-[color:var(--ds-border-subtle)] px-4 py-2 text-sm font-medium text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent-ring)] focus-visible:ring-offset-0"
            >
              {t('common.close')}
            </button>
          </AppDialogClose>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
