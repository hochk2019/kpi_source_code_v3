export const ACCOUNT_PERMISSION_KEYS = Object.freeze([
  "importEdit",

  "importUpload",

  "mstEdit",

  "rulesEdit",

  "teamsEdit",

  "syncManage",

  "reportsExport",

  "alertsManage",

  "auditView",

  "accountManage",

  "adjustSubmit",

  "adjustApprove",

  "adjustOverridePoints",

  "aiAssistUse",

  "aiAssistManage",

  "dataHealthView",

  "dataHealthManage",
]);

export const DEFAULT_ROLE = "staff";

export const TEAM_LEAD_ROLE = "lead";

export const MANAGER_ROLE = "manager";

export const ADMIN_ROLE = "admin";

const ROLE_PERMISSION_TEMPLATES = Object.freeze({
  [DEFAULT_ROLE]: Object.freeze({
    importEdit: false,

    importUpload: false,

    mstEdit: false,

    rulesEdit: false,

    teamsEdit: false,

    syncManage: false,

    reportsExport: true,

    alertsManage: false,

    auditView: false,

    accountManage: false,

    adjustSubmit: true,

    adjustApprove: false,

    adjustOverridePoints: false,

    aiAssistUse: true,

    aiAssistManage: false,

    dataHealthView: false,

    dataHealthManage: false,
  }),

  [TEAM_LEAD_ROLE]: Object.freeze({
    importEdit: true,

    importUpload: false,

    mstEdit: true,

    rulesEdit: false,

    teamsEdit: true,

    syncManage: false,

    reportsExport: true,

    alertsManage: true,

    auditView: true,

    accountManage: false,

    adjustSubmit: true,

    adjustApprove: true,

    adjustOverridePoints: false,

    aiAssistUse: true,

    aiAssistManage: false,

    dataHealthView: true,

    dataHealthManage: false,
  }),

  [MANAGER_ROLE]: Object.freeze({
    importEdit: true,

    importUpload: true,

    mstEdit: true,

    rulesEdit: true,

    teamsEdit: true,

    syncManage: true,

    reportsExport: true,

    alertsManage: true,

    auditView: true,

    accountManage: false,

    adjustSubmit: true,

    adjustApprove: true,

    adjustOverridePoints: true,

    aiAssistUse: true,

    aiAssistManage: true,

    dataHealthView: true,

    dataHealthManage: true,
  }),

  [ADMIN_ROLE]: Object.freeze({
    importEdit: true,

    importUpload: true,

    mstEdit: true,

    rulesEdit: true,

    teamsEdit: true,

    syncManage: true,

    reportsExport: true,

    alertsManage: true,

    auditView: true,

    accountManage: true,

    adjustSubmit: true,

    adjustApprove: true,

    adjustOverridePoints: true,

    aiAssistUse: true,

    aiAssistManage: true,

    dataHealthView: true,

    dataHealthManage: true,
  }),
});

export const ROLE_LABELS = Object.freeze({
  [DEFAULT_ROLE]: "Nhân viên",

  [TEAM_LEAD_ROLE]: "Trưởng nhóm",

  [MANAGER_ROLE]: "Quản lý",

  [ADMIN_ROLE]: "Quản trị viên",
});

export function normalizeRoleKey(role) {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";

  if (raw && ROLE_PERMISSION_TEMPLATES[raw]) {
    return raw;
  }

  return DEFAULT_ROLE;
}

export function resolveRoleTemplate(role) {
  const key = normalizeRoleKey(role);

  return ROLE_PERMISSION_TEMPLATES[key] || ROLE_PERMISSION_TEMPLATES[DEFAULT_ROLE];
}

export function getPermissionTemplate(role) {
  const template = resolveRoleTemplate(role);

  const permissions = {};

  for (const key of ACCOUNT_PERMISSION_KEYS) {
    if (key === "reportsExport") {
      permissions[key] = template[key] !== false;
    } else {
      permissions[key] = !!template[key];
    }
  }

  return permissions;
}

export function listRoleOptions() {
  return Object.keys(ROLE_LABELS).map((value) => ({
    value,

    label: ROLE_LABELS[value],
  }));
}

export function isAdminRole(role) {
  return normalizeRoleKey(role) === ADMIN_ROLE;
}

export function clonePermissions(permissions) {
  const result = {};

  for (const key of ACCOUNT_PERMISSION_KEYS) {
    result[key] = permissions?.[key] === true;

    if (key === "reportsExport") {
      result[key] = permissions?.[key] !== false;
    }
  }

  return result;
}

export function mergePermissions(baseRole, overrides = {}) {
  const base = getPermissionTemplate(baseRole);

  const merged = { ...base };

  if (overrides && typeof overrides === "object") {
    for (const key of ACCOUNT_PERMISSION_KEYS) {
      if (key === "reportsExport") {
        if (overrides[key] === false) {
          merged[key] = false;
        } else if (overrides[key] === true) {
          merged[key] = true;
        }
      } else if (overrides[key] !== undefined) {
        merged[key] = !!overrides[key];
      }
    }
  }

  if (isAdminRole(baseRole)) {
    merged.accountManage = true;
  } else {
    merged.accountManage = false;
  }

  return merged;
}
