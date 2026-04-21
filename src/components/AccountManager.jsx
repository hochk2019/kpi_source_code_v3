import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
  SearchField,
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.jsx";
import AccountCreateFormPanel from "@/components/account-manager/AccountCreateFormPanel.jsx";
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



export default function AccountManager() {

  const [accounts, setAccounts] = useState(() => listAccounts());

  const [error, setError] = useState("");

  const [form, setForm] = useState(() => createEmptyAccountForm());

  const [searchTerm, setSearchTerm] = useState("");

  const [roster, setRoster] = useState(() => getTeamRoster());

  const [pendingAccounts, setPendingAccounts] = useState(() => new Set());

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [accountToDelete, setAccountToDelete] = useState(null);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [deleteError, setDeleteError] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);

  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);

  const [permissionAccountUsername, setPermissionAccountUsername] = useState(null);
  const permissionScrollRootRef = useRef(null);
  const permissionScrollViewportRef = useRef(null);
  const [permissionScrollState, setPermissionScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
  });



  const refresh = useCallback(async () => {

    try {

      const updated = await reloadAccounts();

      setAccounts(updated);

    } catch (err) {

      console.error(err);

      setError(err?.message || "Không thể tải danh sách tài khoản");

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

  const [collapsedPermissionGroups, setCollapsedPermissionGroups] = useState(() => new Set());

  useEffect(() => {
    const allowedCategories = new Set(groupedPermissions.map((group) => group.category));
    setCollapsedPermissionGroups((previous) => {
      let changed = false;
      const next = new Set();
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

      alert("Đã tạo tài khoản mới.");

      resetForm();

      setAccounts(listAccounts());

    } catch (err) {

      setError(err?.message || "Không thể tạo tài khoản");

    }

  };



  const updateFormRole = (role) => {

    const normalized = normalizeRole(role);

    setForm((prev) => ({

      ...prev,

      role: normalized,

      permissions: getPermissionTemplate(normalized),

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

        alert("Đã cập nhật nhân viên gắn với tài khoản.");

      } catch (err) {

        alert(err?.message || "Không thể cập nhật nhân viên");

      } finally {

        setAccountPending(username, false);

      }

    },

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

        alert(err?.message || "Không thể cập nhật quyền");

      }

    },

    [accounts]

  );



  const changeRole = useCallback(

    async (username, role) => {

      try {

        const normalized = normalizeRole(role);

        await updateAccount(username, { role: normalized });

        setAccounts(listAccounts());

      } catch (err) {

        alert(err?.message || "Không thể cập nhật vai trò");

      }

    },

    []

  );



  const resetPassword = useCallback(

    async (username) => {

      const nextPassword = window.prompt(`Nhập mật khẩu mới cho ${username} (>={MIN_PASSWORD_LENGTH} ký tự):`);

      if (!nextPassword) return;

      try {

        await setAccountPassword(username, nextPassword);

        alert(`Đã đặt lại mật khẩu cho ${username}.`);

      } catch (err) {

        alert(err?.message || "Không thể đặt lại mật khẩu");

      }

    },

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

      setDeleteError("Vui lòng nhập chính xác tên tài khoản để xác nhận xoá.");

      return;

    }

    setIsDeleting(true);

    try {

      await deleteAccount(username);

      setAccounts(listAccounts());

      closeDeleteDialog();

    } catch (err) {

      setDeleteError(err?.message || "Không thể xóa tài khoản");

    } finally {

      setIsDeleting(false);

    }

  }, [accountToDelete, closeDeleteDialog, deleteConfirmText]);



  const accountColumns = useMemo(

    () => [

      {

        key: "username",

        label: "Tài khoản",

        width: "160px",

        cell: (account) => (

          <div className="font-semibold text-[color:var(--ds-text-primary)]">{account.username}</div>

        ),

      },

      {

        key: "name",

        label: "Họ tên",

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

        label: "Nhân viên KPI",

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

                ariaLabel={`Nhân viên KPI cho ${account.username}`}

                dataTestId={`account-staff-${account.username}`}

                selectionMode="member"

                searchPlaceholder="Tìm theo tên nhân viên hoặc tổ đội…"

                clearGroupLabel="Tùy chọn chung"

                clearLabel="Không gắn nhân viên"

                showClearWhenEmpty

                buttonClassName={`${CONTROL_CLASS} flex w-full items-center justify-between gap-2 text-left ${rosterMissing || isPending ? "cursor-not-allowed opacity-60" : ""}`}

                popoverClassName="w-[320px] p-0"

                groupHeadingFormatter={(team) => team.name}

              />

              {rosterMissing ? (

                <StatusBadge tone="warning">Chưa có dữ liệu tổ đội</StatusBadge>

              ) : account.memberId ? (

                inRoster ? (

                  <p className="text-xs text-[color:var(--ds-text-muted)]">

                    Đang gắn với {account.memberName || account.memberId}

                    {account.teamName ? ` • ${account.teamName}` : ""}

                  </p>

                ) : (

                  <StatusBadge tone="warning">Nhân viên này không còn trong danh sách KPI</StatusBadge>

                )

              ) : (

                <StatusBadge tone="neutral">Chưa gắn nhân viên KPI</StatusBadge>

              )}

              {isPending && <StatusBadge tone="info">Đang lưu thay đổi…</StatusBadge>}

            </div>

          );

        },

      },

      {

        key: "role",

        label: "Vai trò",

        width: "180px",

        cell: (account) => (

          <FilterSelect

            value={account.role}

            onChange={(value) => changeRole(account.username, value)}

            options={ROLE_OPTIONS}

            placeholder="Chọn vai trò"

            triggerClassName="w-full"

            disabled={pendingAccounts.has(account.username)}

          />

        ),

      },

      {

        key: "permissions",

        label: "Quyền chức năng",

        cell: (account) => {

          const totalPermissions = permissionDefinitions.length;

          const enabledCount = permissionDefinitions.reduce((count, definition) => {

            return account.permissions?.[definition.key] ? count + 1 : count;

          }, 0);

          const summary =

            totalPermissions === 0

              ? "Chưa cấu hình quyền"

              : enabledCount === 0

                ? "Chưa cấp quyền nào"

                : `${enabledCount}/${totalPermissions} quyền được cấp`;

          const isPending = pendingAccounts.has(account.username);

          return (

            <div className="space-y-2">

              <button

                type="button"

                onClick={() => openPermissionDialog(account)}

                className="inline-flex w-full items-center justify-center rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-xs font-semibold text-[color:var(--ds-text-primary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent-ring)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60"

                disabled={isPending}

              >

                Danh sách quyền

              </button>

              <p className="text-xs text-[color:var(--ds-text-muted)]">{summary}</p>

              {isPending && <StatusBadge tone="info">Đang lưu thay đổi…</StatusBadge>}

            </div>

          );

        },

      },
      {

        key: "actions",

        label: "Hành động",

        width: "220px",

        cell: (account) => (

          <div className="flex flex-wrap items-center gap-2">

            <button

              type="button"

              onClick={() => resetPassword(account.username)}

              className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"

            >

              Đặt lại mật khẩu

            </button>

            <button

              type="button"

              onClick={() => openDeleteDialog(account)}

              className="rounded border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"

            >

              Xóa tài khoản

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

          <p className="font-medium text-[color:var(--ds-text-primary)]">Chưa có tài khoản nào.</p>

          <p className="text-[color:var(--ds-text-muted)]">Sử dụng biểu mẫu phía trên để tạo tài khoản đầu tiên.</p>

        </div>

      );

    }

    return <div className="text-sm text-[color:var(--ds-text-muted)]">Không tìm thấy tài khoản phù hợp với từ khóa hiện tại.</div>;

  }, [totalAccounts]);



  return (

    <div className="account-manager-view space-y-6">
      {/* Master Header */}
      <div className="group/hq-header relative mb-6">
        <div className="relative overflow-hidden rounded-2xl border border-teal-700/10 bg-white/60 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-teal-700/20 hover:bg-white/80 dark:border-teal-400/20 dark:bg-slate-900/60 dark:hover:bg-slate-900/80">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-50/40 via-transparent to-primary/5 dark:from-teal-900/20 dark:to-transparent" />

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-1.5 max-w-2xl">
              <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Quản trị Tài khoản Hệ thống
              </h2>
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Quản lý tài khoản đăng nhập cho hệ thống KPI, gán quyền và nhân viên phụ trách theo từng tổ đội.
              </p>
              <div className="mt-2 flex items-center gap-3 text-[0.8rem] text-slate-500 dark:text-slate-400">
                <span className="hidden sm:inline-block">Mọi thao tác đều được ghi nhận trong màn hình Giám sát.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Creation Form Container */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/10 bg-white/40 p-6 shadow-sm backdrop-blur-md dark:border-amber-400/10 dark:bg-slate-900/40">
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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/60">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/40 dark:border-slate-700/40 pb-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Danh sách tài khoản
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100/50 px-2.5 py-0.5 border border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-700/50 text-xs text-slate-500 font-normal">
                {visibleAccounts}/{totalAccounts} hiển thị
              </span>
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Theo dõi quyền truy cập và trạng thái gắn nhân viên.</p>
          </div>

          <div className="w-full sm:max-w-xs relative">
            <input
              className="w-full rounded-xl border border-slate-200/60 bg-white/40 px-3 py-2 pl-9 text-sm text-slate-800 placeholder-slate-400 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800 transition-all"
              placeholder="Tìm theo tài khoản, họ tên..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {hasSearch && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/50 bg-white/30 dark:border-slate-700/50 dark:bg-slate-800/30">
          <DataTable
            columns={accountColumns}
            data={filteredAccounts}
            rowKey={(account) => account.username}
            density="comfortable"
            zebra
            stickyHeader
            ariaLabel="Danh sách tài khoản KPI"
            caption={`Danh sách ${visibleAccounts} trên ${totalAccounts} tài khoản sau khi lọc.`}
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



      <AppDialog open={deleteDialogOpen} onOpenChange={(open) => (open ? setDeleteDialogOpen(true) : closeDeleteDialog())}>

        <AppDialogContent size="sm">

          <AppDialogHeader>

            <AppDialogTitle>Xóa tài khoản</AppDialogTitle>

            <AppDialogDescription>

              {accountToDelete

                ? `Thao tác này sẽ xóa vĩnh viễn tài khoản ${accountToDelete.username} khỏi hệ thống.`

                : "Xác nhận xóa tài khoản khỏi hệ thống."}

            </AppDialogDescription>

          </AppDialogHeader>

          <div className="space-y-4 px-6 pb-4 pt-2">

            {accountToDelete && (

              <div className="space-y-1 text-sm text-[color:var(--ds-text-secondary)]">

                {accountToDelete.name && accountToDelete.name !== accountToDelete.username ? (

                  <p>

                    <strong>Họ tên:</strong> {accountToDelete.name}

                  </p>

                ) : null}

                {accountToDelete.memberName ? (

                  <p>

                    <strong>Nhân viên KPI:</strong> {accountToDelete.memberName}

                    {accountToDelete.teamName ? ` • ${accountToDelete.teamName}` : ""}

                  </p>

                ) : (

                  <p className="text-[color:var(--ds-text-muted)]">Tài khoản chưa gắn nhân viên KPI.</p>

                )}

                <p className="text-[color:var(--ds-text-muted)]">

                  Tài khoản sẽ bị đăng xuất ngay sau khi xoá và không thể phục hồi.

                </p>

              </div>

            )}

            <div className="space-y-2">

              <label className="text-sm font-medium text-[color:var(--ds-text-primary)]" htmlFor="delete-confirm-input">

                Nhập lại tên tài khoản để xác nhận

              </label>

              <input

                id="delete-confirm-input"

                className={CONTROL_CLASS}

                value={deleteConfirmText}

                onChange={(event) => {

                  setDeleteConfirmText(event.target.value);

                  if (deleteError) {

                    setDeleteError("");

                  }

                }}

                placeholder="username"

              />

            </div>

            {deleteError && <p className="text-sm text-rose-600">{deleteError}</p>}

          </div>

          <AppDialogFooter>

            <AppDialogClose asChild>

              <button

                type="button"

                className="rounded border border-[color:var(--ds-border-subtle)] px-4 py-2 text-sm text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"

              >

                Hủy

              </button>

            </AppDialogClose>

            <button

              type="button"

              onClick={handleConfirmDelete}

              disabled={isDeleting}

              className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"

            >

              Xóa vĩnh viễn

            </button>

          </AppDialogFooter>

        </AppDialogContent>

      </AppDialog>

    </div>

  );

}


