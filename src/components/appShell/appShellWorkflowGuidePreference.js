const APP_SHELL_WORKFLOW_GUIDE_STORAGE_KEY = 'kpi_app_shell_workflow_guide_v1';

function readPreferenceMap() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(APP_SHELL_WORKFLOW_GUIDE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePreferenceMap(preferences) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      APP_SHELL_WORKFLOW_GUIDE_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch (error) {
    console.warn('Không thể lưu trạng thái workflow guide', error);
  }
}

export function resolveWorkflowGuideCollapsed(preferenceId, defaultCollapsed = false) {
  if (!preferenceId) {
    return defaultCollapsed;
  }

  const preferences = readPreferenceMap();
  const storedValue = preferences[preferenceId];
  return typeof storedValue === 'boolean' ? storedValue : defaultCollapsed;
}

export function persistWorkflowGuideCollapsed(preferenceId, collapsed) {
  if (!preferenceId) {
    return;
  }

  const preferences = readPreferenceMap();
  preferences[preferenceId] = Boolean(collapsed);
  writePreferenceMap(preferences);
}

export { APP_SHELL_WORKFLOW_GUIDE_STORAGE_KEY };
