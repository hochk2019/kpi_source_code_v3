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

export default function AccountManager({ currentUser }) {
  const [accounts, setAccounts] = useState(() => listAccounts());
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    username: "",
    name: "",
    password: "",
    role: DEFAULT_ROLE,
    permissions: getPermissionTemplate(DEFAULT_ROLE),
  }));
  const [searchTerm, setSearchTerm] = useState("");

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
    });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await createAccount(form, { actor: currentActor });
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

  const removeAccount = async (username) => {
    if (!window.confirm(`Xóa tài khoản ${username}?`)) return;
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
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2">Quyền chức năng</th>
                <th className="px-3 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--ds-border-subtle)] text-sm text-[color:var(--ds-text-primary)]">
              {visibleAccounts === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-[color:var(--ds-text-muted)]" colSpan={5}>
                    {totalAccounts === 0 ? "Chưa có tài khoản nào." : "Không tìm thấy tài khoản phù hợp với từ khóa."}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.username} className="align-top">
                    <td className="px-3 py-3 font-medium text-[color:var(--ds-text-primary)]">{account.username}</td>
                    <td className="px-3 py-3 text-[color:var(--ds-text-secondary)]">{account.name || "—"}</td>
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
                          onClick={() => removeAccount(account.username)}
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
