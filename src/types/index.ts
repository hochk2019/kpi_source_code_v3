// Shared domain types for frontend
// Source of truth: server-v4/src/modules/*/ types + packages/domain/src/*.d.ts

// ─── Auth ────────────────────────────────────────────────────────────────────

export type AccountRole = 'viewer' | 'staff' | 'lead' | 'manager' | 'admin';

export type AccountPermissionKey =
  | 'importEdit'
  | 'importUpload'
  | 'mstEdit'
  | 'rulesEdit'
  | 'teamsEdit'
  | 'syncManage'
  | 'reportsExport'
  | 'alertsManage'
  | 'auditView'
  | 'accountManage'
  | 'adjustSubmit'
  | 'adjustApprove'
  | 'adjustOverridePoints'
  | 'aiAssistUse'
  | 'aiAssistManage'
  | 'dataHealthView'
  | 'dataHealthManage';

export type AccountPermissions = Record<AccountPermissionKey, boolean>;

export interface AuthAccountView {
  username: string;
  role: AccountRole;
  name: string;
  permissions: AccountPermissions;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  teamName: string | null;
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  notes?: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  members: TeamMember[];
}

export interface TeamRoster {
  version: 1;
  teams: TeamRecord[];
}

// ─── Declarations ────────────────────────────────────────────────────────────

