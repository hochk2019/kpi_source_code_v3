import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  buildGroupedPermissions,
  buildPermissionDefinitions,
} from "@/components/account-manager/accountManagerPermissions.js";
import { createEmptyAccountForm } from "@/components/account-manager/accountManagerFormState.js";
import {
  buildStaffComboboxTeams,
  flattenStaffComboboxMembers,
} from "@/components/shared/staffComboboxOptions.js";

/**
 * Hook for managing account creation, deletion, permissions, and staff assignment
 * @returns {object} Account manager state and actions
 */
export function useAccountManager() {
  // State
  const [accounts, setAccounts] = useState(() => listAccounts());
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => createEmptyAccountForm());
  const [searchTerm, setSearchTerm] = useState("");
  const [roster, setRoster] = useState(() => getTeamRoster());
  const [pendingAccounts, setPendingAccounts] = useState(() => new Set());

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Permission dialog state
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [permissionAccountUsername, setPermissionAccountUsername] = useState(null);
  const permissionScrollRootRef = useRef(null);
  const permissionScrollViewportRef = useRef(null);
  const [permissionScrollState, setPermissionScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
  });

  // Refresh accounts
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

  // Subscribe to team roster
  useEffect(() => {
    const unsubscribe = subscribeTeamRoster((next) => setRoster(next));
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Staff options
  const staffTeams = useMemo(() => buildStaffComboboxTeams(roster), [roster]);
  const staffOptions = useMemo(() => flattenStaffComboboxMembers(staffTeams), [staffTeams]);
  const staffLookup = useMemo(() => {
    const map = new Map();
    for (const option of staffOptions) {
      map.set(option.id, option);
    }
    return map;
  }, [staffOptions]);

  // Permissions
  const permissionDefinitions = useMemo(() => buildPermissionDefinitions(PERMISSION_KEYS), []);
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

  // Scroll handling
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
      setPermissionScrollState({
        canScrollUp: viewport.scrollTop > 0,
        canScrollDown: viewport.scrollTop < maxOffset - 1,
      });
    };
    updateScrollState();
    viewport.addEventListener("scroll", updateScrollState, { passive: true });
    const id = setInterval(updateScrollState, 300);
    return () => {
      viewport.removeEventListener("scroll", updateScrollState);
      clearInterval(id);
    };
  }, [permissionDialogOpen, getPermissionViewport]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) => {
      const matchUsername = (account.username || "").toLowerCase().includes(term);
      const matchRole = (account.role || "").toLowerCase().includes(term);
      const matchName = (account.memberName || "").toLowerCase().includes(term);
      const matchTeam = (account.teamName || "").toLowerCase().includes(term);
      return matchUsername || matchRole || matchName || matchTeam;
    });
  }, [accounts, searchTerm]);

  const totalAccounts = accounts.length;

  // Form handlers
  const handleFormChange = useCallback((updates) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const username = form.username?.trim();
    const password = form.password || "";
    const confirmPassword = form.confirmPassword || "";
    const role = normalizeRole(form.role);

    if (!username) {
      setError("Vui lòng nhập tên đăng nhập");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setError("");
    setPendingAccounts((prev) => new Set(prev).add(username));

    try {
      await createAccount({ username, password, role });
      await refresh();
      setForm(createEmptyAccountForm());
    } catch (err) {
      setError(err?.message || "Không thể tạo tài khoản");
    } finally {
      setPendingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    }
  }, [form, refresh]);

  // Delete handlers
  const openDeleteDialog = useCallback((account) => {
    setAccountToDelete(account);
    setDeleteConfirmText("");
    setDeleteError("");
    setDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setAccountToDelete(null);
    setDeleteConfirmText("");
    setDeleteError("");
  }, []);

  const handleDelete = useCallback(async () => {
    if (!accountToDelete) return;
    const targetUsername = accountToDelete.username;
    const expected = targetUsername.toLowerCase().trim();
    const actual = deleteConfirmText.toLowerCase().trim();

    if (expected !== actual) {
      setDeleteError("Tên xác nhận không khớp");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteAccount(targetUsername);
      await refresh();
      closeDeleteDialog();
    } catch (err) {
      setDeleteError(err?.message || "Không thể xóa tài khoản");
    } finally {
      setIsDeleting(false);
    }
  }, [accountToDelete, deleteConfirmText, refresh, closeDeleteDialog]);

  // Permission handlers
  const openPermissionDialog = useCallback((username) => {
    setPermissionAccountUsername(username);
    setPermissionDialogOpen(true);
  }, []);

  const closePermissionDialog = useCallback(() => {
    setPermissionDialogOpen(false);
    setPermissionAccountUsername(null);
  }, []);

  const handlePermissionChange = useCallback(async (username, newPermissions) => {
    setPendingAccounts((prev) => new Set(prev).add(username));
    try {
      const account = accounts.find((a) => a.username === username);
      if (!account) return;
      await updateAccount({
        username,
        updates: { permissions: newPermissions },
      });
      await refresh();
    } catch (err) {
       
      console.error("Failed to update permissions:", err);
    } finally {
      setPendingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    }
  }, [accounts, refresh]);

  // Staff assignment
  const updateAccountStaff = useCallback(async (username, option) => {
    setPendingAccounts((prev) => new Set(prev).add(username));
    try {
      const account = accounts.find((a) => a.username === username);
      if (!account) return;

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

      await updateAccount({
        username,
        updates: {
          memberId: nextState.memberId || null,
          memberName: nextState.memberName || null,
          teamId: nextState.teamId || null,
          teamName: nextState.teamName || null,
        },
      });
      await refresh();
    } catch (err) {
       
      console.error("Failed to update account staff:", err);
    } finally {
      setPendingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    }
  }, [accounts, refresh]);

  // Password reset
  const resetPassword = useCallback(async (username, newPassword) => {
    setPendingAccounts((prev) => new Set(prev).add(username));
    try {
      await setAccountPassword({ username, password: newPassword });
      await refresh();
    } catch (err) {
       
      console.error("Failed to reset password:", err);
      throw err;
    } finally {
      setPendingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    }
  }, [refresh]);

  // Derived state
  const isLoading = pendingAccounts.size > 0;
  const permissionAccount = useMemo(() => {
    if (!permissionAccountUsername) return null;
    return accounts.find((a) => a.username === permissionAccountUsername) || null;
  }, [accounts, permissionAccountUsername]);
  const permissionTemplate = useMemo(() => {
    if (!permissionAccount) return null;
    return getPermissionTemplate(permissionAccount);
  }, [permissionAccount]);

  return {
    // State
    accounts,
    error,
    form,
    searchTerm,
    filteredAccounts,
    totalAccounts,
    isLoading,
    pendingAccounts,
    deleteDialogOpen,
    accountToDelete,
    deleteConfirmText,
    deleteError,
    isDeleting,
    permissionDialogOpen,
    permissionAccount,
    permissionTemplate,
    permissionScrollRootRef,
    permissionScrollViewportRef,
    permissionScrollState,
    collapsedPermissionGroups,
    groupedPermissions,
    allPermissionGroupsCollapsed,
    noPermissionGroupCollapsed,
    staffOptions,
    staffLookup,
    staffTeams,
    ROLE_OPTIONS,
    ADMIN_ROLE,

    // Actions
    setError,
    setSearchTerm,
    handleFormChange,
    handleSubmit,
    openDeleteDialog,
    closeDeleteDialog,
    handleDelete,
    setDeleteConfirmText,
    openPermissionDialog,
    closePermissionDialog,
    handlePermissionChange,
    togglePermissionGroup,
    collapseAllPermissionGroups,
    expandAllPermissionGroups,
    scrollPermissionsToTop,
    scrollPermissionsToBottom,
    updateAccountStaff,
    resetPassword,
  };
}
