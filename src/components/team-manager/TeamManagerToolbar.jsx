import React from "react";

import { t } from '@/lib/i18n.js';

function TeamManagerToolbar({
  dirty,
  isReadOnly,
  roster,
  totalMembers,
  onSave,
  onReloadRoster,
  onRefreshMST,
  historyOpen,
  onToggleHistory,
  onExportExcel,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onSave}
        disabled={!dirty || isReadOnly}
        className={`px-3 py-1 rounded text-white ${
          dirty && !isReadOnly ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400"
        }`}
        title={isReadOnly ? t('team.toolbar.saveDisabledTooltip') : t('team.toolbar.saveTooltip')}
      >
        {t('team.toolbar.save')}
      </button>

      <button onClick={onReloadRoster} className="px-3 py-1 rounded border">
        {t('team.toolbar.revert')}
      </button>

      <button onClick={onRefreshMST} className="px-3 py-1 rounded border">
        {t('team.toolbar.refreshMST')}
      </button>

      <button
        type="button"
        onClick={onToggleHistory}
        className={`px-3 py-1 rounded border transition-colors ${
          historyOpen ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"
        }`}
        title={
          historyOpen
            ? t('team.toolbar.historyHideTooltip')
            : t('team.toolbar.historyShowTooltip')
        }
        data-tooltip="Xem/ẩn lịch sử thay đổi team và MST"
      >
        {historyOpen ? t('team.toolbar.historyHide') : t('team.toolbar.historyShow')}
      </button>

      {dirty && !isReadOnly && <span className="text-sm text-amber-600">{t('team.toolbar.unsaved')}</span>}

      {isReadOnly && (
        <span className="text-sm text-amber-600">{t('team.toolbar.readOnly')}</span>
      )}

      <button
        type="button"
        onClick={onExportExcel}
        className="ml-auto px-3 py-1 rounded border bg-white hover:bg-gray-50"
      >
        {t('team.toolbar.exportExcel')}
      </button>

      <span className="text-sm text-gray-500 ml-2">
        {t('team.toolbar.stats', { teams: roster.teams.length, members: totalMembers })}
      </span>
    </div>
  );
}

export default TeamManagerToolbar;
