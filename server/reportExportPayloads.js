import { buildReportingReadModels } from './reportingReadModels.js';
import { resolveReportingRule } from './reportingRuleSelection.js';

export function buildCompactReportExportPayload(kind, payload = {}, sourceSnapshotInput = {}) {
  if (!isCompactReportingPayload(payload)) {
    return null;
  }

  const sourceSnapshot = normalizeSourceSnapshot(sourceSnapshotInput);
  const query = normalizeQuery(payload.query);
  const rules = resolveReportingRule(sourceSnapshot.rules, payload.ruleId);
  if (!rules) {
    throw createInputError('Không tìm thấy bộ quy tắc KPI cần xuất.');
  }

  const readModels = buildReportingReadModels(sourceSnapshot.rows, {
    roster: sourceSnapshot.roster,
    rules,
    from: query.from,
    to: query.to,
    adjustments: sourceSnapshot.adjustments,
  });
  const range = normalizeRange(readModels?.summary?.range, query);
  const summary = isRecord(readModels?.summary?.summary) ? readModels.summary.summary : {};
  const staffItems = Array.isArray(readModels?.staff?.items) ? readModels.staff.items : [];
  const teamItems = Array.isArray(readModels?.teams?.items) ? readModels.teams.items : [];
  const columns = cloneRecord(payload.columns);

  if (kind === 'staff') {
    const staffKey = normalizeText(payload.staffKey);
    if (!staffKey) {
      throw createInputError('Thiếu staffKey để xuất báo cáo nhân viên.');
    }

    const staff = findItemByKey(staffItems, staffKey);
    if (!staff) {
      throw createInputError('Không tìm thấy nhân viên cần xuất báo cáo.');
    }

    return {
      exportPayload: {
        staff,
        range,
        rules,
        columns,
      },
      auditPayload: {
        source: 'reporting-v4',
        query: range,
        ruleId: normalizeText(rules?.id),
        staffKey,
        columns,
      },
    };
  }

  if (kind === 'team') {
    const teamKey = normalizeText(payload.teamKey);
    if (!teamKey) {
      throw createInputError('Thiếu teamKey để xuất báo cáo tổ đội.');
    }

    const team = findItemByKey(teamItems, teamKey);
    if (!team) {
      throw createInputError('Không tìm thấy tổ đội cần xuất báo cáo.');
    }

    return {
      exportPayload: {
        team,
        range,
        rules,
        columns,
      },
      auditPayload: {
        source: 'reporting-v4',
        query: range,
        ruleId: normalizeText(rules?.id),
        teamKey,
        columns,
      },
    };
  }

  if (kind === 'allStaff') {
    return {
      exportPayload: {
        staffList: staffItems,
        summary,
        range,
        rules,
        columns,
      },
      auditPayload: {
        source: 'reporting-v4',
        query: range,
        ruleId: normalizeText(rules?.id),
        columns,
      },
    };
  }

  if (kind === 'allTeam') {
    return {
      exportPayload: {
        teamList: teamItems,
        summary,
        range,
        rules,
        columns,
      },
      auditPayload: {
        source: 'reporting-v4',
        query: range,
        ruleId: normalizeText(rules?.id),
        columns,
      },
    };
  }

  return null;
}

function isCompactReportingPayload(payload) {
  return normalizeText(payload?.source).toLowerCase() === 'reporting-v4';
}

function normalizeSourceSnapshot(input) {
  return {
    rows: Array.isArray(input?.rows) ? input.rows : [],
    roster: isRecord(input?.roster) ? input.roster : { version: 1, teams: [] },
    rules: input?.rules,
    adjustments: Array.isArray(input?.adjustments) ? input.adjustments : [],
  };
}

function normalizeQuery(input) {
  return {
    from: normalizeText(input?.from),
    to: normalizeText(input?.to),
  };
}

function cloneRecord(input) {
  return isRecord(input) ? { ...input } : {};
}

function findItemByKey(items, key) {
  return items.find((item) => normalizeText(item?.key) === key) || null;
}

function normalizeRange(range, fallback = {}) {
  return {
    from: normalizeText(range?.from) || normalizeText(fallback?.from),
    to: normalizeText(range?.to) || normalizeText(fallback?.to),
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(input) {
  return typeof input === 'string' ? input.trim() : '';
}

function createInputError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
