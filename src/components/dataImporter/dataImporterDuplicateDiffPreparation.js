export function prepareDuplicateDiffRow(
  row,
  {
    summarizeLicenseSnapshot,
    coLabel,
    coLineCount,
    extractRowTimestampDetail,
  },
) {
  if (!row || typeof row !== "object") {
    return {};
  }

  const normalized = { ...row };

  if (!normalized.so_tk_full && normalized.so_tk) {
    normalized.so_tk_full = normalized.so_tk;
  }

  const licenseSnapshot = summarizeLicenseSnapshot(row);
  normalized.__license_source_count = licenseSnapshot.sourceCount;
  normalized.__license_included_count = licenseSnapshot.includedCount;
  normalized.__license_excluded_count = licenseSnapshot.excludedCount;
  normalized.__license_source_codes = licenseSnapshot.sourceCodes;
  normalized.__license_included_codes = licenseSnapshot.includedCodes;
  normalized.__license_excluded_codes = licenseSnapshot.excludedCodes;

  normalized.__co_status = coLabel(row);
  normalized.__co_lines = coLineCount(row);

  const timestampDetail = extractRowTimestampDetail(row);
  normalized.__timestamp_field =
    timestampDetail?.label && timestampDetail?.display
      ? `${timestampDetail.label}: ${timestampDetail.display}`
      : timestampDetail?.display || "";

  const agentSet = new Set();
  const pushAgent = (value) => {
    if (!value && value !== 0) return;
    const text = String(value).trim();
    if (text) {
      agentSet.add(text);
    }
  };

  if (Array.isArray(row.agents)) {
    row.agents.forEach(pushAgent);
  }

  pushAgent(row.agency);
  pushAgent(row.dai_ly);
  pushAgent(row.hq_agency);

  normalized.__agents_display = Array.from(agentSet);

  return normalized;
}
