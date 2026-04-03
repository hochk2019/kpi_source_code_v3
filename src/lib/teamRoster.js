const DEFAULT_ROSTER = Object.freeze({
  version: 1,
  teams: [
    {
      id: "team-1",
      name: "Team 1",
      members: [
        { id: "team-1-phuong", name: "Ph\u01b0\u01a1ng" },
        { id: "team-1-hanh", name: "H\u1ea1nh" },
        { id: "team-1-bao", name: "B\u1ea3o" },
        { id: "team-1-ha-be", name: "H\u00e0 B\u00e9" },
        { id: "team-1-huong", name: "H\u01b0\u01a1ng" },
      ],
    },
    {
      id: "team-2",
      name: "Team 2",
      members: [
        { id: "team-2-tuan", name: "Tu\u1ea5n" },
        { id: "team-2-hoa", name: "H\u00f2a" },
        { id: "team-2-thu", name: "Thu" },
        { id: "team-2-hang", name: "H\u1eb1ng" },
        { id: "team-2-huyen", name: "Huy\u1ec1n" },
      ],
    },
    {
      id: "team-3",
      name: "Team 3",
      members: [
        { id: "team-3-hoc", name: "H\u1ecdc" },
        { id: "team-3-thanh", name: "Thanh" },
        { id: "team-3-huy", name: "Huy" },
        { id: "team-3-linh", name: "Linh" },
        { id: "team-3-thao", name: "Th\u1ea3o" },
        { id: "team-3-hung", name: "H\u01b0ng" },
      ],
    },
  ],
});

function deepCloneRoster(roster) {
  return {
    version: roster?.version ?? 1,
    teams: Array.isArray(roster?.teams)
      ? roster.teams.map((team) => ({
          id: team.id,
          name: team.name,
          members: Array.isArray(team.members)
            ? team.members.map((member) => ({
                id: member.id,
                name: member.name,
                notes: member.notes ?? "",
              }))
            : [],
        }))
      : [],
  };
}

