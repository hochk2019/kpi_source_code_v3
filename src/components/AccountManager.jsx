import React, { useEffect, useMemo, useState } from "react";
import {
  listAccounts,
  createAccount,
  updateAccount,
  setAccountPassword,
  deleteAccount,
  getPermissionTemplate,
  PERMISSION_KEYS,
} from "@/auth/localAuth.js";

const PERMISSION_LABELS = {
  importEdit: "Import Excel – chỉnh sửa & lưu",
  mstEdit: "Gán MST – chỉnh sửa",
  rulesEdit: "Quy tắc KPI – chỉnh sửa",
  teamsEdit: "Quản lý tổ đội – chỉnh sửa",
  syncManage: "Đồng bộ ECUS – cấu hình & chạy tay",
  reportsExport: "Báo cáo/In – xuất file",
  alertsManage: "Quản lý cảnh báo tờ khai thiếu thông tin",
  auditView: "Xem nhật ký hệ thống",
  accountManage: "Quản lý tài khoản",
};

function PermissionCheckbox({ checked, onChange, label, disabled = false }) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "text-gray-400" : "text-gray-700"}`}>
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
    role: "staff",
    permissions: getPermissionTemplate("staff"),
  }));

  const currentActor = currentUser?.username || "system";

  const refresh = () => {
    setAccounts(listAccounts());
  };

  useEffect(() => {
    refresh();
  }, []);

  const permissionList = useMemo(() => PERMISSION_KEYS.map((key) => ({ key, label: PERMISSION_LABELS[key] })), []);

  const resetForm = () => {
    setForm({
      username: "",
      name: "",
      password: "",
      role: "staff",
      permissions: getPermissionTemplate("staff"),
    });
  };

  const handleCreate = (event) => {
    event.preventDefault();
    setError("");
    try {
      createAccount(form, { actor: currentActor });
      alert("Đã tạo tài khoản mới.");
      resetForm();
      refresh();
    } catch (err) {
      setError(err?.message || "Không thể tạo tài khoản");
    }
  };

  const updateFormRole = (role) => {
    setForm((prev) => ({
      ...prev,
      role,
      permissions: getPermissionTemplate(role),
    }));
  };

  const updateFormPermission = (key, value) => {
    setForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: value },
    }));
  };

  const togglePermission = (username, key, value) => {
    try {
      const target = accounts.find((account) => account.username === username);
      if (!target) return;
      const nextPermissions = { ...target.permissions, [key]: value };
      updateAccount(username, { permissions: nextPermissions }, { actor: currentActor });
      refresh();
    } catch (err) {
      alert(err?.message || "Không thể cập nhật quyền");
    }
  };

  const changeRole = (username, role) => {
    try {
      updateAccount(username, { role }, { actor: currentActor });
      refresh();
    } catch (err) {
      alert(err?.message || "Không thể cập nhật vai trò");
    }
  };

  const resetPassword = (username) => {
    const nextPassword = window.prompt(`Nhập mật khẩu mới cho ${username} (>=6 ký tự):`);
    if (!nextPassword) return;
    try {
      setAccountPassword(username, nextPassword, { actor: currentActor });
      alert(`Đã đặt lại mật khẩu cho ${username}.`);
    } catch (err) {
      alert(err?.message || "Không thể đặt lại mật khẩu");
    }
  };

  const removeAccount = (username) => {
    if (!window.confirm(`Xóa tài khoản ${username}?`)) return;
    try {
      deleteAccount(username, { actor: currentActor });
      refresh();
    } catch (err) {
      alert(err?.message || "Không thể xóa tài khoản");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded border bg-amber-50 p-4 text-sm text-amber-700">
        Quản lý tài khoản đăng nhập cho hệ thống KPI. Tạo tài khoản mới và gán quyền cho từng khu vực. Mọi thao tác sẽ được ghi
        lại trong mục Nhật ký.
      </div>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Tạo tài khoản mới</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tài khoản *</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="username"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Họ tên hiển thị</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Tên người dùng"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mật khẩu tạm *</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Ít nhất 6 ký tự"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Vai trò</label>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => updateFormRole(e.target.value)}
            >
              <option value="staff">Nhân viên</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm font-medium">Quyền chức năng</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {permissionList.map(({ key, label }) => (
                <PermissionCheckbox
                  key={key}
                  label={label}
                  checked={form.permissions[key]}
                  onChange={(value) => updateFormPermission(key, value)}
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
            >
              Tạo tài khoản
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded border px-4 py-2 text-sm"
            >
              Nhập lại
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Danh sách tài khoản</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y">
            <thead className="bg-gray-50 text-left text-sm font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2">Tài khoản</th>
                <th className="px-3 py-2">Họ tên</th>
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2">Quyền chức năng</th>
                <th className="px-3 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {accounts.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={5}>
                    Chưa có tài khoản nào.
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.username} className="align-top">
                    <td className="px-3 py-3 font-medium text-gray-900">{account.username}</td>
                    <td className="px-3 py-3">{account.name}</td>
                    <td className="px-3 py-3">
                      <select
                        className="rounded border px-2 py-1"
                        value={account.role}
                        onChange={(e) => changeRole(account.username, e.target.value)}
                      >
                        <option value="staff">Nhân viên</option>
                        <option value="admin">Quản trị viên</option>
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
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => resetPassword(account.username)}
                          className="rounded border px-3 py-1 text-xs"
                        >
                          Đặt lại mật khẩu
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAccount(account.username)}
                          className="rounded border border-red-500 px-3 py-1 text-xs text-red-600"
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
