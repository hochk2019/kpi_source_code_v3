import React from "react";

import {
  ADMIN_ROLE,
  ROLE_OPTIONS,
  getPasswordMinLengthPlaceholder,
} from "@/auth/localAuth.js";
import { t } from "@/lib/i18n.js";
import { FilterSelect, StatusBadge } from "@/components/designSystem/primitives.jsx";
import { SectionHeader } from "@/components/designSystem/shellPrimitives.tsx";
import AccountPermissionGroupsPanel from "@/components/account-manager/AccountPermissionGroupsPanel.jsx";
import {
  CONTROL_CLASS,
  GROUP_TOGGLE_BUTTON_CLASS,
} from "@/components/account-manager/accountManagerPermissions.js";
import StaffCombobox from "@/components/shared/StaffCombobox.tsx";

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
        title={t('account.createNew')}
        description={t('account.createDescription')}
      />

      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">{t('form.username')}</label>
          <input
            className={CONTROL_CLASS}
            value={form.username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="username"
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">{t('form.staffLabel')}</label>
          <StaffCombobox
            value={form.memberId}
            onSelect={onSelectStaff}
            teams={staffTeams}
            disabled={staffOptions.length === 0}
            ariaLabel={t('form.staffAriaLabel')}
            selectionMode="member"
            searchPlaceholder={t('form.searchStaff')}
            clearGroupLabel={t('form.clearGroupLabel')}
            clearLabel={t('form.clearLabel')}
            showClearWhenEmpty
            buttonClassName={`${CONTROL_CLASS} flex w-full items-center justify-between gap-2 text-left ${staffOptions.length === 0 ? "cursor-not-allowed opacity-60" : ""
              }`}
            popoverClassName="w-[320px] p-0"
            groupHeadingFormatter={(team) => team.name}
          />
          {form.memberId ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              {t('form.willLink', { name: form.memberName || form.memberId })}
              {form.teamName ? ` • ${form.teamName}` : ""}
            </p>
          ) : (
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              {t('form.optionalLink')}
            </p>
          )}
          {staffOptions.length === 0 ? (
            <StatusBadge tone="warning">
              {t('form.noStaff')}
            </StatusBadge>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">{t('form.displayName')}</label>
          <input
            className={CONTROL_CLASS}
            value={form.name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t('form.displayNamePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">{t('form.passwordTemp')}</label>
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
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">{t('form.role')}</label>
          <FilterSelect
            value={form.role}
            onChange={onRoleChange}
            options={ROLE_OPTIONS}
            placeholder={t('form.selectRole')}
            triggerClassName="w-full"
          />
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[color:var(--ds-text-primary)]">{t('form.permissions')}</div>
              <p className="text-xs text-[color:var(--ds-text-muted)]">
                {t('form.permissionsDescription')}
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
          </div>

          <AccountPermissionGroupsPanel
            groups={groupedPermissions}
            permissionValues={form.permissions}
            collapsedGroups={collapsedPermissionGroups}
            onToggleGroup={onTogglePermissionGroup}
            scope="account-create"
            onPermissionChange={onPermissionChange}
            isPermissionDisabled={(item) => item.key === "accountManage" && form.role !== ADMIN_ROLE}
            countLabelFormatter={(enabledCount, totalCount) => t('permission.countShort', { enabled: enabledCount, total: totalCount })}
            headingVariant="compact"
          />
        </div>

        {error ? <div className="md:col-span-2 text-sm text-red-600">{error}</div> : null}

        <div className="md:col-span-2 flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-200/40 dark:border-slate-700/40">
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-teal-700 hover:to-teal-600 focus:ring-2 focus:ring-teal-500/50"
            data-tooltip={t('account.createTooltip')}
          >
            {t('common.create')}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-200/60 bg-white/50 px-5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800"
            data-tooltip={t('account.resetTooltip')}
          >
            {t('common.reset')}
          </button>
        </div>
      </form>
    </>
  );
}
