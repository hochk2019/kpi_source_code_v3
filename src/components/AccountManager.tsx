import React, { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthAccountView } from '@/types';
import { useAppDialog } from '@/hooks/useAppDialog';
import { t } from '@/lib/i18n.js';

import {

  listAccounts,

  reloadAccounts,

  createAccount,

  updateAccount,

  setAccountPassword,

  deleteAccount,

  getPermissionTemplate,

  PERMISSION_KEYS,

  ROLE_OPTIONS,

  ADMIN_ROLE,

  MIN_PASSWORD_LENGTH,

  normalizeRole,

} from "@/auth/localAuth.js";

import { getTeamRoster, subscribeTeamRoster } from "@/lib/store.js";

import {

  DataTable,

  FilterSelect,

  StatusBadge,

  AppDialog,

  AppDialogClose,

  AppDialogContent,

  AppDialogDescription,

  AppDialogFooter,

  AppDialogHeader,

  AppDialogTitle,

} from "@/components/designSystem/primitives.jsx";
import { PageHeader } from "@/components/designSystem/PageHeader";
import {
  SearchField,
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.tsx";
import AccountCreateFormPanel from "@/components/account-manager/AccountCreateFormPanel.jsx";
import AccountDeleteDialog from "@/components/account-manager/AccountDeleteDialog.jsx";
import AccountPermissionsDialog from "@/components/account-manager/AccountPermissionsDialog.jsx";
import {
  CONTROL_CLASS,
  buildGroupedPermissions,
  buildPermissionDefinitions,
} from "@/components/account-manager/accountManagerPermissions.js";
import { createEmptyAccountForm } from "@/components/account-manager/accountManagerFormState.js";
import StaffCombobox from "@/components/shared/StaffCombobox.jsx";
import {
  buildStaffComboboxTeams,
  flattenStaffComboboxMembers,
} from "@/components/shared/staffComboboxOptions.js";

interface AccountFormState {
  username: string;
  name: string;
  password: string;
  role: string;
  permissions: Record<string, boolean>;
  memberId: string;
  memberName: string;
  teamId: string;
  teamName: string;
}

interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
}

interface PermissionGroup {
  category: string;
  definitions: PermissionDefinition[];
}

interface StaffOption {
  id: string;
  name: string;
  teamId?: string;
  teamName?: string;
}

interface ScrollState {
  canScrollUp: boolean;
  canScrollDown: boolean;
}

interface AccountManagerProps {
  currentUser?: AuthAccountView;
}

