export const sortMSTRows = (list = []) => {
  return [...list]
    .filter(Boolean)
    .sort((a, b) => {
      const mstA = (a?.mst || "").toString();
      const mstB = (b?.mst || "").toString();
      const byMST = mstA.localeCompare(mstB);

      if (byMST !== 0) return byMST;

      const dateA = a?.effective_from || "";
      const dateB = b?.effective_from || "";
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }

      const toA = a?.effective_to || "9999-12-31";
      const toB = b?.effective_to || "9999-12-31";
      return toA.localeCompare(toB);
    });
};

const collectDistinctLabels = (values = []) =>
  Array.from(
    new Set(
      values
        .map((value) => (value || "").toString().trim())
        .filter(Boolean)
    )
  );

function buildConflictSummary(stages = []) {
  const activeStages = stages.filter((stage) => !stage?.effective_to);
  if (activeStages.length <= 1) {
    return null;
  }

  const importAssignees = collectDistinctLabels(activeStages.map((stage) => stage?.person_import));
  const exportAssignees = collectDistinctLabels(activeStages.map((stage) => stage?.person_export));
  const teams = collectDistinctLabels(activeStages.map((stage) => stage?.team));
  const suggestions = [
    "Giữ 1 dòng hiện hành và chốt ngày kết thúc cho các dòng còn lại.",
  ];

  if (importAssignees.length > 1 || exportAssignees.length > 1 || teams.length > 1) {
    suggestions.push("Nếu đang bàn giao, hãy chuyển người phụ trách sang dòng mới nhất rồi khóa giai đoạn cũ.");
  }

  if (importAssignees.length > 1 && exportAssignees.length > 1) {
    suggestions.push("Nếu mỗi dòng đang giữ một phần trách nhiệm khác nhau, hãy gộp về 1 dòng và tách vai trò nhập/xuất trên cùng MST.");
  }

  return {
    hasConflict: true,
    activeStageCount: activeStages.length,
    stageCount: stages.length,
    importAssignees,
    exportAssignees,
    teams,
    suggestions,
  };
}

export const buildGroupedStages = (rows = []) => {
  if (!Array.isArray(rows) || !rows.length) return [];

  const groups = new Map();
  rows.forEach((row) => {
    const key = row?.mst || "__unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        mst: row?.mst || "",
        company: row?.company || "",
        stages: [],
      });
    }
    groups.get(key).stages.push(row);
  });

  return Array.from(groups.values())
    .map((entry) => {
      const stages = sortMSTRows(entry.stages);

      return {
        ...entry,
        stages,
        conflictSummary: buildConflictSummary(stages),
      };
    })
    .sort((a, b) => (a.mst || "").localeCompare(b.mst || ""));
};

export const buildAggregatedRowsByMST = (groupedStages = [], groupByMST = false) => {
  if (!groupByMST) return [];

  return groupedStages.map((group) => {
    const stages = Array.isArray(group?.stages) ? group.stages : [];
    if (!stages.length) {
      return {
        __group: true,
        mst: group?.mst || "",
        company: group?.company || "",
        person_import: "",
        person_export: "",
        team: "",
        effective_from: "",
        effective_to: "",
      };
    }

    const latest = stages[stages.length - 1];
    const active = [...stages].reverse().find((stage) => !stage?.effective_to) || latest;
    return {
      ...active,
      __group: true,
      mst: group?.mst || active?.mst || "",
      company: active?.company || group?.company || "",
    };
  });
};

export const buildDisplayList = ({ groupByMST = false, aggregatedByMST = [], filtered = [] } = {}) =>
  groupByMST ? aggregatedByMST : filtered;

export const buildTimelineGroupsByMST = (groupedStages = []) => {
  const groups = new Map();
  groupedStages.forEach((group) => {
    const key = group?.mst || "__unknown";
    if (!groups.has(key)) {
      groups.set(key, group);
    }
  });
  return groups;
};
