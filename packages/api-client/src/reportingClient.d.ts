export interface ReportingRange {
  from: string;
  to: string;
}

export interface RuleLicense {
  exclude: {
    codes: string[];
  };
}

export interface RuleReference {
  id: string;
  name: string;
  applyFrom?: string;
  version?: number | string;
  license?: RuleLicense;
  licenseExcludedSummary?: string;
}

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

export interface ReportingTrend {
  series: unknown[];
  comparison: Record<string, unknown> | null;
}

export interface AdjustmentTotalsEntry {
  key: string;
  label?: string;
  order?: unknown;
  points: number;
  quantity: number;
}

export interface AdjustmentAppliedEntry {
  key: string;
  date: string;
  displayDate: string;
  label: string;
  staffName: string;
  teamName: string;
  quantity: number | null;
  unitPoints: number | null;
  references: string[];
  referencesText: string;
  note: string;
  kpi: number;
}

export interface ReportingAdjustments {
  list: unknown[];
  applied: AdjustmentAppliedEntry[];
  totalPoints: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  appliedCount: number;
  totalsByCategory: Record<string, { points: number; quantity: number }>;
  totalsList: AdjustmentTotalsEntry[];
}

export interface AggregateStatus {
  available: boolean;
  generatedAt: string;
  queryKey: string;
  total: number;
  range: ReportingRange;
}

export interface ReportingViewMeta {
  servedAt: string;
  aggregateStatus: AggregateStatus;
}

export interface KeyedCollection<T> {
  list: T[];
  byKey: Map<string, T>;
}

export interface AdjustmentMetrics {
  totalPoints: number;
  entryCount: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface DetailRow extends Record<string, unknown> {
  licenseSummary: string;
  licenseExcludedSummary: string;
}

export interface StaffItem {
  key: string;
  name: string;
  teamLabel: string;
  stats: Record<string, unknown>;
  licenseSummary: string;
  adjustmentSummary: Record<string, unknown>;
  adjustmentTotals: AdjustmentTotalsEntry[];
  adjustmentMetrics: AdjustmentMetrics;
  rows: DetailRow[];
  companies: unknown[];
}

export interface TeamMember {
  key: string;
  name: string;
  stats: Record<string, unknown>;
  licenseSummary: string;
}

export interface TeamItem {
  key: string;
  name: string;
  stats: Record<string, unknown>;
  licenseSummary: string;
  adjustmentSummary: Record<string, unknown>;
  adjustmentTotals: AdjustmentTotalsEntry[];
  adjustmentMetrics: AdjustmentMetrics;
  rows: DetailRow[];
  members: TeamMember[];
  companies: unknown[];
}

export interface CompanyGroups {
  staff: unknown[];
  teams: unknown[];
}

export interface ReportingViewModel {
  meta: ReportingViewMeta;
  summary: ReportingSummary;
  trend: ReportingTrend;
  adjustments: ReportingAdjustments;
  range: ReportingRange;
  rules: RuleReference;
  companies: CompanyGroups;
  staff: KeyedCollection<StaffItem>;
  teams: KeyedCollection<TeamItem>;
}

export interface ScheduleItem {
  id: string;
  name: string;
  frequency: string;
  time: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  formats: string[];
  formatsSummary: string;
  recipients: string[];
  recipientsSummary: string;
  deliveryChannels: string[];
  deliveryStatus: string;
  lastDeliveryAt: string;
  lastDeliveryError: string;
  active: boolean;
  lastRun: string;
  nextRun: string;
}

export interface ReportingSchedulesViewModel {
  total: number;
  aggregateStatus: AggregateStatus;
  items: ScheduleItem[];
  byId: Map<string, ScheduleItem>;
}

export interface ReportingQuery {
  from?: string;
  to?: string;
  ruleId?: string;
  limit?: number;
}

export function createEmptyReportingViewModel(
  range?: Partial<ReportingRange>,
  currentRules?: Record<string, unknown> | null,
): ReportingViewModel;

export function createEmptyReportingSchedulesViewModel(): ReportingSchedulesViewModel;

export function buildReportingViewModel(input?: {
  meta?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  staff?: Record<string, unknown>;
  teams?: Record<string, unknown>;
  currentRules?: Record<string, unknown> | null;
}): ReportingViewModel;

export function buildReportingSchedulesViewModel(
  input?: Record<string, unknown>,
): ReportingSchedulesViewModel;

export function normalizeStoredReportingScheduleItems(
  items?: unknown[],
): ScheduleItem[];

export function mergeReportingScheduleItems(
  remoteItems?: unknown[],
  localItems?: unknown[],
): ScheduleItem[];

export function fetchReportingSchedules(
  query?: ReportingQuery,
): Promise<ReportingSchedulesViewModel>;

export function loadLocalReportingScheduleItems(): ScheduleItem[];

export function subscribeReportingSchedules(
  listener: (viewModel: ReportingSchedulesViewModel) => void,
): () => void;

export function saveReportingSchedule(
  entry: Record<string, unknown>,
  options?: Record<string, unknown>,
): Promise<ScheduleItem>;

export function deleteReportingSchedule(
  id: string,
  options?: Record<string, unknown>,
): Promise<boolean>;

export function fetchReportingViewModel(
  query?: ReportingQuery,
  currentRules?: Record<string, unknown> | null,
): Promise<ReportingViewModel>;

export function fetchDashboardSummary(
  query?: ReportingQuery,
  currentRules?: Record<string, unknown> | null,
): Promise<ReportingViewModel>;
