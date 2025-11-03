import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as XLSX from "xlsx";

import {

  getTeamRoster,

  setTeamRoster,

  getMSTMap,

  upsertMSTRows,

  normalizeName,

  normalizeStr,

  applyTeamRosterToMST,

  mapMemberNamesToTeams,

  getMSTHistoryEntries,

  getAuditLogs,

} from "@/lib/store.js";



const COMPANY_PAGE_SIZE = 20;

const MST_HISTORY_FIELD_LABELS = {

  person_import: "Người phụ trách Nhập",

  person_export: "Người phụ trách Xuất",

  effective_from: "Áp dụng từ ngày",

};



const formatHistoryTimestamp = (value) => {

  if (!value) return "";

  try {

    return new Date(value).toLocaleString("vi-VN", { hour12: false });

  } catch (error) {

    console.warn("formatHistoryTimestamp", error);

    return value;

  }

};



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

  const [historyOpen, setHistoryOpen] = useState(false);

  const [historyTab, setHistoryTab] = useState("team");

  const [teamHistory, setTeamHistory] = useState(() =>

    getAuditLogs(100).filter((entry) => entry?.action?.startsWith("team"))

  );

  const [mstHistory, setMstHistory] = useState(() =>

    getMSTHistoryEntries(100)

  );



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



  const memberTeamMap = useMemo(

    () => mapMemberNamesToTeams(roster),

    [roster]

  );



  const refreshHistory = useCallback(() => {

    setTeamHistory(

      getAuditLogs(100).filter((entry) => entry?.action?.startsWith("team"))

    );

    setMstHistory(getMSTHistoryEntries(100));

  }, []);



  useEffect(() => {

    if (historyOpen) {

      refreshHistory();

    }

  }, [historyOpen, refreshHistory]);



  const resolveTeamForRow = useCallback(

    (row) => {

      if (!row) return "";

      const direct = normalizeStr(row.team);

      if (direct) return direct;



      const importKey = normalizeName(row.person_import);

      if (importKey && memberTeamMap.has(importKey)) {

        return memberTeamMap.get(importKey)?.team || "";

      }



      const exportKey = normalizeName(row.person_export);

      if (exportKey && memberTeamMap.has(exportKey)) {

        return memberTeamMap.get(exportKey)?.team || "";

      }



      return "";

    },

    [memberTeamMap]

  );



  const memberAssignments = useMemo(() => {
    const map = new Map();
    const roleOrder = ["Nhập", "Xuất"];
    const getRoleIndex = (value) => {
      const index = roleOrder.indexOf(value);
      return index === -1 ? roleOrder.length : index;
    };

    const getAssignmentKey = (row) => {
      const mstKey = (row.mst || "").trim();
      if (mstKey) return mstKey;
      const companyKey = normalizeStr(row.company);
      return `${mstKey}-${companyKey}`;
    };

    const ensureMemberAssignments = (rawName) => {
      const memberKey = normalizeName(rawName);
      if (!memberKey) return null;
      if (!map.has(memberKey)) {
        map.set(memberKey, new Map());
      }
      return { memberKey, assignments: map.get(memberKey) };
    };

    const mergeAssignment = (rawName, row, role) => {
      const entry = ensureMemberAssignments(rawName);
      if (!entry) return;

      const { assignments } = entry;
      const assignmentKey = getAssignmentKey(row) || `unknown-${assignments.size}`;
      const resolvedTeam = resolveTeamForRow(row);

      if (!assignments.has(assignmentKey)) {
        assignments.set(assignmentKey, {
          mst: row.mst || "",
          company: row.company || "",
          roles: new Set([role]),
          team: resolvedTeam,
          person_import: row.person_import || "",
          person_export: row.person_export || "",
          effective_from: row.effective_from || "",
        });
        return;
      }

      const existing = assignments.get(assignmentKey);
      existing.roles.add(role);
      if (!existing.company && row.company) existing.company = row.company;
      if (!existing.team && resolvedTeam) existing.team = resolvedTeam;
      if (!existing.person_import && row.person_import)
        existing.person_import = row.person_import;
      if (!existing.person_export && row.person_export)
        existing.person_export = row.person_export;
      if (!existing.effective_from && row.effective_from)
        existing.effective_from = row.effective_from;
    };

    for (const row of mstRows) {
      mergeAssignment(row.person_import, row, "Nhập");
      mergeAssignment(row.person_export, row, "Xuất");
    }

    for (const [memberKey, assignmentsMap] of Array.from(map.entries())) {
      const list = Array.from(assignmentsMap.values()).map((item) => {
        const sortedRoles = Array.from(item.roles).sort(
          (a, b) => getRoleIndex(a) - getRoleIndex(b)
        );
        return {
          mst: item.mst,
          company: item.company,
          role: sortedRoles.join(", "),
          team: item.team,
          person_import: item.person_import,
          person_export: item.person_export,
          effective_from: item.effective_from,
        };
      });

      list.sort((a, b) => {
        const cmpCompany = a.company.localeCompare(b.company, "vi", {
          sensitivity: "base",
        });
        if (cmpCompany !== 0) return cmpCompany;
        return a.mst.localeCompare(b.mst);
      });

      map.set(memberKey, list);
    }

    return map;
  }, [mstRows, resolveTeamForRow]);



  const teamCompanies = useMemo(() => {

    if (!selectedTeam) return [];

    const teamKey = normalizeName(selectedTeam.name);

    if (!teamKey) return [];

    const companies = mstRows

      .filter((row) => normalizeName(resolveTeamForRow(row)) === teamKey)

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

  }, [selectedTeam, mstRows, resolveTeamForRow]);



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

      const key = normalizeName(resolveTeamForRow(row));

      if (!key) continue;

      counts.set(key, (counts.get(key) ?? 0) + 1);

    }

    return counts;

  }, [mstRows, resolveTeamForRow]);



  const handleExportExcel = useCallback(() => {

    const workbook = XLSX.utils.book_new();

    const teams = Array.isArray(roster?.teams) ? roster.teams : [];



    const memberRows = [];

    for (const team of teams) {

      const teamName = normalizeStr(team?.name) || "";

      const members = Array.isArray(team?.members) ? team.members : [];

      if (members.length) {

        for (const member of members) {

          memberRows.push({

            "Tổ đội": teamName,

            "Thành viên": member?.name ? normalizeStr(member.name) : "",

          });

        }

      } else {

        memberRows.push({ "Tổ đội": teamName, "Thành viên": "" });

      }

    }



    if (!memberRows.length) {

      memberRows.push({ "Tổ đội": "", "Thành viên": "" });

    }



    const memberSheet = XLSX.utils.json_to_sheet(memberRows);

    XLSX.utils.book_append_sheet(workbook, memberSheet, "Thanh_vien");



    const companyRows = [];

    for (const team of teams) {

      const teamName = normalizeStr(team?.name) || "";

      const teamKey = normalizeName(teamName);

      const rowsForTeam = mstRows

        .filter((row) => normalizeName(resolveTeamForRow(row)) === teamKey)

        .map((row) => ({

          "Tổ đội": teamName,

          MST: row?.mst ? normalizeStr(row.mst) : "",

          "Công ty": row?.company ? normalizeStr(row.company) : "",

          "Người phụ trách Nhập": row?.person_import ? normalizeStr(row.person_import) : "",

          "Người phụ trách Xuất": row?.person_export ? normalizeStr(row.person_export) : "",

          "Áp dụng từ ngày": row?.effective_from ? normalizeStr(row.effective_from) : "",

        }))

        .sort((a, b) => {

          const cmpCompany = a["Công ty"].localeCompare(b["Công ty"], "vi", {

            sensitivity: "base",

          });

          if (cmpCompany !== 0) return cmpCompany;

          return a.MST.localeCompare(b.MST);

        });



      if (!rowsForTeam.length) {

        rowsForTeam.push({

          "Tổ đội": teamName,

          MST: "",

          "Công ty": "",

          "Người phụ trách Nhập": "",

          "Người phụ trách Xuất": "",

          "Áp dụng từ ngày": "",

        });

      }



      companyRows.push(...rowsForTeam);

    }



    if (!companyRows.length) {

      companyRows.push({

        "Tổ đội": "",

        MST: "",

        "Công ty": "",

        "Người phụ trách Nhập": "",

        "Người phụ trách Xuất": "",

        "Áp dụng từ ngày": "",

      });

    }



    const companySheet = XLSX.utils.json_to_sheet(companyRows);

    XLSX.utils.book_append_sheet(workbook, companySheet, "Cong_ty");



    const stamp = new Date().toISOString().slice(0, 10);

    XLSX.writeFile(workbook, `to-doi_${stamp}.xlsx`);

  }, [roster, mstRows, resolveTeamForRow]);



  const handleRefreshMST = () => {

    setMstRows(getMSTMap());

    setCompanyPage(1);

    refreshHistory();

  };



  const handleReloadRoster = () => {

    const fresh = getTeamRoster();

    setRoster(fresh);

    setDirty(false);

    refreshHistory();

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

      refreshHistory();

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

        <button

          type="button"

          onClick={() => setHistoryOpen((prev) => !prev)}

          className={`px-3 py-1 rounded border transition-colors ${

            historyOpen ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"

          }`}

          title={

            historyOpen

              ? "Ẩn bảng lịch sử thay đổi tổ đội và gán MST"

              : "Xem lịch sử thay đổi tổ đội, team và trường MST liên quan"

          }

          data-tooltip="Xem/ẩn lịch sử thay đổi team và MST"

        >

          {historyOpen ? "Ẩn lịch sử" : "Lịch sử cập nhật"}

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

        <button

          type="button"

          onClick={handleExportExcel}

          className="ml-auto px-3 py-1 rounded border bg-white hover:bg-gray-50"

        >

          Export Excel

        </button>

        <span className="text-sm text-gray-500 ml-2">

          Tổng cộng {roster.teams.length} tổ đội — {totalMembers} thành viên

        </span>

      </div>



      <p className="text-sm text-gray-600">

        Quản lý danh sách tổ đội để đồng bộ với dữ liệu gán MST và báo cáo KPI.

        Chọn một team để xem thành viên, doanh nghiệp phụ trách và điều chỉnh.

      </p>



      {historyOpen && (

        <div className="border rounded-lg bg-white shadow-sm p-4 space-y-3">

          <div className="flex flex-wrap items-center gap-2 text-sm">

            <span className="font-semibold text-gray-700">

              Lịch sử thay đổi

            </span>

            <button

              type="button"

              onClick={() => setHistoryTab("team")}

              className={`px-3 py-1 rounded border text-xs ${

                historyTab === "team"

                  ? "bg-blue-600 text-white border-blue-600"

                  : "bg-white hover:bg-gray-50"

              }`}

              title="Các lần lưu chỉnh sửa tổ đội"

              data-tooltip="Hiển thị lịch sử lưu tổ đội"

            >

              Tổ đội

            </button>

            <button

              type="button"

              onClick={() => setHistoryTab("mst")}

              className={`px-3 py-1 rounded border text-xs ${

                historyTab === "mst"

                  ? "bg-blue-600 text-white border-blue-600"

                  : "bg-white hover:bg-gray-50"

              }`}

              title="Các lần chỉnh sửa trường MST (người phụ trách, hiệu lực)"

              data-tooltip="Hiển thị lịch sử chỉnh sửa MST"

            >

              MST

            </button>

            <button

              type="button"

              onClick={refreshHistory}

              className="ml-auto px-3 py-1 rounded border text-xs bg-white hover:bg-gray-50"

              title="Làm mới lịch sử từ bộ nhớ"

              data-tooltip="Tải lại lịch sử"

            >

              Làm mới

            </button>

          </div>

          <div className="max-h-64 overflow-y-auto text-sm text-gray-700 pr-1">

            {historyTab === "team" ? (

              teamHistory.length ? (

                <ul className="space-y-2">

                  {teamHistory.map((entry, idx) => (

                    <li

                      key={`${entry.ts || "team"}-${idx}`}

                      className="border rounded px-3 py-2 bg-gray-50"

                    >

                      <div className="font-medium text-gray-800">

                        {formatHistoryTimestamp(entry.ts)} — {entry.actor || "Hệ thống"}

                      </div>

                      <div className="text-xs text-gray-600">

                        {entry.detail || "Cập nhật tổ đội"}

                      </div>

                    </li>

                  ))}

                </ul>

              ) : (

                <p className="italic text-gray-500">

                  Chưa ghi nhận lịch sử lưu tổ đội.

                </p>

              )

            ) : mstHistory.length ? (

              <ul className="space-y-2">

                {mstHistory.map((entry) => (

                  <li key={entry.id} className="border rounded px-3 py-2 bg-gray-50">

                    <div className="font-medium text-gray-800">

                      {formatHistoryTimestamp(entry.timestamp)} — {entry.actor || "Hệ thống"}

                    </div>

                    <div className="text-xs text-gray-600">

                      MST: <span className="font-semibold">{entry.mst}</span> · Trường: {MST_HISTORY_FIELD_LABELS[entry.field] || entry.field}

                    </div>

                    <div className="text-xs text-gray-600">

                      <span className="text-gray-500">Từ:</span>{" "}

                      {entry.from ? (

                        <span>{entry.from}</span>

                      ) : (

                        <span className="italic text-gray-400">(trống)</span>

                      )}

                    </div>

                    <div className="text-xs text-gray-600">

                      <span className="text-gray-500">Đến:</span>{" "}

                      {entry.to ? (

                        <span>{entry.to}</span>

                      ) : (

                        <span className="italic text-gray-400">(trống)</span>

                      )}

                    </div>

                  </li>

                ))}

              </ul>

            ) : (

              <p className="italic text-gray-500">

                Chưa ghi nhận lịch sử thay đổi trường MST.

              </p>

            )}

          </div>

        </div>

      )}



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

