// AccountDeleteDialog.jsx
import React from 'react';
import {
  AppDialog, AppDialogClose, AppDialogContent, AppDialogDescription,
  AppDialogFooter, AppDialogHeader, AppDialogTitle,
} from '@/components/designSystem/primitives.jsx';
import { t } from '@/lib/i18n.js';

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
          <AppDialogTitle>{t('account.deleteConfirm')}</AppDialogTitle>
          <AppDialogDescription>
            {t('account.deleteWarning', { username: account?.username })}
            {t('account.deleteConfirmText', { text: expectedText })}
          </AppDialogDescription>
        </AppDialogHeader>
        <div className="space-y-4">
          <input
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder={t('account.deleteConfirmText', { text: expectedText })}
            className="w-full rounded border px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <AppDialogFooter>
          <AppDialogClose disabled={isDeleting}>{t('common.cancel')}</AppDialogClose>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {isDeleting ? t('common.loading') : t('common.delete')}
          </button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
