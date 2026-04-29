// AccountDeleteDialog.jsx
import React from 'react';
import {
  AppDialog, AppDialogClose, AppDialogContent, AppDialogDescription,
  AppDialogFooter, AppDialogHeader, AppDialogTitle,
} from '@/components/designSystem/primitives.jsx';

export default function AccountDeleteDialog({
  open, onOpenChange, account, confirmText, onConfirmTextChange,
  onConfirm, error, isDeleting,
}) {
  const expectedText = account?.username || '';
  const canConfirm = confirmText === expectedText && !isDeleting;

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent>
        <AppDialogHeader>
          <AppDialogTitle>Xác nhận xóa tài khoản</AppDialogTitle>
          <AppDialogDescription>
            Tài khoản <strong>{account?.username}</strong> sẽ bị xóa vĩnh viễn.
            Nhập <code>{expectedText}</code> để xác nhận.
          </AppDialogDescription>
        </AppDialogHeader>
        <div className="space-y-4">
          <input
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder={`Nhập "${expectedText}"`}
            className="w-full rounded border px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <AppDialogFooter>
          <AppDialogClose disabled={isDeleting}>Hủy</AppDialogClose>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {isDeleting ? 'Đang xóa...' : 'Xóa'}
          </button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