export default function AccountManager({ currentUser }: AccountManagerProps) {
  const { alert } = useAppDialog();

  const [accounts, setAccounts] = useState<AuthAccountView[]>(() => listAccounts());

  const [error, setError] = useState("");

  const [form, setForm] = useState<AccountFormState>(() => createEmptyAccountForm());

  const [searchTerm, setSearchTerm] = useState("");

  const [roster, setRoster] = useState(() => getTeamRoster() as { version: number; teams: Array<{ id: string; name: string; members: Array<{ id: string; name: string }> }> });

  const [pendingAccounts, setPendingAccounts] = useState<Set<string>>(() => new Set());

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [accountToDelete, setAccountToDelete] = useState<AuthAccountView | null>(null);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [deleteError, setDeleteError] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);

  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);

  const [permissionAccountUsername, setPermissionAccountUsername] = useState<string | null>(null);
  const permissionScrollRootRef = useRef<HTMLDivElement>(null);
  const permissionScrollViewportRef = useRef<HTMLDivElement>(null);
  const [permissionScrollState, setPermissionScrollState] = useState<ScrollState>({
    canScrollUp: false,
    canScrollDown: false,
  });



  const refresh = useCallback(async () => {

    try {

      const updated = await reloadAccounts();

      setAccounts(updated);

    } catch (err) {

      console.error(err);

      setError(err?.message || t('error.loadAccounts'));

    }

  }, []);



  useEffect(() => {

    refresh().catch(() => { });

  }, [refresh]);



  useEffect(() => {

    const unsubscribe = subscribeTeamRoster((next) => setRoster(next));

    return () => {

      if (typeof unsubscribe === "function") {

        unsubscribe();

      }

    };

  }, []);



  const staffTeams = useMemo(() => buildStaffComboboxTeams(roster), [roster]);

  const staffOptions = useMemo(() => flattenStaffComboboxMembers(staffTeams), [staffTeams]);



  const staffLookup = useMemo(() => {

    const map = new Map();

    for (const option of staffOptions) {

      map.set(option.id, option);

    }

    return map;

  }, [staffOptions]);



  const permissionDefinitions = useMemo(() => {
    return buildPermissionDefinitions(PERMISSION_KEYS);
  }, []);



  const permissionLookup = useMemo(() => {

    const map = new Map();

    for (const definition of permissionDefinitions) {

      map.set(definition.key, definition);

    }

    return map;

  }, [permissionDefinitions]);
  const groupedPermissions = useMemo(
    () => buildGroupedPermissions(permissionDefinitions),
    [permissionDefinitions]
  );

  const [collapsedPermissionGroups, setCollapsedPermissionGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const allowedCategories = new Set(groupedPermissions.map((group) => group.category));
    setCollapsedPermissionGroups((previous) => {
      let changed = false;
      const next = new Set<string>();
      for (const category of previous) {
        if (allowedCategories.has(category)) {
          next.add(category);
        } else {
          changed = true;
        }
      }
      if (!changed && next.size === previous.size) {
        return previous;
      }
      return next;
    });
  }, [groupedPermissions]);

  const togglePermissionGroup = useCallback((category) => {
    setCollapsedPermissionGroups((previous) => {
      const next = new Set(previous);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const collapseAllPermissionGroups = useCallback(() => {
    setCollapsedPermissionGroups(() => new Set(groupedPermissions.map((group) => group.category)));
  }, [groupedPermissions]);

  const expandAllPermissionGroups = useCallback(() => {
    setCollapsedPermissionGroups(() => new Set());
  }, []);

  const totalPermissionGroups = groupedPermissions.length;
  const collapsedGroupCount = collapsedPermissionGroups.size;
  const allPermissionGroupsCollapsed = totalPermissionGroups > 0 && collapsedGroupCount === totalPermissionGroups;
  const noPermissionGroupCollapsed = collapsedGroupCount === 0;


  const getPermissionViewport = useCallback(() => {
    if (permissionScrollViewportRef.current instanceof HTMLElement) {
      return permissionScrollViewportRef.current;
    }
    if (permissionScrollRootRef.current) {
      const viewport = permissionScrollRootRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport instanceof HTMLElement) {
        return viewport;
      }
    }
    return null;
  }, []);

  const scrollPermissionsToTop = useCallback(() => {
    const viewport = getPermissionViewport();
    if (!viewport) return;
    viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }, [getPermissionViewport]);

  const scrollPermissionsToBottom = useCallback(() => {
    const viewport = getPermissionViewport();
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
  }, [getPermissionViewport]);

  useEffect(() => {
    if (!permissionDialogOpen) {
      setPermissionScrollState({ canScrollUp: false, canScrollDown: false });
      return;
    }
    const viewport = getPermissionViewport();
    if (!viewport) {
      setPermissionScrollState({ canScrollUp: false, canScrollDown: false });
      return;
    }
    const updateScrollState = () => {
      const maxOffset = viewport.scrollHeight - viewport.clientHeight;
      const top = viewport.scrollTop;
      setPermissionScrollState({
        canScrollUp: top > 16,
        canScrollDown: top < maxOffset - 16,
      });
    };
    updateScrollState();
    const handleScroll = () => updateScrollState();
    viewport.addEventListener('scroll', handleScroll);
    let resizeObserver = null;
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(viewport);
      const content = viewport.firstElementChild;
      if (content instanceof Element) {
        resizeObserver.observe(content);
      }
    }
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(updateScrollState) : null;
    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
    };
  }, [
    permissionDialogOpen,
    getPermissionViewport,
    permissionAccountUsername,
    groupedPermissions,
    collapsedPermissionGroups,
  ]);

  const filteredAccounts = useMemo(() => {

    const term = searchTerm.trim().toLowerCase();

    if (!term) {

      return accounts;

    }

    return accounts.filter((account) => {

      const username = String(account.username || "").toLowerCase();

      const name = String(account.name || "").toLowerCase();

      const role = String(account.role || "").toLowerCase();

      if (username.includes(term) || name.includes(term) || role.includes(term)) {

        return true;

      }

      const memberName = String(account.memberName || "").toLowerCase();

      const teamName = String(account.teamName || "").toLowerCase();

      const memberId = String(account.memberId || "").toLowerCase();

      if (memberName.includes(term) || teamName.includes(term) || memberId.includes(term)) {

        return true;

      }

      const activePermissions = Object.entries(account.permissions || {})

        .filter(([, value]) => !!value)

        .flatMap(([key]) => {

          const definition = permissionLookup.get(key);

          if (!definition) {

            return [String(key).toLowerCase()];

          }

          const texts = [definition.label, definition.description].filter(Boolean);

          return texts.map((text) => text.toLowerCase());

        });

      return activePermissions.some((label) => label.includes(term));

    });

  }, [accounts, permissionLookup, searchTerm]);

  const totalAccounts = accounts.length;

  const visibleAccounts = filteredAccounts.length;

  const hasSearch = searchTerm.trim().length > 0;



  const resetForm = () => {
    setForm(createEmptyAccountForm());
  };



  const handleCreate = async (event) => {
    console.log('--- FORM SUBMITTED ---', form);
    event.preventDefault();

    setError("");

    try {

      const payload = {

        ...form,

        memberId: form.memberId || null,

        memberName: form.memberName || null,

        teamId: form.teamId || null,

        teamName: form.teamName || null,

      };

      await createAccount(payload);

      await alert(t('account.createSuccessAlert'));

      resetForm();

      setAccounts(listAccounts());

    } catch (err) {

      setError(err?.message || t('error.createAccount'));

    }

  };



  const updateFormRole = (role) => {

    const normalized = normalizeRole(role);

    setForm((prev) => ({

      ...prev,

      role: normalized,

      permissions: getPermissionTemplate(normalized as "admin" | "operator"),

    }));

  };



  const handleSelectStaff = useCallback((option) => {

    if (!option) {

      setForm((prev) => ({

        ...prev,

        memberId: "",

        memberName: "",

        teamId: "",

        teamName: "",

      }));

      return;

    }

    setForm((prev) => ({

      ...prev,

      memberId: option.id,

      memberName: option.name,

      teamId: option.teamId || "",

      teamName: option.teamName || "",

      name: prev.name ? prev.name : option.name,

    }));

  }, []);



  const updateFormPermission = (key, value) => {

    setForm((prev) => {

      if (key === "accountManage" && prev.role !== ADMIN_ROLE) {

        return prev;

      }

      return {

        ...prev,

        permissions: { ...prev.permissions, [key]: value },

      };

    });

  };



  const setAccountPending = useCallback((username, value) => {

    setPendingAccounts((prev) => {

      const next = new Set(prev);

      if (value) {

        next.add(username);

      } else {

        next.delete(username);

      }

      return next;

    });

  }, []);



  const permissionAccount = useMemo(() => {

    if (!permissionAccountUsername) {

      return null;

    }

    return accounts.find((account) => account.username === permissionAccountUsername) || null;

  }, [accounts, permissionAccountUsername]);

  const permissionAccountPending =
    permissionAccount?.username ? pendingAccounts.has(permissionAccount.username) : false;
  const { canScrollUp, canScrollDown } = permissionScrollState;

  const openPermissionDialog = useCallback((account) => {

    if (!account || !account.username) {

      return;

    }

    setPermissionAccountUsername(account.username);

    setPermissionDialogOpen(true);

  }, []);



  const closePermissionDialog = useCallback(() => {

    setPermissionDialogOpen(false);

    setPermissionAccountUsername(null);

  }, []);



  const updateAccountStaff = useCallback(

    async (account, option) => {

      if (!account || !account.username) {

        return;

      }

      const username = account.username;

      const normalize = (value) => (value ?? "").toString().trim();

      const currentState = {

        memberId: normalize(account.memberId),

        memberName: normalize(account.memberName),

        teamId: normalize(account.teamId),

        teamName: normalize(account.teamName),

      };

      const nextState = option

        ? {

          memberId: normalize(option.id),

          memberName: normalize(option.name),

          teamId: normalize(option.teamId),

          teamName: normalize(option.teamName),

        }

        : { memberId: "", memberName: "", teamId: "", teamName: "" };



      const unchanged =

        currentState.memberId === nextState.memberId &&

        currentState.memberName === nextState.memberName &&

        currentState.teamId === nextState.teamId &&

        currentState.teamName === nextState.teamName;



      if (unchanged) {

        return;

      }



      setAccountPending(username, true);

      try {

        await updateAccount(username, {

          memberId: nextState.memberId || null,

          memberName: nextState.memberName || null,

          teamId: nextState.teamId || null,

          teamName: nextState.teamName || null,

        });

        setAccounts(listAccounts());

        await alert(t('account.staffUpdateSuccess'));

      } catch (err) {

        await alert(err?.message || t('error.updateStaff'));

      } finally {

        setAccountPending(username, false);

      }

    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setAccountPending]

  );



  const togglePermission = useCallback(

    async (username, key, value) => {

      try {

        const target = accounts.find((account) => account.username === username);

        if (!target) return;

        if (key === "accountManage" && target.role !== ADMIN_ROLE) {

          return;

        }

        const nextPermissions = { ...target.permissions, [key]: value };

        await updateAccount(username, { permissions: nextPermissions });

        setAccounts(listAccounts());

      } catch (err) {

        await alert(err?.message || t('error.updatePermissions'));

      }

    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts]

  );



  const changeRole = useCallback(

    async (username, role) => {

      try {

        const normalized = normalizeRole(role);

        await updateAccount(username, { role: normalized });

        setAccounts(listAccounts());

      } catch (err) {

        await alert(err?.message || t('error.updateRole'));

      }

    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    []

  );



  const resetPassword = useCallback(

    async (username) => {

      const nextPassword = window.prompt(t('account.resetPasswordPrompt', { username, min: MIN_PASSWORD_LENGTH }));

      if (!nextPassword) return;

      try {

        await setAccountPassword(username, nextPassword);

        await alert(t('account.resetPasswordSuccess', { username }));

      } catch (err) {

        await alert(err?.message || t('error.resetPassword'));

      }

    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    []

  );



  const closeDeleteDialog = useCallback(() => {

    setDeleteDialogOpen(false);

    setAccountToDelete(null);

    setDeleteConfirmText("");

    setDeleteError("");

    setIsDeleting(false);

  }, []);



  const openDeleteDialog = useCallback((account) => {

    if (!account) {

      return;

    }

    setAccountToDelete(account);

    setDeleteConfirmText("");

    setDeleteError("");

    setIsDeleting(false);

    setDeleteDialogOpen(true);

  }, []);



  const handleConfirmDelete = useCallback(async () => {

    if (!accountToDelete) {

      return;

    }

    const username = accountToDelete.username;

    if (deleteConfirmText.trim().toLowerCase() !== username.toLowerCase()) {

      setDeleteError(t('account.validation.confirmDeleteText'));

      return;

    }

    setIsDeleting(true);

    try {

      await deleteAccount(username);

      setAccounts(listAccounts());

      closeDeleteDialog();

    } catch (err) {

      setDeleteError(err?.message || t('error.deleteAccount'));

    } finally {

      setIsDeleting(false);

    }

  }, [accountToDelete, closeDeleteDialog, deleteConfirmText]);



  const accountColumns = useMemo(

    () => [

      {

        key: "username",

        label: t('table.column.account'),

        width: "160px",

        cell: (account) => (

          <div className="font-semibold text-[color:var(--ds-text-primary)]">{account.username}</div>

        ),

      },

      {

        key: "name",

        label: t('table.column.fullName'),

        width: "220px",

        cell: (account) => (

          <div className="text-[color:var(--ds-text-secondary)]">

            {account.name || "—"}

            {account.teamName ? (

              <span className="block text-xs text-[color:var(--ds-text-muted)]">{account.teamName}</span>

            ) : null}

          </div>

        ),

      },

      {

        key: "staff",

        label: t('account.staff'),

        width: "220px",

        cell: (account) => {

          const rosterMissing = staffOptions.length === 0;

          const inRoster = account.memberId ? staffLookup.get(account.memberId) : null;

          const isPending = pendingAccounts.has(account.username);

          return (

            <div className="space-y-2">

              <StaffCombobox

                value={account.memberId || ""}

                onSelect={(option) => updateAccountStaff(account, option)}

                teams={staffTeams}

                disabled={rosterMissing || isPending}

                ariaLabel={t('account.staffAriaLabel', { username: account.username })}

                dataTestId={`account-staff-${account.username}`}

                selectionMode="member"

                searchPlaceholder={t('form.searchStaff')}

                clearGroupLabel={t('form.clearGroupLabel')}

                clearLabel={t('form.clearLabel')}

                showClearWhenEmpty

                buttonClassName={`${CONTROL_CLASS} flex w-full items-center justify-between gap-2 text-left ${rosterMissing || isPending ? "cursor-not-allowed opacity-60" : ""}`}

                popoverClassName="w-[320px] p-0"

                groupHeadingFormatter={(team) => team.name}

              />

              {rosterMissing ? (

                <StatusBadge tone="warning">{t('account.noTeamData')}</StatusBadge>

              ) : account.memberId ? (

                inRoster ? (

                  <p className="text-xs text-[color:var(--ds-text-muted)]">

                    {t('account.linkedWith', { name: account.memberName || account.memberId })}

                    {account.teamName ? ` • ${account.teamName}` : ""}

                  </p>

                ) : (

                  <StatusBadge tone="warning">{t('account.staffNotInList')}</StatusBadge>

                )

              ) : (

                <StatusBadge tone="neutral">{t('account.noStaffLinked')}</StatusBadge>

              )}

              {isPending && <StatusBadge tone="info">{t('account.saving')}</StatusBadge>}

            </div>

          );

        },

      },

      {

        key: "role",

        label: t('table.column.role'),

        width: "180px",

        cell: (account) => (

          <FilterSelect

            value={account.role}

            onChange={(value) => changeRole(account.username, value)}

            options={ROLE_OPTIONS}

            placeholder={t('form.selectRole')}

            triggerClassName="w-full"

            disabled={pendingAccounts.has(account.username)}

          />

        ),

      },

      {

        key: "permissions",

        label: t('account.permissions'),

        cell: (account) => {

          const totalPermissions = permissionDefinitions.length;

          const enabledCount = permissionDefinitions.reduce((count, definition) => {

            return account.permissions?.[definition.key] ? count + 1 : count;

          }, 0);

          const summary =

            totalPermissions === 0

              ? t('account.noPermissionConfig')

              : enabledCount === 0

                ? t('account.noPermissionGranted')

                : t('account.permissionGrantedCount', { enabled: enabledCount, total: totalPermissions });

          const isPending = pendingAccounts.has(account.username);

          return (

            <div className="space-y-2">

              <button

                type="button"

                onClick={() => openPermissionDialog(account)}

                className="inline-flex w-full items-center justify-center rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-xs font-semibold text-[color:var(--ds-text-primary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent-ring)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60"

                disabled={isPending}

              >

                {t('account.permissionList')}

              </button>

              <p className="text-xs text-[color:var(--ds-text-muted)]">{summary}</p>

              {isPending && <StatusBadge tone="info">{t('account.saving')}</StatusBadge>}

            </div>

          );

        },

      },
      {

        key: "actions",

        label: t('table.column.actions'),

        width: "220px",

        cell: (account) => (

          <div className="flex flex-wrap items-center gap-2">

            <button

              type="button"

              onClick={() => resetPassword(account.username)}

              className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"

            >

              {t('account.resetPasswordBtn')}

            </button>

            <button

              type="button"

              onClick={() => openDeleteDialog(account)}

              className="rounded border border-ds-destructive/30 px-3 py-1 text-xs font-semibold text-ds-destructive hover:bg-ds-destructive/10"

            >

              {t('account.deleteAccountBtn')}

            </button>

          </div>

        ),

      },

    ],

    [

      changeRole,

      openDeleteDialog,

      openPermissionDialog,

      pendingAccounts,

      permissionDefinitions,

      resetPassword,

      staffLookup,

      staffOptions,

      staffTeams,

      updateAccountStaff,

    ]

  );



  const renderAccountsEmpty = useCallback(() => {

    if (totalAccounts === 0) {

      return (

        <div className="space-y-1 text-sm text-[color:var(--ds-text-secondary)]">

          <p className="font-medium text-[color:var(--ds-text-primary)]">{t('account.emptyTitle')}</p>

          <p className="text-[color:var(--ds-text-muted)]">{t('account.emptyDescription')}</p>

        </div>

      );

    }

    return <div className="text-sm text-[color:var(--ds-text-muted)]">{t('account.noSearchResults')}</div>;

  }, [totalAccounts]);



  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  return (
    <div className="p-6 space-y-4">
      {/* Page Header */}
      <PageHeader
        eyebrow="QUẢN TRỊ"
        title={t('account.title') || "Quản lý Tài khoản"}
        info={t('account.description') || "Quản lý tài khoản người dùng, phân quyền và giám sát hoạt động"}
        meta={[
          `${accounts.length} tài khoản`,
          `${roster?.teams?.length || 0} tổ đội`,
        ]}
      />

      {/* Account Creation Form Container */}
      <div className="relative overflow-hidden rounded-2xl border border-ds-warning/10 bg-ds-surface-card/40 p-6 shadow-sm backdrop-blur-md dark:border-ds-warning/10 dark:bg-ds-surface-base/40">
        <AccountCreateFormPanel
          form={form}
          error={error}
          groupedPermissions={groupedPermissions}
          collapsedPermissionGroups={collapsedPermissionGroups}
          allPermissionGroupsCollapsed={allPermissionGroupsCollapsed}
          noPermissionGroupCollapsed={noPermissionGroupCollapsed}
          staffTeams={staffTeams}
          staffOptions={staffOptions}
          onSubmit={handleCreate}
          onReset={resetForm}
          onUsernameChange={(value) => setForm((prev) => ({ ...prev, username: value }))}
          onNameChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
          onPasswordChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
          onSelectStaff={handleSelectStaff}
          onRoleChange={updateFormRole}
          onTogglePermissionGroup={togglePermissionGroup}
          onCollapseAllPermissionGroups={collapseAllPermissionGroups}
          onExpandAllPermissionGroups={expandAllPermissionGroups}
          onPermissionChange={updateFormPermission}
        />
      </div>



      {/* Account List Container */}
      <div className="relative overflow-hidden rounded-2xl border border-ds-border-subtle/60 bg-ds-surface-card/60 p-6 shadow-sm backdrop-blur-md dark:border-ds-border-subtle/60 dark:bg-ds-surface-base/60">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ds-border-subtle/40 dark:border-ds-border-subtle/40 pb-5">
          <div>
            <h3 className="text-lg font-semibold text-ds-text-primary dark:text-ds-text-primary flex items-center gap-2">
              {t('account.listTitle')}
              <span className="flex items-center gap-1.5 rounded-full bg-ds-surface-base/50 px-2.5 py-0.5 border border-ds-border-subtle/50 dark:bg-ds-surface-base/50 dark:border-ds-border-subtle/50 text-xs text-ds-text-secondary font-normal">
                {t('account.listCount', { visible: visibleAccounts, total: totalAccounts })}
              </span>
            </h3>
            <p className="text-sm text-ds-text-secondary dark:text-ds-text-secondary mt-1">{t('account.listDescription')}</p>
          </div>

          <div className="w-full sm:max-w-xs relative">
            <input
              type="search"
              role="searchbox"
              aria-label={t('account.searchAriaLabel')}
              className="w-full rounded-xl border border-ds-border-subtle/60 bg-ds-surface-card/40 px-3 py-2 pl-9 text-sm text-ds-text-primary placeholder-ds-text-muted focus:border-ds-accent/50 focus:bg-ds-surface-card focus:outline-none focus:ring-2 focus:ring-ds-accent/20 dark:border-ds-border-subtle/60 dark:bg-ds-surface-base/40 dark:text-ds-text-primary dark:focus:bg-ds-surface-base transition-all"
              placeholder={t('account.searchPlaceholder')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {hasSearch && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-text-muted hover:text-ds-text-secondary"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-ds-border-subtle/50 bg-ds-surface-card/30 dark:border-ds-border-subtle/50 dark:bg-ds-surface-base/30">
          <DataTable
            columns={accountColumns}
            data={filteredAccounts}
            rowKey={(account) => account.username}
            density="comfortable"
            zebra
            stickyHeader
            ariaLabel={t('account.listAriaLabel')}
            caption={t('account.listCaption', { visible: visibleAccounts, total: totalAccounts })}
            emptyState={renderAccountsEmpty}
          />
        </div>
      </div>



      <AccountPermissionsDialog
        open={permissionDialogOpen}
        onOpenChange={(open) => (open ? setPermissionDialogOpen(true) : closePermissionDialog())}
        permissionAccount={permissionAccount}
        permissionAccountPending={permissionAccountPending}
        groupedPermissions={groupedPermissions}
        collapsedPermissionGroups={collapsedPermissionGroups}
        allPermissionGroupsCollapsed={allPermissionGroupsCollapsed}
        noPermissionGroupCollapsed={noPermissionGroupCollapsed}
        canScrollUp={canScrollUp}
        canScrollDown={canScrollDown}
        scrollRootRef={permissionScrollRootRef}
        scrollViewportRef={permissionScrollViewportRef}
        onTogglePermissionGroup={togglePermissionGroup}
        onCollapseAllPermissionGroups={collapseAllPermissionGroups}
        onExpandAllPermissionGroups={expandAllPermissionGroups}
        onTogglePermission={(key, value) => togglePermission(permissionAccount.username, key, value)}
        onScrollToTop={scrollPermissionsToTop}
        onScrollToBottom={scrollPermissionsToBottom}
        onClose={closePermissionDialog}
      />



      <AccountDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => (open ? setDeleteDialogOpen(true) : closeDeleteDialog())}
        account={accountToDelete}
        confirmText={deleteConfirmText}
        onConfirmTextChange={(value) => {
          setDeleteConfirmText(value);
          if (deleteError) setDeleteError("");
        }}
        onConfirm={handleConfirmDelete}
        error={deleteError}
        isDeleting={isDeleting}
      />

    </div>

  );

}


