import {
  compareDuplicateCandidates,
  computeDuplicateWeight,
  describeRowStatus,
  extractDuplicatePrefix,
  extractRowTimestampDetail,
  formatDeclarationLabel,
  formatDuplicateGroupLabel,
  inferRowSource,
} from "@/components/dataImporter/dataImporterDuplicateReviewUtils.js";

export function buildDuplicateSummary(rows, { keyOfRow }) {
  const counts = new Map();
  const groupsMap = new Map();

  for (const row of rows || []) {
    const prefix = extractDuplicatePrefix(row);
    if (!prefix) continue;

    counts.set(prefix, (counts.get(prefix) || 0) + 1);
    if (!groupsMap.has(prefix)) {
      groupsMap.set(prefix, [row]);
      continue;
    }
    groupsMap.get(prefix).push(row);
  }

  let groups = 0;
  let totalRows = 0;
  const removalKeys = [];
  const duplicatesSet = new Set();
  const keptKeys = new Set();
  const details = [];

  for (const [, list] of groupsMap.entries()) {
    if (!Array.isArray(list) || list.length <= 1) continue;

    groups += 1;
    totalRows += list.length;

    const sorted = [...list].sort(compareDuplicateCandidates);
    const keeper = sorted[0];
    if (keeper) {
      keptKeys.add(keyOfRow(keeper));
    }

    const candidates = sorted.map((entry, index) => {
      const key = keyOfRow(entry);
      const weight = computeDuplicateWeight(entry);
      const timestampDetail = weight.timestampDetail ?? extractRowTimestampDetail(entry);
      const source = inferRowSource(entry);

      return {
        key,
        index,
        row: entry,
        label: formatDeclarationLabel(entry),
        score: weight.score,
        status: describeRowStatus(entry),
        staff: entry.nhan_vien || "",
        team: entry.team || "",
        kpi: Number.isFinite(Number(entry?.kpi)) ? Number(entry.kpi) : null,
        sourceLabel: source.label,
        sourceCode: source.code,
        timestampDisplay: timestampDetail.display,
        timestampLabel: timestampDetail.label,
        timestampISO: timestampDetail.iso,
      };
    });

    for (const item of sorted.slice(1)) {
      const key = keyOfRow(item);
      duplicatesSet.add(key);
      removalKeys.push(key);
    }

    details.push({
      prefix: formatDuplicateGroupLabel(list[0]),
      rawPrefix: extractDuplicatePrefix(list[0]),
      total: candidates.length,
      keeperKey: keeper ? keyOfRow(keeper) : null,
      keeperLabel: candidates[0]?.label || "",
      referenceTimestamp: candidates[0]?.timestampDisplay || "Không xác định",
      referenceTimestampLabel: candidates[0]?.timestampLabel || "Thời gian cập nhật",
      items: candidates,
    });
  }

  return {
    counts,
    groups,
    totalRows,
    removalKeys,
    duplicatesSet,
    keptKeys,
    details,
    hasDuplicates: groups > 0,
  };
}
