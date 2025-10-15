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

const PERMISSION_LABELS = {
  importEdit: "Import Data – chỉnh sửa & lưu",
  mstEdit: "Gán MST – chỉnh sửa",
  rulesEdit: "Quy tắc KPI – chỉnh sửa",
  teamsEdit: "Quản lý tổ đội – chỉnh sửa",
  syncManage: "Đồng bộ ECUS – cấu hình & chạy tay",
  reportsExport: "Báo cáo KPI – xuất file",
  alertsManage: "Quản lý cảnh báo tờ khai thiếu thông tin",
  auditView: "Xem nhật ký hệ thống",
  accountManage: "Quản lý tài khoản",
  adjustSubmit: "Điểm KPI +/- thêm – gửi đề xuất",
  adjustApprove: "Điểm KPI +/- thêm – duyệt đề xuất",
  aiAssistUse: "Trợ lý AI – sử dụng",
  aiAssistManage: "Trợ lý AI – cấu hình",
};

const CONTROL_CLASS =
  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0";

function PermissionCheckbox({ checked, onChange, label, disabled = false }) {
  const tone = disabled
    ? "text-[color:var(--ds-text-muted)] opacity-70"
    : "text-[color:var(--ds-text-secondary)]";
  return (
    <label className={`flex items-center gap-2 text-sm ${tone}`}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span>{label}</span>
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

  const permissionList = useMemo(() => PERMISSION_KEYS.map((key) => ({ key, label: PERMISSION_LABELS[key] })), []);
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
        .map(([key]) => (PERMISSION_LABELS[key] || key).toLowerCase());
      return activePermissions.some((label) => label.includes(term));
    });
  }, [accounts, searchTerm]);
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

  const togglePermission = async (username, key, value) => {
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
  };

  const changeRole = async (username, role) => {
    try {
      const normalized = normalizeRole(role);
      await updateAccount(username, { role: normalized }, { actor: currentActor });
      setAccounts(listAccounts());
    } catch (err) {
      alert(err?.message || "Không thể cập nhật vai trò");
    }
  };

  const resetPassword = async (username) => {
    const nextPassword = window.prompt(`Nhập mật khẩu mới cho ${username} (>=6 ký tự):`);
    if (!nextPassword) return;
    try {
      await setAccountPassword(username, nextPassword, { actor: currentActor });
      alert(`Đã đặt lại mật khẩu cho ${username}.`);
    } catch (err) {
      alert(err?.message || "Không thể đặt lại mật khẩu");
    }
  };

  const removeAccount = async (account) => {
    if (!account) return;
    const username = account.username;
    const summary = [];
    if (account.name && account.name !== username) {
      summary.push(`Họ tên: ${account.name}`);
    }
    if (account.memberName) {
      const staffLabel = account.teamName
        ? `${account.memberName} (${account.teamName})`
        : account.memberName;
      summary.push(`Nhân viên KPI: ${staffLabel}`);
    }
    const confirmLines = [
      `Bạn chuẩn bị xoá tài khoản ${username}.`,
      summary.length ? `Thông tin: ${summary.join(" • ")}` : null,
      "Thao tác này sẽ đăng xuất tài khoản khỏi hệ thống và không thể hoàn tác.",
      "Bạn có chắc chắn muốn tiếp tục?",
    ].filter(Boolean);
    if (!window.confirm(confirmLines.join("\n"))) {
      return;
    }
    const typed = window.prompt(`Nhập lại \"${username}\" để xác nhận xoá vĩnh viễn:`) || "";
    if (typed.trim().toLowerCase() !== username.toLowerCase()) {
      alert("Chưa xác nhận đúng tên tài khoản, đã hủy thao tác.");
      return;
    }
    try {
      await deleteAccount(username, { actor: currentActor });
      setAccounts(listAccounts());
    } catch (err) {
      alert(err?.message || "Không thể xóa tài khoản");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        Quản lý tài khoản đăng nhập cho hệ thống KPI. Tạo tài khoản mới và gán quyền cho từng khu vực. Mọi thao tác sẽ được ghi
        lại trong mục Nhật ký.
      </div>

      <section className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[color:var(--ds-text-primary)]">Tạo tài khoản mới</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
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
              <p className="text-xs text-amber-600">Chưa có dữ liệu tổ đội. Hãy cập nhật trong mục Quản lý tổ đội trước.</p>
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
            <select
              className={CONTROL_CLASS}
              value={form.role}
              onChange={(e) => updateFormRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm font-medium text-[color:var(--ds-text-primary)]">Quyền chức năng</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {permissionList.map(({ key, label }) => (
                <PermissionCheckbox
                  key={key}
                  label={label}
                  checked={form.permissions[key]}
                  onChange={(value) => updateFormPermission(key, value)}
                  disabled={key === "accountManage" && form.role !== ADMIN_ROLE}
                />
              ))}
            </div>
          </div>
          {error && (
            <div className="md:col-span-2 text-sm text-red-600">{error}</div>
          )}
          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
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

      <section className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[color:var(--ds-text-primary)]">Danh sách tài khoản</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
          <span className="text-sm text-[color:var(--ds-text-muted)]">
            {visibleAccounts}/{totalAccounts} tài khoản
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--ds-border-subtle)]">
            <thead className="bg-[color:var(--ds-surface-muted)] text-left text-sm font-medium text-[color:var(--ds-text-secondary)]">
              <tr>
                <th className="px-3 py-2">Tài khoản</th>
                <th className="px-3 py-2">Họ tên</th>
                <th className="px-3 py-2">Nhân viên KPI</th>
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2">Quyền chức năng</th>
                <th className="px-3 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--ds-border-subtle)] text-sm text-[color:var(--ds-text-primary)]">
              {visibleAccounts === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-[color:var(--ds-text-muted)]" colSpan={6}>
                    {totalAccounts === 0 ? "Chưa có tài khoản nào." : "Không tìm thấy tài khoản phù hợp với từ khóa."}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.username} className="align-top">
                    <td className="px-3 py-3 font-medium text-[color:var(--ds-text-primary)]">{account.username}</td>
                    <td className="px-3 py-3 text-[color:var(--ds-text-secondary)]">
                      <div>{account.name || "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <StaffCombobox
                        value={account.memberId || ""}
                        onSelect={(option) => updateAccountStaff(account, option)}
                        options={staffOptions}
                        disabled={staffOptions.length === 0 || pendingAccounts.has(account.username)}
                        ariaLabel={`Nhân viên KPI cho ${account.username}`}
                        dataTestId={`account-staff-${account.username}`}
                      />
                      {staffOptions.length === 0 ? (
                        <p className="mt-2 text-xs text-amber-600">
                          Cần cập nhật danh sách tổ đội trước khi gắn nhân viên.
                        </p>
                      ) : account.memberId ? (
                        staffLookup.has(account.memberId) ? (
                          <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">
                            Đang gắn với {account.memberName || account.memberId}
                            {account.teamName ? ` • ${account.teamName}` : ""}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-amber-600">
                            Nhân viên này không còn trong danh sách KPI. Hãy chọn lại để đồng bộ.
                          </p>
                        )
                      ) : (
                        <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">
                          Chưa gắn nhân viên KPI.
                        </p>
                      )}
                      {pendingAccounts.has(account.username) && (
                        <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">Đang cập nhật…</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className={`w-full max-w-[140px] ${CONTROL_CLASS}`}
                        value={account.role}
                        onChange={(e) => changeRole(account.username, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        {permissionList.map(({ key, label }) => (
                          <PermissionCheckbox
                            key={key}
                            label={label}
                            checked={account.permissions?.[key]}
                            onChange={(value) => togglePermission(account.username, key, value)}
                            disabled={key === "accountManage" && account.role !== ADMIN_ROLE}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => resetPassword(account.username)}
                          className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
                          data-tooltip="Đặt lại mật khẩu và yêu cầu người dùng đổi sau khi đăng nhập"
                        >
                          Đặt lại mật khẩu
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAccount(account)}
                          className="rounded border border-red-500 px-3 py-1 text-xs text-red-600 hover:bg-red-500/10"
                          data-tooltip="Xóa tài khoản này khỏi hệ thống"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
