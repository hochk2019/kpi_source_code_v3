import { aggregateByCompany } from '../../../../shared/reportingCompanyAggregation.js';
import { buildReportData } from '../../../../shared/reportingLegacyMath.js';

export function buildLegacyReportData(rowsInput, options = {}) {
  return buildReportData(rowsInput, options);
}

export function aggregateLegacyCompanies(rowsInput, options = {}) {
  return aggregateByCompany(rowsInput, options);
}
