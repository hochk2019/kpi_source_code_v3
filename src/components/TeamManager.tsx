import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDialog } from '@/hooks/useAppDialog';
import { t } from '@/lib/i18n.js';

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
import TeamManagerHistoryPanel from "@/components/team-manager/TeamManagerHistoryPanel.jsx";
import TeamManagerMemberPanel from "@/components/team-manager/TeamManagerMemberPanel.jsx";
import TeamManagerCompaniesPanel from "@/components/team-manager/TeamManagerCompaniesPanel.jsx";
import TeamManagerToolbar from "@/components/team-manager/TeamManagerToolbar.jsx";
import EmptyState from "@/components/shared/EmptyState.tsx";
import { loadXlsx } from "@/lib/loadXlsx.js";
import type { AuthAccountView, TeamRecord, TeamRoster } from '@/types';

const COMPANY_PAGE_SIZE = 20;

function makeMemberId(teamId: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return `${teamId}-${stamp}-${random}`;
}

interface MSTRow {
  mst: string;
  company?: string;
  person_import?: string;
  person_export?: string;
  effective_from?: string;
  team?: string;
  [key: string]: unknown;
}

interface MemberAssignment {
  mst: string;
  company: string;
  role: string;
  team: string;
  person_import: string;
  person_export: string;
  effective_from: string;
}

interface TeamManagerProps {
  canEdit?: boolean;
  currentUser?: AuthAccountView | null;
}

