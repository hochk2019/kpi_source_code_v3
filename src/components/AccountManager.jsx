import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  DEFAULT_ROLE,
  normalizeRole,
} from "@/auth/localAuth.js";
import { getTeamRoster, subscribeTeamRoster, normalizeName, normalizeStr } from "@/lib/store.js";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.jsx";
import { Check, ChevronsUpDown, CircleX } from "lucide-react";

const PERMISSION_DETAILS = Object.freeze({
  importEdit: {
    label: "Import Data – chỉnh sửa & lưu",
    description: "Cho phép nhập file ECUS, hợp nhất và ghi dữ liệu vào kho KPI.",
    category: "Nhập liệu & đồng bộ",
  },
  mstEdit: {
    label: "Gán MST – chỉnh sửa",
    description: "Cập nhật mã số thuế, phân công nhân viên và đại lý hải quan phụ trách.",
    category: "Tổ chức & đối tác",
  },
  rulesEdit: {
    label: "Quy tắc KPI – chỉnh sửa",
    description: "Thay đổi công thức, trọng số và điều kiện tính điểm KPI.",
    category: "Cấu hình & kiểm soát",
  },
  teamsEdit: {
    label: "Quản lý tổ đội – chỉnh sửa",
    description: "Điều chỉnh cơ cấu tổ đội, phân bổ nhân viên và chỉ tiêu.",
    category: "Tổ chức & đối tác",
  },
  syncManage: {
    label: "Đồng bộ ECUS – cấu hình & chạy tay",
    description: "Thiết lập lịch đồng bộ và chạy đồng bộ ECUS thủ công khi cần.",
    category: "Nhập liệu & đồng bộ",
  },
  reportsExport: {
    label: "Báo cáo KPI – xuất file",
    description: "Tải báo cáo KPI ra Excel và tải nhanh biểu đồ tổng hợp.",
    category: "Báo cáo & giám sát",
  },
  alertsManage: {
    label: "Quản lý cảnh báo thiếu thông tin",
    description: "Xử lý cảnh báo tờ khai thiếu dữ liệu, ghi nhận trạng thái hoàn tất.",
    category: "Giám sát dữ liệu",
  },
  auditView: {
    label: "Xem nhật ký hệ thống",
    description: "Tra cứu lịch sử thao tác và truy vết hoạt động người dùng.",
    category: "Báo cáo & giám sát",
  },
  accountManage: {
    label: "Quản lý tài khoản",
    description: "Tạo, khóa, đặt lại mật khẩu và phân quyền người dùng.",
    category: "Quản trị hệ thống",
  },
  adjustSubmit: {
    label: "Điểm KPI +/- thêm – gửi đề xuất",
    description: "Tạo phiếu cộng/trừ điểm KPI bổ sung cho từng nhân viên.",
    category: "Điều chỉnh KPI",
  },
  adjustApprove: {
    label: "Điểm KPI +/- thêm – duyệt đề xuất",
    description: "Phê duyệt hoặc từ chối các phiếu điều chỉnh KPI bổ sung.",
    category: "Điều chỉnh KPI",
  },
  aiAssistUse: {
    label: "Trợ lý AI – sử dụng",
    description: "Trao đổi với trợ lý AI nội bộ và xem lịch sử hội thoại.",
    category: "Trợ lý AI",
  },
  aiAssistManage: {
    label: "Trợ lý AI – cấu hình",
    description: "Quản lý nguồn tri thức, prompt và quyền truy cập trợ lý AI.",
    category: "Trợ lý AI",
  },
  dataHealthView: {
    label: "Sức khỏe dữ liệu – xem dashboard",
    description: "Theo dõi dữ liệu trùng, cảnh báo và chất lượng đồng bộ.",
    category: "Giám sát dữ liệu",
  },
  dataHealthManage: {
    label: "Sức khỏe dữ liệu – cấu hình & khóa nguồn",
    description: "Chỉnh ngưỡng cảnh báo, khóa/mở khóa nguồn và lưu chính sách.",
    category: "Giám sát dữ liệu",
  },
});

const PERMISSION_CATEGORY_ORDER = Object.freeze([
  "Nhập liệu & đồng bộ",
  "Tổ chức & đối tác",
  "Giám sát dữ liệu",
  "Cấu hình & kiểm soát",
  "Báo cáo & giám sát",
  "Điều chỉnh KPI",
  "Trợ lý AI",
  "Quản trị hệ thống",
  "Khác",
]);

const CONTROL_CLASS =
  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0";

function PermissionCheckbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  compact = false,
}) {
  const baseClass = [
    "flex min-h-[48px] gap-3 rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-subtle)]/60 px-3 py-2 transition",
    disabled
      ? "cursor-not-allowed opacity-60"
      : "hover:border-[color:var(--ds-accent)] hover:bg-[color:var(--ds-surface-card)]",
  ].join(" ");
  const labelClass = compact
    ? "text-sm font-medium leading-snug text-[color:var(--ds-text-primary)]"
    : "text-sm font-semibold leading-snug text-[color:var(--ds-text-primary)]";
  return (
    <label className={baseClass} title={label}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--ds-accent)]"
      />
      <span className="flex min-w-0 flex-col">
        <span className={labelClass}>{label}</span>
        {!compact && description && (
          <span className="text-xs leading-4 text-[color:var(--ds-text-secondary)]">{description}</span>
        )}
      </span>
    </label>
  );
}

function StaffCombobox({
  value,
  onSelect,
  options,
  disabled = false,
  ariaLabel,
  dataTestId,
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => options.find((option) => option.id === value) || null, [options, value]);
  const buttonLabel = selected
    ? `${selected.name}${selected.teamName ? ` – ${selected.teamName}` : ""}`
    : "Chọn nhân viên từ danh sách KPI";

  const groupedOptions = useMemo(() => {
    const map = new Map();
    for (const option of options) {
      const key = option.teamName || "Không rõ tổ đội";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(option);
    }
    return Array.from(map.entries()).map(([teamName, members]) => ({
      key: teamName || "unknown",
      label: teamName || "Không rõ tổ đội",
      members,
    }));
  }, [options]);

  const handleSelect = (option) => {
    onSelect?.(option);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${CONTROL_CLASS} flex w-full items-center justify-between gap-2 text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel || buttonLabel}
          data-testid={dataTestId}
        >
          <span className="truncate">{buttonLabel}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0" side="bottom">
        <Command>
          <CommandInput placeholder="Tìm theo tên nhân viên hoặc tổ đội…" />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>Không tìm thấy nhân viên phù hợp.</CommandEmpty>
            <CommandGroup heading="Tùy chọn chung">
              <CommandItem
                value="__none__"
                onSelect={() => handleSelect(null)}
                className="flex items-center gap-2"
              >
                <CircleX className="h-4 w-4" />
                <span className="flex-1">Không gắn nhân viên</span>
                {!value && <Check className="h-4 w-4" />}
              </CommandItem>
            </CommandGroup>
            {groupedOptions.map((group) => (
              <CommandGroup key={group.key} heading={group.label}>
                {group.members.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={`${member.normalizedName} ${member.normalizedTeam} ${member.id}`}
                    onSelect={() => handleSelect(member)}
                    className="flex items-center gap-2"
                  >
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span className="truncate">{member.name}</span>
                      {member.teamName && (
                        <span className="text-xs text-[color:var(--ds-text-muted)]">{member.teamName}</span>
                      )}
                    </div>
                    {value === member.id && <Check className="h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function AccountManager({ currentUser }) {
  const [accounts, setAccounts] = useState(() => listAccounts());
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    username: "",
    name: "",
    password: "",
    role: DEFAULT_ROLE,
    permissions: getPermissionTemplate(DEFAULT_ROLE),
    memberId: "",
    memberName: "",
    teamId: "",
    teamName: "",
  }));
  const [searchTerm, setSearchTerm] = useState("");
  const [roster, setRoster] = useState(() => getTeamRoster());
  const [pendingAccounts, setPendingAccounts] = useState(() => new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const currentActor = currentUser?.username || "system";

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
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeTeamRoster((next) => setRoster(next));
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const staffOptions = useMemo(() => {
    const teams = Array.isArray(roster?.teams) ? roster.teams : [];
    const list = [];
    for (const team of teams) {
      if (!team || typeof team !== "object") continue;
      const teamId = typeof team.id === "string" ? team.id : "";
      const teamName = normalizeStr(team?.name) || "";
      const members = Array.isArray(team?.members) ? team.members : [];
      for (const member of members) {
        if (!member || typeof member !== "object") continue;
        const id = typeof member.id === "string" ? member.id.trim() : "";
        const name = normalizeStr(member?.name) || "";
        if (!id || !name) {
          continue;
        }
        list.push({
          id,
          name,
          teamId: teamId || null,
          teamName: teamName || null,
          normalizedName: normalizeName(name),
          normalizedTeam: normalizeName(teamName || ""),
        });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));
  }, [roster]);

  const staffLookup = useMemo(() => {
    const map = new Map();
    for (const option of staffOptions) {
      map.set(option.id, option);
    }
    return map;
  }, [staffOptions]);

  const permissionDefinitions = useMemo(() => {
    const items = PERMISSION_KEYS.map((key) => {
      const details = PERMISSION_DETAILS[key] || {};
      return {
        key,
        label: details.label || key,
        description: details.description || "",
        category: details.category || "Khác",
      };
    });
    const getCategoryOrder = (category) => {
      const index = PERMISSION_CATEGORY_ORDER.indexOf(category);
      return index === -1 ? PERMISSION_CATEGORY_ORDER.length : index;
    };
    return items.sort((a, b) => {
      const categoryDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      return a.label.localeCompare(b.label, "vi", { sensitivity: "base" });
    });
  }, []);

  const permissionLookup = useMemo(() => {
    const map = new Map();
    for (const definition of permissionDefinitions) {
      map.set(definition.key, definition);
    }
    return map;
  }, [permissionDefinitions]);

  const permissionSections = useMemo(() => {
    const groups = new Map();
    for (const definition of permissionDefinitions) {
      const key = definition.category || "Khác";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(definition);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({
      id: category,
      title: category,
      items,
    }));
  }, [permissionDefinitions]);
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
    setForm({
      username: "",
      name: "",
      password: "",
      role: DEFAULT_ROLE,
      permissions: getPermissionTemplate(DEFAULT_ROLE),
      memberId: "",
      memberName: "",
      teamId: "",
      teamName: "",
    });
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
      await createAccount(payload, { actor: currentActor });
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
        await updateAccount(
          username,
          {
            memberId: nextState.memberId || null,
            memberName: nextState.memberName || null,
            teamId: nextState.teamId || null,
            teamName: nextState.teamName || null,
          },
          { actor: currentActor }
        );
        setAccounts(listAccounts());
        alert("Đã cập nhật nhân viên gắn với tài khoản.");
      } catch (err) {
        alert(err?.message || "Không thể cập nhật nhân viên");
      } finally {
        setAccountPending(username, false);
      }
    },
    [currentActor, setAccountPending]
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
        await updateAccount(username, { permissions: nextPermissions }, { actor: currentActor });
        setAccounts(listAccounts());
      } catch (err) {
        alert(err?.message || "Không thể cập nhật quyền");
      }
    },
    [accounts, currentActor]
  );

  const changeRole = useCallback(
    async (username, role) => {
      try {
        const normalized = normalizeRole(role);
        await updateAccount(username, { role: normalized }, { actor: currentActor });
        setAccounts(listAccounts());
      } catch (err) {
        alert(err?.message || "Không thể cập nhật vai trò");
      }
    },
    [currentActor]
  );

  const resetPassword = useCallback(
    async (username) => {
      const nextPassword = window.prompt(`Nhập mật khẩu mới cho ${username} (>=6 ký tự):`);
      if (!nextPassword) return;
      try {
        await setAccountPassword(username, nextPassword, { actor: currentActor });
        alert(`Đã đặt lại mật khẩu cho ${username}.`);
      } catch (err) {
        alert(err?.message || "Không thể đặt lại mật khẩu");
      }
    },
    [currentActor]
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
      await deleteAccount(username, { actor: currentActor });
      setAccounts(listAccounts());
      closeDeleteDialog();
    } catch (err) {
      setDeleteError(err?.message || "Không thể xóa tài khoản");
    } finally {
      setIsDeleting(false);
    }
  }, [accountToDelete, closeDeleteDialog, currentActor, deleteConfirmText]);

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
        width: "280px",
        cell: (account) => {
          const rosterMissing = staffOptions.length === 0;
          const inRoster = account.memberId ? staffLookup.get(account.memberId) : null;
          const isPending = pendingAccounts.has(account.username);
          return (
            <div className="space-y-2">
              <StaffCombobox
                value={account.memberId || ""}
                onSelect={(option) => updateAccountStaff(account, option)}
                options={staffOptions}
                disabled={rosterMissing || isPending}
                ariaLabel={`Nhân viên KPI cho ${account.username}`}
                dataTestId={`account-staff-${account.username}`}
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
        cell: (account) => (
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {permissionDefinitions.map((definition) => (
              <PermissionCheckbox
                key={`${account.username}-${definition.key}`}
                label={definition.label}
                description={definition.description}
                compact
                checked={account.permissions?.[definition.key]}
                onChange={(value) => togglePermission(account.username, definition.key, value)}
                disabled={definition.key === "accountManage" && account.role !== ADMIN_ROLE}
              />
            ))}
          </div>
        ),
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
      pendingAccounts,
      permissionDefinitions,
      resetPassword,
      staffLookup,
      staffOptions,
      togglePermission,
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
    <div className="space-y-6">
      <div className="ds-callout ds-callout--info text-sm">
        <p>
          Quản lý tài khoản đăng nhập cho hệ thống KPI, gán quyền và nhân viên phụ trách theo từng tổ đội.
        </p>
        <p className="text-xs text-[color:var(--ds-text-muted)]">Mọi thao tác đều được ghi nhận trong mục Nhật ký để dễ dàng truy vết.</p>
      </div>

      <section className="ds-card space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-[color:var(--ds-text-primary)]">Tạo tài khoản mới</h2>
          <p className="text-sm text-[color:var(--ds-text-secondary)]">
            Điền thông tin đăng nhập, gắn nhân viên KPI (nếu có) và xác định quyền tương ứng trước khi tạo tài khoản.
          </p>
        </header>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Tài khoản *</label>
            <input
              className={CONTROL_CLASS}
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="username"
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Nhân viên KPI</label>
            <StaffCombobox
              value={form.memberId}
              onSelect={handleSelectStaff}
              options={staffOptions}
              disabled={staffOptions.length === 0}
              ariaLabel="Nhân viên KPI cho tài khoản mới"
            />
            {form.memberId ? (
              <p className="text-xs text-[color:var(--ds-text-muted)]">
                Sẽ gắn tài khoản với {form.memberName || form.memberId}
                {form.teamName ? ` • ${form.teamName}` : ""}
              </p>
            ) : (
              <p className="text-xs text-[color:var(--ds-text-muted)]">Tùy chọn: gắn tài khoản với nhân viên trong danh sách KPI.</p>
            )}
            {staffOptions.length === 0 && (
              <StatusBadge tone="warning">Chưa có dữ liệu tổ đội. Hãy cập nhật trong mục Quản lý tổ đội trước.</StatusBadge>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Họ tên hiển thị</label>
            <input
              className={CONTROL_CLASS}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Tên người dùng"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Mật khẩu tạm *</label>
            <input
              type="password"
              className={CONTROL_CLASS}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Ít nhất 6 ký tự"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Vai trò</label>
            <FilterSelect
              value={form.role}
              onChange={updateFormRole}
              options={ROLE_OPTIONS}
              placeholder="Chọn vai trò"
              triggerClassName="w-full"
            />
          </div>
          <div className="md:col-span-2 space-y-4">
            <div>
              <div className="text-sm font-medium text-[color:var(--ds-text-primary)]">Quyền chức năng</div>
              <p className="text-xs text-[color:var(--ds-text-muted)]">
                Chọn quyền tương ứng cho tài khoản. Những quyền bị làm mờ thuộc nhóm chỉ dành cho quản trị viên.
              </p>
            </div>
            <div className="space-y-4">
              {permissionSections.map((section) => (
                <div key={section.id} className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]">
                    {section.title}
                  </div>
                  <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                    {section.items.map((item) => (
                      <PermissionCheckbox
                        key={item.key}
                        label={item.label}
                        description={item.description}
                        checked={form.permissions[item.key]}
                        onChange={(value) => updateFormPermission(item.key, value)}
                        disabled={item.key === "accountManage" && form.role !== ADMIN_ROLE}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <div className="md:col-span-2 text-sm text-red-600">{error}</div>}
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
              onClick={resetForm}
              className="rounded border border-[color:var(--ds-border-subtle)] px-4 py-2 text-sm text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
              data-tooltip="Xóa nội dung biểu mẫu và nhập lại từ đầu"
            >
              Nhập lại
            </button>
          </div>
        </form>
      </section>

      <section className="ds-card space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--ds-text-primary)]">Danh sách tài khoản</h2>
            <p className="text-sm text-[color:var(--ds-text-secondary)]">Theo dõi quyền truy cập và trạng thái gắn nhân viên.</p>
          </div>
          <StatusBadge tone="info">{visibleAccounts}/{totalAccounts} tài khoản</StatusBadge>
        </header>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm nhanh theo tài khoản, họ tên, vai trò hoặc quyền…"
            className={`min-w-[220px] flex-1 ${CONTROL_CLASS}`}
          />
          {hasSearch && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
            >
              Xóa tìm kiếm
            </button>
          )}
        </div>
        <DataTable
          columns={accountColumns}
          data={filteredAccounts}
          rowKey={(account) => account.username}
          density="relaxed"
          zebra
          emptyState={renderAccountsEmpty}
        />
      </section>

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
