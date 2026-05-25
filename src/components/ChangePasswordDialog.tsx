import React, { useState } from "react";
import { useAppDialog } from '@/hooks/useAppDialog';

import {
  changeOwnPassword,
  getNewPasswordMinLengthMessage,
  getPasswordMinLengthPlaceholder,
  MIN_PASSWORD_LENGTH,
} from "@/auth/localAuth.js";
import { t } from '@/lib/i18n.js';
import type { AuthAccountView } from '@/types';

interface ChangePasswordDialogProps {
  currentUser?: AuthAccountView | null;
  onClose?: (changed: boolean) => void;
}

export default function ChangePasswordDialog({ currentUser, onClose }: ChangePasswordDialogProps) {
  const { alert } = useAppDialog();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!currentUser?.username) {
      setError(t('changePassword.invalidSession'));
      return;
    }

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(getNewPasswordMinLengthMessage());
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('changePassword.passwordMismatch'));
      return;
    }

    try {
      setLoading(true);
      await changeOwnPassword(currentUser.username, currentPassword, newPassword);
      await alert(t('changePassword.success'));
      onClose?.(true);
    } catch (err) {
      setError((err as Error)?.message || t('changePassword.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-ds-surface-card p-6 shadow-ds-strong">
        <h2 className="text-lg font-semibold text-ds-text-primary">{t('changePassword.title')}</h2>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-ds-text-primary">{t('changePassword.currentPassword')}</label>
            <input
              type="password"
              className="w-full rounded border border-ds-border-subtle bg-ds-surface-base px-3 py-2 text-sm text-ds-text-primary"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-ds-text-primary">{t('changePassword.newPassword')}</label>
            <input
              type="password"
              className="w-full rounded border border-ds-border-subtle bg-ds-surface-base px-3 py-2 text-sm text-ds-text-primary"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={getPasswordMinLengthPlaceholder()}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-ds-text-primary">{t('changePassword.confirmPassword')}</label>
            <input
              type="password"
              className="w-full rounded border border-ds-border-subtle bg-ds-surface-base px-3 py-2 text-sm text-ds-text-primary"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-sm text-ds-destructive">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onClose?.(false)}
              className="rounded border border-ds-border-subtle px-4 py-2 text-sm text-ds-text-primary hover:bg-ds-surface-muted"
              disabled={loading}
              data-tooltip="Đóng hộp thoại mà không thay đổi mật khẩu"
            >
              {t('changePassword.cancel')}
            </button>
            <button
              type="submit"
              className="rounded bg-ds-success px-4 py-2 text-sm font-semibold text-ds-text-inverse hover:bg-ds-success/90 disabled:opacity-50"
              disabled={loading}
              data-tooltip="Lưu mật khẩu mới cho tài khoản của bạn"
            >
              {loading ? t('changePassword.updating') : t('changePassword.update')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
