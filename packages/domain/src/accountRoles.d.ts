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

export type AccountRole = 'staff' | 'lead' | 'manager' | 'admin';
export type AccountPermissions = Record<AccountPermissionKey, boolean>;

export const ACCOUNT_PERMISSION_KEYS: readonly AccountPermissionKey[];
export const DEFAULT_ROLE: 'staff';
export const TEAM_LEAD_ROLE: 'lead';
export const MANAGER_ROLE: 'manager';
export const ADMIN_ROLE: 'admin';
export const ROLE_LABELS: Readonly<Record<AccountRole, string>>;

export function normalizeRoleKey(role: unknown): AccountRole;
export function resolveRoleTemplate(role: unknown): AccountPermissions;
export function getPermissionTemplate(role: unknown): AccountPermissions;
export function mergePermissions(
  role: unknown,
  overrides?: Partial<Record<string, boolean | undefined>> | null,
): AccountPermissions;
export function isAdminRole(role: unknown): boolean;
