import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchWithAuth } from '@/auth/localAuth.js';
import { API_V4_ROUTES } from '@/lib/apiRoutes.js';



const LOCAL_STORAGE_KEY = 'kpi_filter_presets_cache_v1';

const LOCAL_STORAGE_VERSION = 1;

const FILTER_PRESET_SCOPE_DEFAULT = 'data-importer';

const MAX_PRESETS_PER_SCOPE = 20;



function sanitizeScope(scope) {

  if (typeof scope !== 'string') {

    return FILTER_PRESET_SCOPE_DEFAULT;

  }

  const normalized = scope.trim().toLowerCase();

  if (!normalized) {

    return FILTER_PRESET_SCOPE_DEFAULT;

  }

  if (normalized === 'report-viewer') {

    return normalized;

  }

  if (/^[a-z0-9._-]{1,40}$/iu.test(normalized)) {

    return normalized;

  }

  return FILTER_PRESET_SCOPE_DEFAULT;

}



function readLocalCache() {

  if (typeof window === 'undefined' || !window.localStorage) {

    return { version: LOCAL_STORAGE_VERSION, scopes: {} };

  }

  try {

    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!raw) {

      return { version: LOCAL_STORAGE_VERSION, scopes: {} };

    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {

      return { version: LOCAL_STORAGE_VERSION, scopes: {} };

    }

    const scopes = parsed.scopes && typeof parsed.scopes === 'object' ? parsed.scopes : {};

    return { version: LOCAL_STORAGE_VERSION, scopes };

  } catch (err) {

    console.warn('Không thể đọc cache bộ lọc đã lưu', err);

    return { version: LOCAL_STORAGE_VERSION, scopes: {} };

  }

}



function writeLocalCache(cache) {

  if (typeof window === 'undefined' || !window.localStorage) {

    return;

  }

  try {

    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));

  } catch (err) {

    console.warn('Không thể lưu cache bộ lọc đã lưu', err);

  }

}



function getPresetTime(value) {

  if (!value) {

    return 0;

  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    return 0;

  }

  return date.getTime();

}



function sortByUpdatedAt(list = []) {

  return [...list].sort((a = {}, b = {}) => getPresetTime(b.updatedAt || b.createdAt) - getPresetTime(a.updatedAt || a.createdAt));

}



function rebuildCollection(existing = [], { upsert = null, removeId = null } = {}) {

  const groups = new Map();

  for (const item of existing) {

    if (!item || typeof item !== 'object') {

      continue;

    }

    if (removeId && item.id === removeId) {

      continue;

    }

    const scopeKey = item.scope || FILTER_PRESET_SCOPE_DEFAULT;

    if (upsert && upsert.id === item.id) {

      continue;

    }

    const list = groups.get(scopeKey) || [];

    list.push(item);

    groups.set(scopeKey, list);

  }

  if (upsert) {

    const scopeKey = upsert.scope || FILTER_PRESET_SCOPE_DEFAULT;

    const list = groups.get(scopeKey) || [];

    list.unshift(upsert);

    groups.set(scopeKey, list);

  }

  const merged = [];

  for (const list of groups.values()) {

    const sorted = sortByUpdatedAt(list);

    merged.push(...sorted.slice(0, MAX_PRESETS_PER_SCOPE));

  }

  return sortByUpdatedAt(merged);

}



function mergeLocalWithPreset(list, preset) {

  if (!preset) {

    return sortByUpdatedAt(list);

  }

  return rebuildCollection(list, { upsert: preset });

}



function removeLocalPreset(list, presetId) {

  if (!presetId) {

    return sortByUpdatedAt(list);

  }

  return rebuildCollection(list, { removeId: presetId });

}



function extractErrorMessage(err, fallback) {

  if (!err) {

    return fallback;

  }

  if (typeof err === 'string') {

    return err;

  }

  if (err?.message) {

    return err.message;

  }

  return fallback;

}



async function parseJsonSafely(response) {

  try {

    return await response.json();

  } catch {

    return null;

  }

}



