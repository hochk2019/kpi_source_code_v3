const USAGE_STORAGE_KEY = 'kpi_command_center_usage_v1';

function readJsonFromStorage(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonToStorage(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Không thể lưu trạng thái Command Center', error);
  }
}

export function loadCommandCenterUsage() {
  const raw = readJsonFromStorage(USAGE_STORAGE_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function registerCommandCenterUsage(previousUsage, commandId) {
  const nextUsage = { ...previousUsage };
  const nextEntry = nextUsage[commandId] || { count: 0, lastUsedAt: null };
  nextEntry.count += 1;
  nextEntry.lastUsedAt = new Date().toISOString();
  nextUsage[commandId] = nextEntry;
  writeJsonToStorage(USAGE_STORAGE_KEY, nextUsage);
  return nextUsage;
}
