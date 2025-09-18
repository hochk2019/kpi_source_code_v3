import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getTeamRoster,
  setTeamRoster,
  getMSTMap,
  upsertMSTRows,
  normalizeName,
  normalizeStr,
  applyTeamRosterToMST,
} from "@/lib/store.js";

const COMPANY_PAGE_SIZE = 20;

function makeMemberId(teamId) {
  const random = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return `${teamId}-${stamp}-${random}`;
}

function TeamManager({ canEdit = true, currentUser = null }) {
  const initialRosterRef = useRef(null);
  if (!initialRosterRef.current) {
    initialRosterRef.current = getTeamRoster();
  }

  const [roster, setRoster] = useState(initialRosterRef.current);
  const [selectedTeamId, setSelectedTeamId] = useState(
    initialRosterRef.current.teams[0]?.id ?? null
  );
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [mstRows, setMstRows] = useState(() => getMSTMap());
  const [newMemberName, setNewMemberName] = useState("");
  const [memberNameDraft, setMemberNameDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [companyPage, setCompanyPage] = useState(1);

  const actor = currentUser?.username || "guest";
  const isReadOnly = !canEdit;

  const selectedTeam = useMemo(
    () => roster.teams.find((team) => team.id === selectedTeamId) ?? null,
    [roster, selectedTeamId]
  );

  const activeMember = useMemo(() => {
    if (!selectedTeam) return null;
    return selectedTeam.members.find((m) => m.id === selectedMemberId) ?? null;
  }, [selectedTeam, selectedMemberId]);

  useEffect(() => {
    if (!roster.teams.length) {
      if (selectedTeamId !== null) setSelectedTeamId(null);
      return;
    }
    if (!selectedTeam) {
      setSelectedTeamId(roster.teams[0].id);
    }
  }, [roster, selectedTeam, selectedTeamId]);

  useEffect(() => {
    if (!selectedTeam) {
      if (selectedMemberId !== null) setSelectedMemberId(null);
      return;
    }
    if (
      selectedMemberId &&
      !selectedTeam.members.some((m) => m.id === selectedMemberId)
    ) {
      setSelectedMemberId(null);
    }
  }, [selectedTeam, selectedMemberId]);

  useEffect(() => {
    setMemberNameDraft(activeMember?.name ?? "");
  }, [activeMember?.id, activeMember?.name]);

  useEffect(() => {
    setCompanyPage(1);
  }, [selectedTeamId, selectedMemberId]);

  const memberAssignments = useMemo(() => {
    const map = new Map();
    const push = (rawName, row, role) => {
      const key = normalizeName(rawName);
      if (!key) return;
      const list = map.get(key) ?? [];
      list.push({
        mst: row.mst,
        company: row.company || "",
        role,
        team: row.team || "",
        person_import: row.person_import || "",
        person_export: row.person_export || "",
        effective_from: row.effective_from || "",
      });
      map.set(key, list);
    };

    for (const row of mstRows) {
      push(row.person_import, row, "Nhập");
      push(row.person_export, row, "Xuất");
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        const cmpCompany = a.company.localeCompare(b.company, "vi", {
          sensitivity: "base",
        });
        if (cmpCompany !== 0) return cmpCompany;
        return a.mst.localeCompare(b.mst);
      });
    }

    return map;
  }, [mstRows]);

  const teamCompanies = useMemo(() => {
    if (!selectedTeam) return [];
    const teamKey = normalizeName(selectedTeam.name);
    if (!teamKey) return [];
    const companies = mstRows
      .filter((row) => normalizeName(row.team) === teamKey)
      .map((row) => ({
        mst: row.mst,
        company: row.company || "",
        person_import: row.person_import || "",
        person_export: row.person_export || "",
        effective_from: row.effective_from || "",
      }));

    companies.sort((a, b) => {
      const cmpCompany = a.company.localeCompare(b.company, "vi", {
        sensitivity: "base",
      });
      if (cmpCompany !== 0) return cmpCompany;
      return a.mst.localeCompare(b.mst);
    });

    return companies;
  }, [selectedTeam, mstRows]);

  const memberCompanies = useMemo(() => {
    if (!activeMember) return [];
    const key = normalizeName(activeMember.name);
    return memberAssignments.get(key) ?? [];
  }, [activeMember, memberAssignments]);

  const displayCompanies = activeMember ? memberCompanies : teamCompanies;

  const totalCompanyPages = Math.max(
    1,
    Math.ceil(displayCompanies.length / COMPANY_PAGE_SIZE)
  );
  const currentCompanyPage = Math.min(companyPage, totalCompanyPages);
  const pagedCompanies = displayCompanies.slice(
    (currentCompanyPage - 1) * COMPANY_PAGE_SIZE,
    currentCompanyPage * COMPANY_PAGE_SIZE
  );

  const teamCompanyCounts = useMemo(() => {
    const counts = new Map();
    for (const row of mstRows) {
      const key = normalizeName(row.team);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [mstRows]);

  const handleRefreshMST = () => {
    setMstRows(getMSTMap());
    setCompanyPage(1);
  };

  const handleReloadRoster = () => {
    const fresh = getTeamRoster();
    setRoster(fresh);
    setDirty(false);
  };

  const handleAddMember = (event) => {
    if (isReadOnly) return;
    event.preventDefault();
    if (!selectedTeam) return;
    const trimmed = normalizeStr(newMemberName);
    if (!trimmed) return;

    const exists = selectedTeam.members.some(
      (member) => normalizeName(member.name) === normalizeName(trimmed)
    );
    if (exists) {
      alert("Team hiện đã có thành viên này.");
      return;
    }

    const memberId = makeMemberId(selectedTeam.id);
    const newMember = { id: memberId, name: trimmed };

    setRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === selectedTeam.id
          ? { ...team, members: [...team.members, newMember] }
          : team
      ),
    }));
    setNewMemberName("");
    setSelectedMemberId(memberId);
    setDirty(true);
  };

  const handleRemoveMember = (memberId) => {
    if (isReadOnly) return;
    if (!selectedTeam) return;
    const member = selectedTeam.members.find((m) => m.id === memberId);
    if (!member) return;
    if (!confirm(`Xóa ${member.name} khỏi ${selectedTeam.name}?`)) return;

    setRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === selectedTeam.id
          ? {
              ...team,
              members: team.members.filter((m) => m.id !== memberId),
            }
          : team
      ),
    }));
    setDirty(true);
    if (selectedMemberId === memberId) {
      setSelectedMemberId(null);
    }
  };

  const handleMoveMember = (memberId, targetTeamId) => {
    if (isReadOnly) return;
    if (!targetTeamId || targetTeamId === selectedTeamId) return;
    const targetTeam = roster.teams.find((team) => team.id === targetTeamId);
    if (!targetTeam) return;

    let movedMember = null;
    setRoster((prev) => {
      let foundMember = null;
      const withoutMember = prev.teams.map((team) => {
        if (!team.members.some((m) => m.id === memberId)) return team;
        const member = team.members.find((m) => m.id === memberId);
        if (!member) return team;
        foundMember = member;
        return {
          ...team,
          members: team.members.filter((m) => m.id !== memberId),
        };
      });

      if (!foundMember) return prev;

      const updatedTeams = withoutMember.map((team) =>
        team.id === targetTeamId
          ? { ...team, members: [...team.members, foundMember] }
          : team
      );

      movedMember = foundMember;
      return { ...prev, teams: updatedTeams };
    });

    if (movedMember) {
      setSelectedTeamId(targetTeamId);
      setSelectedMemberId(movedMember.id);
      setDirty(true);
    }
  };

  const commitMemberName = () => {
    if (isReadOnly) return;
    if (!activeMember || !selectedTeam) return;
    const trimmed = normalizeStr(memberNameDraft);
    if (!trimmed) {
      setMemberNameDraft(activeMember.name);
      return;
    }
    if (normalizeName(trimmed) === normalizeName(activeMember.name)) {
      setMemberNameDraft(trimmed);
      return;
    }
    const duplicated = selectedTeam.members.some(
      (member) =>
        member.id !== activeMember.id &&
        normalizeName(member.name) === normalizeName(trimmed)
    );
    if (duplicated) {
      alert("Team đã có thành viên với tên tương tự.");
      setMemberNameDraft(activeMember.name);
      return;
    }

    setRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === selectedTeam.id
          ? {
              ...team,
              members: team.members.map((member) =>
                member.id === activeMember.id
                  ? { ...member, name: trimmed }
                  : member
              ),
            }
          : team
      ),
    }));
    setMemberNameDraft(trimmed);
    setDirty(true);
  };

  const handleMemberNameKey = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitMemberName();
    }
  };

  const handleSave = () => {
    if (isReadOnly) {
      alert("Bạn không có quyền lưu thay đổi tổ đội.");
      return;
    }
    try {
      const previousRoster = getTeamRoster();
      const sanitized = setTeamRoster(roster, {
        actor,
        detail: "Cập nhật tổ đội từ giao diện",
      });
      setRoster(sanitized);
      const { rows, changed } = applyTeamRosterToMST(sanitized, mstRows, {
        previousRoster,
      });
      if (changed) {
        upsertMSTRows(rows, {
          actor,
          detail: "Đồng bộ tổ đội sang bảng MST",
        });
        setMstRows(rows);
      }
      setDirty(false);
      alert(
        changed
          ? "Đã lưu tổ đội và đồng bộ dữ liệu MST thành công."
          : "Đã lưu tổ đội thành công."
      );
    } catch (error) {
      console.error(error);
      alert("Không thể lưu tổ đội. Kiểm tra lại dữ liệu hoặc thử lại sau.");
    }
  };

  const totalMembers = roster.teams.reduce(
    (sum, team) => sum + team.members.length,
    0
  );

  return (
    <div className="p-6 space-y-6">
      {isReadOnly && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Bạn đang xem quản lý tổ đội ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị hoặc được phân quyền để thêm, sửa hoặc điều chuyển thành viên.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || isReadOnly}
          className={`px-3 py-1 rounded text-white ${
            dirty && !isReadOnly ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400"
          }`}
          title={isReadOnly ? "Chỉ người được cấp quyền mới có thể lưu" : "Lưu thay đổi tổ đội"}
        >
          Lưu thay đổi
        </button>
        <button
          onClick={handleReloadRoster}
          className="px-3 py-1 rounded border"
        >
          Hoàn tác về dữ liệu đã lưu
        </button>
        <button
          onClick={handleRefreshMST}
          className="px-3 py-1 rounded border"
        >
          Tải lại dữ liệu MST
        </button>
        {dirty && !isReadOnly && (
          <span className="text-sm text-amber-600">
            Có thay đổi chưa lưu
          </span>
        )}
        {isReadOnly && (
          <span className="text-sm text-amber-600">
            Chế độ chỉ xem — không thể lưu thay đổi
          </span>
        )}
        <span className="ml-auto text-sm text-gray-500">
          Tổng cộng {roster.teams.length} tổ đội — {totalMembers} thành viên
        </span>
      </div>

      <p className="text-sm text-gray-600">
        Quản lý danh sách tổ đội để đồng bộ với dữ liệu gán MST và báo cáo KPI.
        Chọn một team để xem thành viên, doanh nghiệp phụ trách và điều chỉnh.
      </p>

      <div className="flex flex-wrap gap-2">
        {roster.teams.map((team) => {
          const isActive = team.id === selectedTeamId;
          const memberCount = team.members.length;
          const normalizedTeam = normalizeName(team.name);
          const companyCount = teamCompanyCounts.get(normalizedTeam) ?? 0;
          return (
            <button
              key={team.id}
              onClick={() => {
                setSelectedTeamId(team.id);
                setSelectedMemberId(null);
              }}
              className={`px-4 py-2 rounded border text-left ${
                isActive ? "bg-blue-600 text-white" : "bg-white"
              }`}
            >
              <div className="font-semibold">{team.name}</div>
              <div className="text-xs opacity-80">
                {memberCount} thành viên · {companyCount} doanh nghiệp
              </div>
            </button>
          );
        })}
      </div>

      {selectedTeam ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
          <div className="space-y-4">
            <div className="border rounded p-4 space-y-3 bg-white shadow-sm">
              <h3 className="font-semibold text-sm uppercase text-gray-500">
                Thành viên của {selectedTeam.name}
              </h3>
              {canEdit ? (
                <form className="flex gap-2" onSubmit={handleAddMember}>
                  <input
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Tên thành viên mới"
                    className="flex-1 border rounded px-2 py-1"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-emerald-600 text-white"
                  >
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
                            onClick={() => setSelectedMemberId(member.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left ${
                              isActiveMember ? "bg-blue-50" : ""
                            }`}
                          >
                            <span>{member.name}</span>
                            <span className="text-xs text-gray-500">
                              {assigned} DN
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="border rounded p-4 bg-white shadow-sm space-y-3">
              <h3 className="font-semibold text-sm uppercase text-gray-500">
                Chi tiết thành viên
              </h3>
              {activeMember ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs uppercase text-gray-400">
                      Tên thành viên
                    </label>
                    <input
                      value={memberNameDraft}
                      onChange={(e) => setMemberNameDraft(e.target.value)}
                      onBlur={commitMemberName}
                      onKeyDown={handleMemberNameKey}
                      className="mt-1 w-full border rounded px-2 py-1"
                      readOnly={isReadOnly}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-gray-400">
                      Thuộc tổ đội
                    </label>
                    <select
                      value={selectedTeamId ?? ""}
                      onChange={(e) =>
                        handleMoveMember(activeMember.id, e.target.value)
                      }
                      className="mt-1 w-full border rounded px-2 py-1"
                      disabled={isReadOnly}
                    >
                      {roster.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={commitMemberName}
                        className="px-3 py-1 rounded border"
                      >
                        Cập nhật tên
                      </button>
                      <button
                        onClick={() => handleRemoveMember(activeMember.id)}
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

          <div className="border rounded p-4 bg-white shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-sm uppercase text-gray-500">
                {activeMember
                  ? `Doanh nghiệp phụ trách của ${activeMember.name}`
                  : `Doanh nghiệp theo ${selectedTeam.name}`}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>
                  {displayCompanies.length} doanh nghiệp đang được gán
                </span>
                {activeMember && (
                  <button
                    type="button"
                    onClick={() => setSelectedMemberId(null)}
                    className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                  >
                    Xem toàn bộ team
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto border rounded">
              {displayCompanies.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {activeMember
                    ? "Thành viên này chưa được gán doanh nghiệp nào trong bảng MST."
                    : "Team chưa được gán doanh nghiệp nào trong bảng MST."}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left w-28">MST</th>
                      <th className="p-2 text-left">Công ty</th>
                      {activeMember ? (
                        <th className="p-2 text-left w-24">Vai trò</th>
                      ) : (
                        <>
                          <th className="p-2 text-left w-40">Phụ trách Nhập</th>
                          <th className="p-2 text-left w-40">Phụ trách Xuất</th>
                        </>
                      )}
                      <th className="p-2 text-left w-32">Áp dụng từ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCompanies.map((row, idx) => (
                      <tr
                        key={`${row.mst}-${row.company}-${idx}-${activeMember ? row.role : "team"}`}
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

            {displayCompanies.length > COMPANY_PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() =>
                    setCompanyPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentCompanyPage <= 1}
                  className={`px-3 py-1 rounded border ${
                    currentCompanyPage <= 1
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  ← Trước
                </button>
                <span>
                  Trang {currentCompanyPage}/{totalCompanyPages}
                </span>
                <button
                  onClick={() =>
                    setCompanyPage((page) =>
                      Math.min(totalCompanyPages, page + 1)
                    )
                  }
                  disabled={currentCompanyPage >= totalCompanyPages}
                  className={`px-3 py-1 rounded border ${
                    currentCompanyPage >= totalCompanyPages
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  Sau →
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="border rounded p-6 text-center text-gray-500">
          Chưa có dữ liệu tổ đội để hiển thị. Hãy thêm thành viên cho một team.
        </div>
      )}
    </div>
  );
}

export default TeamManager;
