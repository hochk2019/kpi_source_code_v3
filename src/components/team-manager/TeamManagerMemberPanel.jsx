import React from "react";

import { normalizeName } from "@/lib/store.js";

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
    <div className="space-y-4">
      <div className="border rounded p-4 space-y-3 bg-white shadow-sm">
        <h3 className="font-semibold text-sm uppercase text-gray-500">
          Thành viên của {selectedTeam.name}
        </h3>

        {canEdit ? (
          <form className="flex gap-2" onSubmit={onAddMember}>
            <input
              value={newMemberName}
              onChange={(event) => onNewMemberNameChange(event.target.value)}
              placeholder="Tên thành viên mới"
              className="flex-1 border rounded px-2 py-1"
            />

            <button type="submit" className="px-3 py-1 rounded bg-emerald-600 text-white">
              Thêm
            </button>
          </form>
        ) : (
          <div className="rounded border border-dashed p-3 text-sm text-gray-500">
            Đăng nhập bằng tài khoản được cấp quyền để thêm thành viên mới.
          </div>
        )}

        <div className="max-h-72 overflow-y-auto border rounded">
          {selectedTeam.members.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 text-center">
              Chưa có thành viên trong team này.
            </div>
          ) : (
            <ul className="divide-y">
              {selectedTeam.members.map((member) => {
                const key = normalizeName(member.name);
                const assigned = memberAssignments.get(key)?.length ?? 0;
                const isActiveMember = member.id === selectedMemberId;

                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => onSelectMember(member.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left ${
                        isActiveMember ? "bg-blue-50" : ""
                      }`}
                    >
                      <span>{member.name}</span>

                      <span className="text-xs text-gray-500">{assigned} DN</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="border rounded p-4 bg-white shadow-sm space-y-3">
        <h3 className="font-semibold text-sm uppercase text-gray-500">Chi tiết thành viên</h3>

        {activeMember ? (
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs uppercase text-gray-400">Tên thành viên</label>

              <input
                value={memberNameDraft}
                onChange={(event) => onMemberNameDraftChange(event.target.value)}
                onBlur={onCommitMemberName}
                onKeyDown={onMemberNameKey}
                className="mt-1 w-full border rounded px-2 py-1"
                readOnly={isReadOnly}
                disabled={isReadOnly}
              />
            </div>

            <div>
              <label className="text-xs uppercase text-gray-400">Thuộc tổ đội</label>

              <select
                value={selectedTeamId ?? ""}
                onChange={(event) => onMoveMember(activeMember.id, event.target.value)}
                className="mt-1 w-full border rounded px-2 py-1"
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
              <div className="flex gap-2">
                <button type="button" onClick={onCommitMemberName} className="px-3 py-1 rounded border">
                  Cập nhật tên
                </button>

                <button
                  type="button"
                  onClick={() => onRemoveMember(activeMember.id)}
                  className="px-3 py-1 rounded bg-red-500 text-white"
                >
                  Xóa thành viên
                </button>
              </div>
            )}

            <div className="text-xs text-gray-500">
              Thành viên đang phụ trách {memberCompanies.length} doanh nghiệp.
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Chọn một thành viên để xem chi tiết và lịch sử doanh nghiệp được phân công.
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamManagerMemberPanel;