export interface DeclarationRecord {
  id: string;
  key: string;
  so_tk: string;
  so_tk_full: string;
  so_tk_suffix: string;
  nhanh: string;
  mst: string;
  date: string;
  company?: string;
  ten_dn?: string;
  nhan_vien?: string;
  staff_name_snapshot?: string;
  team?: string;
  team_name_snapshot?: string;
  agency?: string;
  dai_ly?: string;
  agency_text?: string;
  licenses?: number;
  so_luong_gp?: number;
  license_count?: number;
  licenseManualCount?: number;
  licenseCodes?: string[];
  license_codes?: string[];
  licenseSourceCodes?: string[];
  license_source_codes?: string[];
  licenseExcludedCodes?: string[];
  license_excluded_codes?: string[];
  loai_hinh?: string;
  status?: string;
  deleted_at?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ─── KPI Rules ───────────────────────────────────────────────────────────────

export interface KpiRuleTier {
  minItems: number;
  points: number;
}

export interface KpiRuleGroup {
  key: string;
  title: string;
  description: string;
  codes: string[];
  base: number;
  perItem: number;
  tierMode: string;
  tiers: KpiRuleTier[];
}

export interface KpiLicenseCodePoint {
  code: string;
  points: number;
}

export interface KpiLicenseAgencyExclusion {
  agency: string;
  codes: string[];
}

export interface KpiRuleLicense {
  defaultPoints: number;
  codePoints: KpiLicenseCodePoint[];
  exclude: {
    codes: string[];
    agencies: KpiLicenseAgencyExclusion[];
  };
}

export interface KpiRuleBonuses {
  co: {
    enabled: boolean;
    label: string;
    points: number;
    perLine: number;
  };
}

export interface KpiRuleSet {
  id: string;
  name: string;
  description: string;
  applyFrom: string;
  updatedAt: string;
  groups: Record<string, KpiRuleGroup>;
  license: KpiRuleLicense;
  bonuses: KpiRuleBonuses;
}

export interface KpiRuleCollection {
  version: 2;
  activeId: string;
  sets: KpiRuleSet[];
}

// ─── KPI Adjustments ─────────────────────────────────────────────────────────

export type KpiAdjustmentStatus = 'pending' | 'approved' | 'rejected';

export interface KpiAdjustmentRecord {
  id: string;
  category: string;
  month: string;
  status: KpiAdjustmentStatus;
  staffName: string;
  teamName: string;
  quantity: number;
  unitPoints: number;
  totalPoints: number;
  references: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
  history: unknown[];
  mode?: string;
  licenseCode?: string;
  companyName?: string;
  taxCode?: string;
  extraQuantity?: number;
  extraUnitPoints?: number;
  createdBy?: string;
  updatedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  [key: string]: unknown;
}

export interface KpiAdjustmentSettingsDocument {
  categories: Record<string, Record<string, unknown>>;
  updatedAt: string | null;
  updatedBy: string | null;
  autoApprove: {
    enabled: boolean;
    note: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
  };
}

// ─── MST Assignments ─────────────────────────────────────────────────────────

export interface MstAssignment {
  mst: string;
  company: string;
  person_import: string;
  person_export: string;
  team: string;
  effective_from: string;
  effective_to: string;
  status: string;
}

// ─── HQ Agencies ─────────────────────────────────────────────────────────────

export interface HqAgencyBinding {
  mst: string;
  company: string;
  agents: string[];
  agent: string;
  updatedAt: string;
  updatedBy: string;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export interface DeclarationAlertConfig {
  enabled: boolean;
  thresholdDays: number;
  autoResolveReviewed: boolean;
  channel: string;
}

export interface DeclarationAlertItem {
  key: string;
  so_tk: string;
  mst: string;
  company: string;
  date: string;
  team: string;
  staff: string;
  missing: string[];
  firstDetected: string;
  lastUpdated: string;
  lastAlertAt: string;
  resolved: boolean;
  resolvedAt: string | null;
}

// ─── Reporting ───────────────────────────────────────────────────────────────

export interface ReportingSummary {
  decls: number;
  import: number;
  export: number;
  kpi: number;
  licenses: number;
  licenseCount: number;
  co: number;
  coLines: number;
  companyCount: number;
  licenseSummary: string;
}

export interface ReportingAdjustmentData {
  totalPoints: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  appliedCount: number;
  totalsByCategory: Record<string, { points: number; quantity: number }>;
  applied: Array<{
    key: string;
    date: string;
    label: string;
    staffName: string;
    teamName: string;
    quantity: number;
    unitPoints: number;
    references: string[];
    note: string;
    kpi: number;
  }>;
}

export interface StaffItem {
  key: string;
  name: string;
  teamLabel: string;
  stats: Record<string, unknown>;
  licenseSummary: string;
  adjustmentSummary: Record<string, unknown>;
  adjustmentTotals: unknown[];
  rows: unknown[];
  companies: unknown[];
}

export interface TeamItem {
  key: string;
  name: string;
  stats: Record<string, unknown>;
  licenseSummary: string;
  adjustmentSummary: Record<string, unknown>;
  adjustmentTotals: unknown[];
  rows: unknown[];
  members: Array<{ key: string; name: string; stats: Record<string, unknown>; licenseSummary: string }>;
  companies: unknown[];
}

export interface ReportingViewModel {
  meta: { servedAt: string; aggregateStatus: string };
  summary: ReportingSummary;
  trend: { series: unknown[]; comparison: Record<string, unknown> | null };
  adjustments: ReportingAdjustmentData;
  range: { from: string; to: string };
  rules: { id: string; name: string; applyFrom?: string; version?: number; license?: unknown };
  companies: { staff: unknown[]; teams: unknown[] };
  staff: { list: StaffItem[]; byKey: Map<string, StaffItem> };
  teams: { list: TeamItem[]; byKey: Map<string, TeamItem> };
}

// ─── Filter Presets ──────────────────────────────────────────────────────────

export interface FilterPreset {
  id: string;
  name: string;
  scope: string;
}

// ─── Report Schedules ────────────────────────────────────────────────────────

export interface ReportScheduleItem {
  id: string;
  name: string;
  frequency: string;
  time: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  formats: string[];
  recipients: string[];
  deliveryChannels: string[];
  deliveryStatus: string;
  lastDeliveryAt: string;
  lastDeliveryError: string;
  active: boolean;
  lastRun: string;
  nextRun: string;
}

// ─── ECUS Sync ───────────────────────────────────────────────────────────────

export type EcusSchedulePreset = 'hourly' | 'daily' | 'manual';

export interface EcusSyncConnectionConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface EcusSyncConfig {
  enabled: boolean;
  schedule: string;
  schedulePreset: EcusSchedulePreset;
  rangeDays: number;
  preferMonthFirst: boolean;
  batchSize: number;
  includeTaxCodes: string[];
  excludeTaxCodes: string[];
  connection: EcusSyncConnectionConfig;
  query: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

// ─── Common ──────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system' | 'high-contrast';

export type BrandPreset = 'golden-logistics' | 'ocean-blue' | 'forest-emerald';

export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