function TeamManager({ canEdit = true, currentUser = null }: TeamManagerProps) {
  const { alert, confirm } = useAppDialog();
  const initialRosterRef = useRef<TeamRoster | null>(null);

  if (!initialRosterRef.current) {
    initialRosterRef.current = getTeamRoster();
  }

  const [roster, setRoster] = useState<TeamRoster>(initialRosterRef.current!);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    initialRosterRef.current!.teams[0]?.id ?? null,
  );

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const [mstRows, setMstRows] = useState<MSTRow[]>(() => getMSTMap());

  const [newMemberName, setNewMemberName] = useState("");

  const [memberNameDraft, setMemberNameDraft] = useState("");

  const [dirty, setDirty] = useState(false);

  const [companyPage, setCompanyPage] = useState(1);

  const [historyOpen, setHistoryOpen] = useState(false);

  const [historyTab, setHistoryTab] = useState("team");

  const [teamHistory, setTeamHistory] = useState(() =>
    getAuditLogs(100).filter((entry: { action?: string }) => entry?.action?.startsWith("team")),
  );

  const [mstHistory, setMstHistory] = useState(() => getMSTHistoryEntries(100));

  const actor = currentUser?.username || "guest";

  const isReadOnly = !canEdit;

  const selectedTeam = useMemo(
    () => roster.teams.find((team) => team.id === selectedTeamId) ?? null,
    [roster, selectedTeamId],
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
    if (selectedMemberId && !selectedTeam.members.some((m) => m.id === selectedMemberId)) {
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
    [roster],
  );

  const refreshHistory = useCallback(() => {
    setTeamHistory(getAuditLogs(100).filter((entry: { action?: string }) => entry?.action?.startsWith("team")));
    setMstHistory(getMSTHistoryEntries(100));
  }, []);

  useEffect(() => {
    if (historyOpen) {
      refreshHistory();
    }
  }, [historyOpen, refreshHistory]);

  const resolveTeamForRow = useCallback(
    (row: MSTRow): string => {
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
    [memberTeamMap],
  );

  const memberAssignments = useMemo(() => {
    const assignments = new Map<string, Map<string, MemberAssignment>>();

    const upsert = (rawName: string, row: MSTRow, role: string) => {
      const memberKey = normalizeName(rawName);
      if (!memberKey) return;

      let inner = assignments.get(memberKey);
      if (!inner) {
        inner = new Map();
        assignments.set(memberKey, inner);
      }

      const mstKeyRaw = (row?.mst ?? "").toString().trim();
      const companyKeyRaw = (row?.company ?? "").toString().trim();
      const entryKey = mstKeyRaw ? `mst:${mstKeyRaw}` : `company:${companyKeyRaw}`;

      const current = inner.get(entryKey) ?? {
        mst: row.mst,
        company: row.company || "",
        roles: new Set<string>(),
        team: resolveTeamForRow(row),
        person_import: row.person_import || "",
        person_export: row.person_export || "",
        effective_from: row.effective_from || "",
      };

      if (role) (current as MemberAssignment & { roles: Set<string> }).roles.add(role);
      inner.set(entryKey, current as MemberAssignment & { roles: Set<string> });
    };

    for (const row of mstRows) {
      if (!row) continue;
      if (row.person_import) upsert(row.person_import, row, "Nhập");
      if (row.person_export) upsert(row.person_export, row, "Xuất");
    }

    const result = new Map<string, MemberAssignment[]>();

    for (const [memberKey, inner] of assignments.entries()) {
      const list = Array.from(inner.values()).map((item) => {
        const roles = Array.from((item as MemberAssignment & { roles: Set<string> }).roles);
        roles.sort((a, b) =>
          a === "Nhập" ? -1 : b === "Nhập" ? 1 : a.localeCompare(b, "vi", { sensitivity: "base" }),
        );
        return {
          mst: item.mst,
          company: item.company,
          role: roles.join(", "),
          team: item.team,
          person_import: item.person_import,
          person_export: item.person_export,
          effective_from: item.effective_from,
        };
      });

      list.sort((a, b) => {
        const cmpCompany = a.company.localeCompare(b.company, "vi", { sensitivity: "base" });
        if (cmpCompany !== 0) return cmpCompany;
        return (a.mst || "").localeCompare(b.mst || "");
      });

      result.set(memberKey, list);
    }

    return result;
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
      const cmpCompany = a.company.localeCompare(b.company, "vi", { sensitivity: "base" });
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

  const totalCompanyPages = Math.max(1, Math.ceil(displayCompanies.length / COMPANY_PAGE_SIZE));
  const currentCompanyPage = Math.min(companyPage, totalCompanyPages);
  const pagedCompanies = displayCompanies.slice(
    (currentCompanyPage - 1) * COMPANY_PAGE_SIZE,
    currentCompanyPage * COMPANY_PAGE_SIZE,
  );

  const teamCompanyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of mstRows) {
      const key = normalizeName(resolveTeamForRow(row));
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [mstRows, resolveTeamForRow]);

  const handleExportExcel = useCallback(async () => {
    try {
      const xlsx = await loadXlsx();
      const workbook = xlsx.utils.book_new();

      const teams = Array.isArray(roster?.teams) ? roster.teams : [];
      const memberRows: Record<string, string>[] = [];

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

      const memberSheet = xlsx.utils.json_to_sheet(memberRows);
      xlsx.utils.book_append_sheet(workbook, memberSheet, "Thanh_vien");

      const companyRows: Record<string, string>[] = [];

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
            const cmpCompany = a["Công ty"].localeCompare(b["Công ty"], "vi", { sensitivity: "base" });
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

      const companySheet = xlsx.utils.json_to_sheet(companyRows);
      xlsx.utils.book_append_sheet(workbook, companySheet, "Cong_ty");

      const stamp = new Date().toISOString().slice(0, 10);
      xlsx.writeFile(workbook, `to-doi_${stamp}.xlsx`);
    } catch (error) {
      console.error(error);
      await alert(t('team.exportExcelError'));
    }
  }, [roster, mstRows, resolveTeamForRow, alert]);

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

  const handleAddMember = async (event: React.FormEvent) => {
    if (isReadOnly) return;
    event.preventDefault();
    if (!selectedTeam) return;

    const trimmed = normalizeStr(newMemberName);
    if (!trimmed) return;

    const exists = selectedTeam.members.some(
      (member) => normalizeName(member.name) === normalizeName(trimmed),
    );

    if (exists) {
      await alert(t('team.memberExists'));
      return;
    }

    const memberId = makeMemberId(selectedTeam.id);
    const newMember = { id: memberId, name: trimmed };

    setRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === selectedTeam.id ? { ...team, members: [...team.members, newMember] } : team,
      ),
    }));

    setNewMemberName("");
    setSelectedMemberId(memberId);
    setDirty(true);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (isReadOnly) return;
    if (!selectedTeam) return;

    const member = selectedTeam.members.find((m) => m.id === memberId);
    if (!member) return;

    if (!await confirm(t('team.removeConfirm', { name: member.name, team: selectedTeam.name }), { variant: 'destructive', confirmLabel: t('common.delete') })) return;

    setRoster((prev) => ({
      ...prev,
      teams: prev.teams.map((team) =>
        team.id === selectedTeam.id
          ? { ...team, members: team.members.filter((m) => m.id !== memberId) }
          : team,
      ),
    }));

    setDirty(true);
    if (selectedMemberId === memberId) {
      setSelectedMemberId(null);
    }
  };

  const handleMoveMember = (memberId: string, targetTeamId: string) => {
    if (isReadOnly) return;
    if (!targetTeamId || targetTeamId === selectedTeamId) return;

    const targetTeam = roster.teams.find((team) => team.id === targetTeamId);
    if (!targetTeam) return;

    let movedMember: { id: string; name: string } | null = null;

    setRoster((prev) => {
      let foundMember: { id: string; name: string } | null = null;

      const withoutMember = prev.teams.map((team) => {
        if (!team.members.some((m) => m.id === memberId)) return team;
        const member = team.members.find((m) => m.id === memberId);
        if (!member) return team;
        foundMember = member;
        return { ...team, members: team.members.filter((m) => m.id !== memberId) };
      });

      if (!foundMember) return prev;

      const updatedTeams = withoutMember.map((team) =>
        team.id === targetTeamId ? { ...team, members: [...team.members, foundMember!] } : team,
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

  const commitMemberName = async () => {
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
        member.id !== activeMember.id && normalizeName(member.name) === normalizeName(trimmed),
    );

    if (duplicated) {
      await alert(t('team.duplicateMemberName'));
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
                member.id === activeMember.id ? { ...member, name: trimmed } : member,
              ),
            }
          : team,
      ),
    }));

    setMemberNameDraft(trimmed);
    setDirty(true);
  };

  const handleMemberNameKey = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitMemberName();
    }
  };

  const handleSave = async () => {
    if (isReadOnly) {
      await alert(t('team.noSavePermission'));
      return;
    }

    try {
      const previousRoster = getTeamRoster();
      const sanitized = await setTeamRoster(roster, {
        actor,
        detail: t('team.auditDetail'),
      });
      setRoster(sanitized);

      const { rows, changed } = applyTeamRosterToMST(sanitized, mstRows, {
        previousRoster,
      });

      if (changed) {
        upsertMSTRows(rows, {
          actor,
          detail: t('team.auditSyncMST'),
        });
        setMstRows(rows);
      }

      setDirty(false);
      refreshHistory();
      await alert(
        changed ? t('team.saveSyncSuccess') : t('team.saveSuccess'),
      );
    } catch (error) {
      console.error(error);
      await alert(t('team.saveError'));
    }
  };

  const totalMembers = roster.teams.reduce(
    (sum, team) => sum + team.members.length,
    0,
  );

  return (
    <div className="p-6 space-y-6">
      {isReadOnly && (
        <div className="rounded border border-ds-warning/30 bg-ds-warning/10 p-3 text-sm text-ds-warning">
          {t('team.readOnlyBanner')}
        </div>
      )}

      <TeamManagerToolbar
        dirty={dirty}
        isReadOnly={isReadOnly}
        roster={roster}
        totalMembers={totalMembers}
        onSave={handleSave}
        onReloadRoster={handleReloadRoster}
        onRefreshMST={handleRefreshMST}
        historyOpen={historyOpen}
        onToggleHistory={() => setHistoryOpen((prev) => !prev)}
        onExportExcel={handleExportExcel}
      />

      <p className="text-sm text-ds-text-secondary">
        {t('team.description')}
      </p>

      <TeamManagerHistoryPanel
        historyOpen={historyOpen}
        historyTab={historyTab}
        teamHistory={teamHistory}
        mstHistory={mstHistory}
        onHistoryTabChange={setHistoryTab}
        onRefresh={refreshHistory}
      />

      {roster.teams.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={t('team.emptyTitle')}
          description={t('team.emptyDescription')}
        />
      ) : (
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
                  isActive ? "bg-ds-accent text-ds-text-inverse" : "bg-ds-surface-card"
                }`}
              >
                <div className="font-semibold">{team.name}</div>
                <div className="text-xs opacity-80">
                  {t('team.teamStats', { members: memberCount, companies: companyCount })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedTeam ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
          <TeamManagerMemberPanel
            selectedTeam={selectedTeam}
            canEdit={canEdit}
            isReadOnly={isReadOnly}
            newMemberName={newMemberName}
            onNewMemberNameChange={setNewMemberName}
            onAddMember={handleAddMember}
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
            memberAssignments={memberAssignments}
            activeMember={activeMember}
            memberNameDraft={memberNameDraft}
            onMemberNameDraftChange={setMemberNameDraft}
            onCommitMemberName={commitMemberName}
            onMemberNameKey={handleMemberNameKey}
            teams={roster.teams}
            selectedTeamId={selectedTeamId}
            onMoveMember={handleMoveMember}
            onRemoveMember={handleRemoveMember}
            memberCompanies={memberCompanies}
          />

          <TeamManagerCompaniesPanel
            activeMember={activeMember}
            selectedTeam={selectedTeam}
            displayCompanies={displayCompanies}
            pagedCompanies={pagedCompanies}
            currentCompanyPage={currentCompanyPage}
            totalCompanyPages={totalCompanyPages}
            showPagination={displayCompanies.length > COMPANY_PAGE_SIZE}
            onShowAllTeamCompanies={() => setSelectedMemberId(null)}
            onPreviousPage={() => setCompanyPage((page) => Math.max(1, page - 1))}
            onNextPage={() => setCompanyPage((page) => Math.min(totalCompanyPages, page + 1))}
          />
        </div>
      ) : (
        <div className="border rounded p-6 text-center text-ds-text-muted">
          {t('team.noDataMessage')}
        </div>
      )}
    </div>
  );
}

export default TeamManager;
