import { getItem, setItem, subscribe } from '@/lib/storageClient.js';

export const COMMAND_CENTER_PIN_STORAGE_KEY = 'kpi_command_center_pins_v1';

export function parseCommandCenterPins(raw, fallback = []) {
  const normalizedFallback = normalizeCommandCenterPins(fallback);
  if (typeof raw !== 'string' || !raw.trim()) {
    return normalizedFallback;
  }

  try {
    return normalizeCommandCenterPins(JSON.parse(raw));
  } catch {
    return normalizedFallback;
  }
}

export function readCommandCenterPins(storage = getBrowserLocalStorage()) {
  const sharedRaw = getItem(COMMAND_CENTER_PIN_STORAGE_KEY);
  if (typeof sharedRaw === 'string') {
    return parseCommandCenterPins(sharedRaw, []);
  }

  return readCommandCenterPinsFromLocalStorage(storage);
}

export function readCommandCenterPinsFromLocalStorage(storage = getBrowserLocalStorage()) {
  if (!storage || typeof storage.getItem !== 'function') {
    return [];
  }

  try {
    return parseCommandCenterPins(storage.getItem(COMMAND_CENTER_PIN_STORAGE_KEY), []);
  } catch {
    return [];
  }
}

export function writeCommandCenterPins(nextPins, storage = getBrowserLocalStorage()) {
  const normalizedPins = normalizeCommandCenterPins(nextPins);
  const raw = JSON.stringify(normalizedPins);
  setItem(COMMAND_CENTER_PIN_STORAGE_KEY, raw);

  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COMMAND_CENTER_PIN_STORAGE_KEY, raw);
    } catch {
      // Keep shared storage as the source of truth when local persistence fails.
    }
  }

  return normalizedPins;
}

export function subscribeToCommandCenterPins(listener, storage = getBrowserLocalStorage()) {
  const fn = typeof listener === 'function' ? listener : null;
  if (!fn) {
    return () => {};
  }

  const unsubscribe = subscribe(COMMAND_CENTER_PIN_STORAGE_KEY, () => {
    fn(readCommandCenterPins(storage));
  });

  return typeof unsubscribe === 'function' ? unsubscribe : () => {};
}

function normalizeCommandCenterPins(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function getBrowserLocalStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage ?? null;
}
