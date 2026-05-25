import React from "react";

import { t } from '@/lib/i18n.js';
import { normalizeName } from "@/lib/storeCoreHelpers.js";

function TeamManagerMemberPanel({
  selectedTeam,
  canEdit,
  isReadOnly,
  newMemberName,
  onNewMemberNameChange,
  onAddMember,
  selectedMemberId,
  onSelectMember,
  memberAssignments,
  activeMember,
  memberNameDraft,
  onMemberNameDraftChange,
  onCommitMemberName,
  onMemberNameKey,
  teams,
  selectedTeamId,
  onMoveMember,
  onRemoveMember,
  memberCompanies,
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200/60 p-4 space-y-4 bg-white/60 backdrop-blur-md shadow-sm">
        <h3 className="font-semibold text-sm uppercase text-gray-500 tracking-wider">
          {t('team.members.title', { name: selectedTeam.name })}
        </h3>

        {canEdit ? (
          <form className="flex gap-2" onSubmit={onAddMember}>
            <input
              value={newMemberName}
              onChange={(event) => onNewMemberNameChange(event.target.value)}
              placeholder={t('team.members.newPlaceholder')}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white/80"
            />
            <button type="submit" className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
              {t('team.members.add')}
            </button>
          </form>
        ) : (
          <div className="rounded border border-dashed p-3 text-sm text-gray-500">
            {t('team.members.loginRequired')}
          </div>
        )}

        <div className="max-h-72 overflow-y-auto rounded-xl ring-1 ring-gray-200 bg-white/40">
          {selectedTeam.members.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center italic">
              {t('team.members.empty')}
            </div>
          ) : (
            <ul className="p-1 space-y-1">
              {selectedTeam.members.map((member) => {
                const key = normalizeName(member.name);
                const assigned = memberAssignments.get(key)?.length ?? 0;
                const isActiveMember = member.id === selectedMemberId;

                const initials = member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

                const isLead = assigned > 30;
                const role = isLead ? t('team.members.roleLead') : t('team.members.roleStaff');
                const roleBadgeColor = isLead ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700";

                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => onSelectMember(member.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors duration-200 ${isActiveMember ? "bg-teal-50/80 ring-1 ring-teal-500/20 shadow-sm" : "hover:bg-gray-50/80"
                        }`}
                    >
                      <div className={`h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-xs ${isActiveMember ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`truncate font-medium text-sm ${isActiveMember ? "text-teal-900" : "text-gray-900"}`}>
                          {member.name}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span> {t('team.members.active')}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ${roleBadgeColor}`}>{role}</span>
                        <span className="text-xs text-gray-500 font-medium">{t('team.members.companiesCount', { count: assigned })}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/60 p-4 bg-white/60 backdrop-blur-md shadow-sm space-y-3">
        <h3 className="font-semibold text-sm uppercase text-gray-500 tracking-wider">{t('team.members.detailTitle')}</h3>

        {activeMember ? (
          <div className="space-y-4 text-sm">
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">{t('team.members.nameLabel')}</label>
              <input
                value={memberNameDraft}
                onChange={(event) => onMemberNameDraftChange(event.target.value)}
                onBlur={onCommitMemberName}
                onKeyDown={onMemberNameKey}
                className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                readOnly={isReadOnly}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">{t('team.members.teamLabel')}</label>
              <select
                value={selectedTeamId ?? ""}
                onChange={(event) => onMoveMember(activeMember.id, event.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500"
                disabled={isReadOnly}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {canEdit && (
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onCommitMemberName} className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">
                  {t('team.members.updateName')}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveMember(activeMember.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                >
                  {t('team.members.remove')}
                </button>
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              {t('team.members.companies', { count: memberCompanies.length })}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic py-4">
            {t('team.members.selectHint')}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamManagerMemberPanel;