export default function useFilterPresets(scope = FILTER_PRESET_SCOPE_DEFAULT) {

  const normalizedScope = sanitizeScope(scope);

  const [presets, setPresets] = useState(() => {

    const cache = readLocalCache();

    const entry = cache.scopes?.[normalizedScope];

    return Array.isArray(entry?.presets) ? entry.presets : [];

  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const presetsRef = useRef(presets);



  useEffect(() => {

    presetsRef.current = presets;

  }, [presets]);



  useEffect(() => {

    const cache = readLocalCache();

    const entry = cache.scopes?.[normalizedScope];

    if (Array.isArray(entry?.presets)) {

      setPresets(entry.presets);

      presetsRef.current = entry.presets;

    } else {

      setPresets([]);

      presetsRef.current = [];

    }

  }, [normalizedScope]);



  const persistLocal = useCallback(

    (list, meta = {}) => {

      if (typeof window === 'undefined') {

        return;

      }

      try {

        const cache = readLocalCache();

        cache.version = LOCAL_STORAGE_VERSION;

        cache.scopes = cache.scopes || {};

        cache.scopes[normalizedScope] = {

          presets: list,

          updatedAt: meta.updatedAt || new Date().toISOString(),

        };

        writeLocalCache(cache);

      } catch (err) {

        console.warn('Không thể ghi cache bộ lọc đã lưu', err);

      }

    },

    [normalizedScope]

  );



  const clearError = useCallback(() => setError(''), []);



  const refresh = useCallback(async () => {

    setLoading(true);

    setError('');

    try {

      const response = await fetchWithAuth(

        `${API_V4_ROUTES.filterPresets.base}?scope=${encodeURIComponent(normalizedScope)}`,

        { cache: 'no-store' }

      );

      if (!response.ok) {

        const body = await parseJsonSafely(response);

        const message = body?.error ? body.error : `HTTP ${response.status}`;

        throw new Error(message);

      }

      const payload = await response.json();

      if (payload?.ok === false) {

        throw new Error(payload.error || 'Không thể tải bộ lọc đã lưu');

      }

      const list = Array.isArray(payload.presets) ? payload.presets : [];

      const sorted = sortByUpdatedAt(list);

      setPresets(sorted);

      presetsRef.current = sorted;

      persistLocal(sorted, { updatedAt: payload?.updatedAt });

    } catch (err) {

      console.error('Không thể tải bộ lọc đã lưu', err);

      setError(extractErrorMessage(err, 'Không thể tải bộ lọc đã lưu'));

    } finally {

      setLoading(false);

    }

  }, [normalizedScope, persistLocal]);



  useEffect(() => {

    refresh();

  }, [refresh]);



  const createPreset = useCallback(

    async ({ name, filters }) => {

      setLoading(true);

      setError('');

      try {

        const response = await fetchWithAuth(API_V4_ROUTES.filterPresets.base, {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ scope: normalizedScope, name, filters }),

        });

        if (!response.ok) {

          const body = await parseJsonSafely(response);

          const message = body?.error ? body.error : `HTTP ${response.status}`;

          throw new Error(message);

        }

        const payload = await response.json();

        if (payload?.ok === false) {

          throw new Error(payload.error || 'Không thể lưu bộ lọc đã lưu');

        }

        const preset = payload?.preset;

        if (!preset) {

          throw new Error('Máy chủ không trả về dữ liệu bộ lọc đã lưu.');

        }

        const next = mergeLocalWithPreset(presetsRef.current, preset);

        setPresets(next);

        presetsRef.current = next;

        persistLocal(next, { updatedAt: payload?.updatedAt || preset.updatedAt });

        return preset;

      } catch (err) {

        console.error('Không thể lưu bộ lọc đã lưu', err);

        setError(extractErrorMessage(err, 'Không thể lưu bộ lọc đã lưu'));

        throw err;

      } finally {

        setLoading(false);

      }

    },

    [normalizedScope, persistLocal]

  );



  const updatePreset = useCallback(

    async (presetId, { name, filters }) => {

      setLoading(true);

      setError('');

      try {

        const response = await fetchWithAuth(`${API_V4_ROUTES.filterPresets.base}/${encodeURIComponent(presetId)}`, {

          method: 'PUT',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ name, filters }),

        });

        if (!response.ok) {

          const body = await parseJsonSafely(response);

          const message = body?.error ? body.error : `HTTP ${response.status}`;

          throw new Error(message);

        }

        const payload = await response.json();

        if (payload?.ok === false) {

          throw new Error(payload.error || 'Không thể cập nhật bộ lọc đã lưu');

        }

        const preset = payload?.preset;

        if (!preset) {

          throw new Error('Máy chủ không trả về dữ liệu bộ lọc sau khi cập nhật.');

        }

        const next = mergeLocalWithPreset(presetsRef.current, preset);

        setPresets(next);

        presetsRef.current = next;

        persistLocal(next, { updatedAt: payload?.updatedAt || preset.updatedAt });

        return preset;

      } catch (err) {

        console.error('Không thể cập nhật bộ lọc đã lưu', err);

        setError(extractErrorMessage(err, 'Không thể cập nhật bộ lọc đã lưu'));

        throw err;

      } finally {

        setLoading(false);

      }

    },

    [persistLocal]

  );



  const deletePreset = useCallback(

    async (presetId) => {

      setLoading(true);

      setError('');

      try {

        const response = await fetchWithAuth(`${API_V4_ROUTES.filterPresets.base}/${encodeURIComponent(presetId)}`, {

          method: 'DELETE',

        });

        if (!response.ok) {

          const body = await parseJsonSafely(response);

          const message = body?.error ? body.error : `HTTP ${response.status}`;

          throw new Error(message);

        }

        const payload = await response.json();

        if (payload?.ok === false) {

          throw new Error(payload.error || 'Không thể xoá bộ lọc đã lưu');

        }

        const next = removeLocalPreset(presetsRef.current, presetId);

        setPresets(next);

        presetsRef.current = next;

        persistLocal(next, { updatedAt: payload?.updatedAt || null });

        return payload?.deleted || presetId;

      } catch (err) {

        console.error('Không thể xoá bộ lọc đã lưu', err);

        setError(extractErrorMessage(err, 'Không thể xoá bộ lọc đã lưu'));

        throw err;

      } finally {

        setLoading(false);

      }

    },

    [persistLocal]

  );



  return {

    scope: normalizedScope,

    presets,

    loading,

    error,

    clearError,

    refresh,

    createPreset,

    updatePreset,

    deletePreset,

  };

}

