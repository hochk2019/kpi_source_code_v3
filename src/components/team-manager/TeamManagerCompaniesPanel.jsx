import React from "react";

import { t } from '@/lib/i18n.js';

function TeamManagerCompaniesPanel({
  activeMember,
  selectedTeam,
  displayCompanies,
  pagedCompanies,
  currentCompanyPage,
  totalCompanyPages,
  showPagination,
  onShowAllTeamCompanies,
  onPreviousPage,
  onNextPage,
}) {
  return (
    <div className="border rounded p-4 bg-white shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm uppercase text-gray-500">
          {activeMember
            ? t('team.companies.titleMember', { name: activeMember.name })
            : t('team.companies.titleTeam', { name: selectedTeam.name })}
        </h3>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{t('team.companies.count', { count: displayCompanies.length })}</span>

          {activeMember && (
            <button
              type="button"
              onClick={onShowAllTeamCompanies}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
            >
              {t('team.companies.viewAllTeam')}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        {displayCompanies.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            {activeMember
              ? t('team.companies.emptyMember')
              : t('team.companies.emptyTeam')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left w-28">MST</th>
                <th className="p-2 text-left">Công ty</th>
                {activeMember ? (
                  <th className="p-2 text-left w-24">{t('team.companies.role')}</th>
                ) : (
                  <>
                    <th className="p-2 text-left w-40">{t('team.companies.importPerson')}</th>
                    <th className="p-2 text-left w-40">{t('team.companies.exportPerson')}</th>
                  </>
                )}
                <th className="p-2 text-left w-32">{t('team.companies.effectiveFrom')}</th>
              </tr>
            </thead>

            <tbody>
              {pagedCompanies.map((row, index) => (
                <tr
                  key={`${row.mst}-${row.company}-${index}-${activeMember ? row.role : "team"}`}
                  className="border-t"
                >
                  <td className="p-2">{row.mst}</td>
                  <td className="p-2">{row.company}</td>

                  {activeMember ? (
                    <td className="p-2">{row.role}</td>
                  ) : (
                    <>
                      <td className="p-2">{row.person_import}</td>
                      <td className="p-2">{row.person_export}</td>
                    </>
                  )}

                  <td className="p-2">{row.effective_from || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPagination && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={currentCompanyPage <= 1}
            className={`px-3 py-1 rounded border ${
              currentCompanyPage <= 1 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            ← {t('common.previous')}
          </button>

          <span>
            {t('common.page')} {currentCompanyPage}/{totalCompanyPages}
          </span>

          <button
            type="button"
            onClick={onNextPage}
            disabled={currentCompanyPage >= totalCompanyPages}
            className={`px-3 py-1 rounded border ${
              currentCompanyPage >= totalCompanyPages ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {t('common.next')} →
          </button>
        </div>
      )}
    </div>
  );
}

export default TeamManagerCompaniesPanel;