export function createTeamRosterStore({
  getItem = () => null,
  setItem = () => {},
  subscribe = () => () => {},
  pushAuditLog = null,
  safeParse = (_json, fallback) => fallback,
  normalizeStr = (value) => String(value ?? "").replace(/\s+/g, " ").trim(),
  stripDiacritics = (value) =>
    normalizeStr(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim(),
  normalizeName = (value) => stripDiacritics(value).toLowerCase(),
  sanitizeMSTRow = (row) => row,
  teamKey = "team_roster_v1",
  defaultRoster = DEFAULT_ROSTER,
  reportSubscribeError = (...args) => console.error(...args),
} = {}) {
  function slugify(value, fallback = "") {
    const base = stripDiacritics(value) || fallback;
    const slug = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || fallback || "item";
  }

  function sanitizeMember(member, teamId, usedMemberIds, index) {
    const name = normalizeStr(member?.name);
    if (!name) return null;

    let candidateId = normalizeStr(member?.id);
    const memberFallback = `nv-${index + 1}`;
    if (!candidateId) {
      candidateId = `${teamId}-${slugify(name, memberFallback)}`;
    }
    candidateId = slugify(candidateId, `${teamId}-nv-${index + 1}`);

    let suffix = 1;
    let finalId = candidateId;
    while (usedMemberIds.has(finalId)) {
      finalId = `${candidateId}-${suffix++}`;
    }
    usedMemberIds.add(finalId);

    const notes = normalizeStr(member?.notes);
    return notes ? { id: finalId, name, notes } : { id: finalId, name };
  }

  function sanitizeTeam(team, fallbackName, usedTeamIds, index) {
    const name = normalizeStr(team?.name) || fallbackName || `Team ${index + 1}`;

    let candidateId = normalizeStr(team?.id);
    if (!candidateId) {
      candidateId = `team-${slugify(name, String(index + 1))}`;
    }
    candidateId = slugify(candidateId, `team-${index + 1}`);
    if (!candidateId.startsWith("team-")) {
      candidateId = `team-${candidateId}`;
    }

    let suffix = 1;
    let finalId = candidateId;
    while (usedTeamIds.has(finalId)) {
      finalId = `${candidateId}-${suffix++}`;
    }
    usedTeamIds.add(finalId);

    const rawMembers = Array.isArray(team?.members) ? team.members : [];
    const usedMemberIds = new Set();
    const members = rawMembers
      .map((member, idx) => sanitizeMember(member, finalId, usedMemberIds, idx))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));

    return { id: finalId, name, members };
  }

  function sanitizeRoster(data) {
    if (!data) {
      return deepCloneRoster(defaultRoster);
    }

    const teamsInput = Array.isArray(data.teams)
      ? data.teams
      : Array.isArray(data)
        ? data
        : [];

    if (!teamsInput.length) {
      return deepCloneRoster(defaultRoster);
    }

    const usedTeamIds = new Set();
    const teams = teamsInput
      .map((team, idx) => sanitizeTeam(team, team?.name, usedTeamIds, idx))
      .filter(Boolean);

    if (!teams.length) {
      return deepCloneRoster(defaultRoster);
    }

    return { version: 1, teams };
  }

  function getTeamRoster() {
    const raw = safeParse(getItem(teamKey), null);
    const sanitized = sanitizeRoster(raw);
    if (!raw || !raw.teams) {
      setItem(teamKey, JSON.stringify(sanitized));
    }
    return sanitized;
  }

  function subscribeTeamRoster(listener) {
    const callback = typeof listener === "function" ? listener : null;
    if (!callback) {
      return () => {};
    }

    const emit = () => {
      try {
        callback(getTeamRoster());
      } catch (error) {
        reportSubscribeError("Khong the cap nhat danh sach to doi", error);
      }
    };

    const unsubscribe = subscribe(teamKey, emit);
    emit();

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }

  function setTeamRoster(next, { actor = "system", detail = "" } = {}) {
    const normalizedInput =
      Array.isArray(next?.teams) || Array.isArray(next)
        ? next
        : deepCloneRoster(defaultRoster);

    const sanitized = sanitizeRoster(
      Array.isArray(normalizedInput)
        ? { version: 1, teams: normalizedInput }
        : normalizedInput,
    );
    setItem(teamKey, JSON.stringify(sanitized));

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "team.save",
        detail: detail || `Cap nhat ${sanitized.teams.length} to doi`,
      });
    }

    return sanitized;
  }

  function mapMemberNamesToTeams(source) {
    const roster = sanitizeRoster(
      Array.isArray(source?.teams) || Array.isArray(source)
        ? source
        : deepCloneRoster(defaultRoster),
    );

    const map = new Map();
    for (const team of roster.teams) {
      const teamName = normalizeStr(team?.name);
      if (!teamName) continue;

      for (const member of team.members || []) {
        const memberName = normalizeStr(member?.name);
        const key = normalizeName(memberName);
        if (!key || map.has(key)) continue;

        map.set(key, {
          team: teamName,
          name: memberName,
        });
      }
    }
    return map;
  }

  function applyTeamRosterToMST(rosterLike, rows, options = {}) {
    const sanitizedRoster = sanitizeRoster(
      Array.isArray(rosterLike?.teams) || Array.isArray(rosterLike)
        ? rosterLike
        : deepCloneRoster(defaultRoster),
    );
    const memberMap = mapMemberNamesToTeams(sanitizedRoster);

    const previousRoster = options?.previousRoster
      ? sanitizeRoster(options.previousRoster)
      : null;

    if (previousRoster) {
      const prevById = new Map();
      for (const team of previousRoster.teams) {
        const prevTeamName = normalizeStr(team?.name);
        for (const member of team.members || []) {
          prevById.set(member.id, {
            name: normalizeStr(member?.name),
            team: prevTeamName,
          });
        }
      }

      for (const team of sanitizedRoster.teams) {
        const teamName = normalizeStr(team?.name);
        for (const member of team.members || []) {
          const info = {
            team: teamName,
            name: normalizeStr(member?.name),
          };
          const prev = prevById.get(member.id);
          if (!prev) continue;

          const prevKey = normalizeName(prev.name);
          if (prevKey) {
            memberMap.set(prevKey, info);
          }
        }
      }
    }

    const sanitizedRows = Array.isArray(rows)
      ? rows.map((row) => sanitizeMSTRow(row)).filter(Boolean)
      : [];

    let changed = false;
    const updated = sanitizedRows.map((row) => {
      const importKey = normalizeName(row.person_import);
      const exportKey = normalizeName(row.person_export);
      const importInfo = importKey ? memberMap.get(importKey) : null;
      const exportInfo = exportKey ? memberMap.get(exportKey) : null;
      const preferredInfo = importInfo || exportInfo;

      let next = row;
      const applyChanges = (updates) => {
        if (next === row) {
          next = { ...row };
        }
        Object.assign(next, updates);
        changed = true;
      };

      if (importInfo?.name && importInfo.name !== row.person_import) {
        applyChanges({ person_import: importInfo.name });
      }
      if (exportInfo?.name && exportInfo.name !== row.person_export) {
        applyChanges({ person_export: exportInfo.name });
      }

      const targetTeam = preferredInfo?.team;
      if (targetTeam && normalizeName(row.team) !== normalizeName(targetTeam)) {
        applyChanges({ team: targetTeam });
      }

      return next;
    });

    return { rows: updated, changed };
  }

  return {
    getTeamRoster,
    subscribeTeamRoster,
    setTeamRoster,
    mapMemberNamesToTeams,
    applyTeamRosterToMST,
  };
}
