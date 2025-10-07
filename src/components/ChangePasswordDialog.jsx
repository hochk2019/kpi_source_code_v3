import React, { useState } from "react";
import { changeOwnPassword } from "@/auth/localAuth.js";

export default function ChangePasswordDialog({ currentUser, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!currentUser?.username) {
      setError("Phiên đăng nhập không hợp lệ");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("Mật khẩu mới cần tối thiểu 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu không khớp");
      return;
    }
    try {
      setLoading(true);
      await changeOwnPassword(currentUser.username, currentPassword, newPassword);
      alert("Đổi mật khẩu thành công. Vui lòng đăng nhập lại nếu được yêu cầu.");
      onClose?.(true);
    } catch (err) {
      setError(err?.message || "Không thể đổi mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Đổi mật khẩu</h2>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium">Mật khẩu hiện tại</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-2 text-sm"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Mật khẩu mới</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-2 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onClose?.(false)}
              className="rounded border px-4 py-2 text-sm"
              disabled={loading}
              data-tooltip="Đóng hộp thoại mà không thay đổi mật khẩu"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              disabled={loading}
              data-tooltip="Lưu mật khẩu mới cho tài khoản của bạn"
            >
              {loading ? "Đang xử lý..." : "Cập nhật"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
