export { KPI_ADJUSTMENT_CATEGORY_CONFIG } from './kpiAdjustments.js';

export function roundAdjustmentPoint(value: number, precision?: number): number;
export function normalizeStr(s: unknown): string;
export function normalizeName(name: unknown): string;

export function toISODate(
  d: unknown,
  options?: { preferMonthFirst?: boolean },
): string;

export function isExportByNumber(soTk: unknown): boolean;
export function isImportByNumber(soTk: unknown): boolean;
export function isExportByType(loaiHinh: unknown): boolean;
export function isImportByType(loaiHinh: unknown): boolean;
export function isExportDecl(soTk: unknown, loaiHinh: unknown): boolean;

export interface RosterMember {
  id: string;
  name: string;
  notes?: string;
}

export interface RosterTeam {
  id: string;
  name: string;
  members: RosterMember[];
}

export interface Roster {
  version: number;
  teams: RosterTeam[];
}

export function mapMemberNamesToTeams(
  source: Record<string, unknown> | null | undefined,
): Map<string, { team: string; name: string }>;
