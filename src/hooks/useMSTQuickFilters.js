import { useCallback, useEffect, useMemo, useRef, useState } from 'react';



const STORAGE_KEY = 'kpi:mst-assignment:quick-filters:v1';

const ALLOWED_TYPES = new Set(['staff', 'action']);

const MAX_ITEMS_PER_TYPE = 20;



function sanitizeType(type) {

  if (typeof type !== 'string') {

    return '';

  }

  const normalized = type.trim().toLowerCase();

  return ALLOWED_TYPES.has(normalized) ? normalized : '';

}



function normalizeValue(value) {

  if (typeof value !== 'string') {

    return '';

  }

  return value

    .normalize('NFD')

    .replace(/\p{Diacritic}/gu, '')

    .toLowerCase()

    .trim();

}



function readStorage() {

  if (typeof window === 'undefined' || !window.localStorage) {

    return { staff: [], action: [] };

  }

  try {

    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {

      return { staff: [], action: [] };

    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {

      return { staff: [], action: [] };

    }

    const parseList = (key) => {

      const list = Array.isArray(parsed[key]) ? parsed[key] : [];

      return list

        .map((item) => {

          if (!item || typeof item !== 'object') {

            return null;

          }

          const value = typeof item.value === 'string' ? item.value : '';

          const normalized = typeof item.normalized === 'string' ? item.normalized : normalizeValue(value);

          if (!value || !normalized) {

            return null;

          }

          return {

            value,

            normalized,

            savedAt: item.savedAt || item.updatedAt || item.createdAt || null,

          };

        })

        .filter(Boolean)

        .slice(0, MAX_ITEMS_PER_TYPE);

    };

    return {

      staff: parseList('staff'),

      action: parseList('action'),

    };

  } catch (error) {

    console.warn('Không thể đọc bộ lọc nhanh MST đã lưu', error);

    return { staff: [], action: [] };

  }

}



function writeStorage(snapshot) {

  if (typeof window === 'undefined' || !window.localStorage) {

    return;

  }

  try {

    window.localStorage.setItem(

      STORAGE_KEY,

      JSON.stringify({

        staff: snapshot.staff || [],

        action: snapshot.action || [],

      }),

    );

  } catch (error) {

    console.warn('Không thể lưu bộ lọc nhanh MST', error);

  }

}



export default function useMSTQuickFilters() {

  const [favorites, setFavorites] = useState(() => readStorage());

  const resultRef = useRef({ ok: false });



  useEffect(() => {

    setFavorites(readStorage());

  }, []);



  const updateFavorites = useCallback((updater) => {

    setFavorites((prev) => {

      const current = prev || { staff: [], action: [] };

      const next = updater(current);

      writeStorage(next);

      return next;

    });

  }, []);



  const addFavorite = useCallback((type, value) => {

    const sanitizedType = sanitizeType(type);

    const normalizedValue = normalizeValue(value);

    if (!sanitizedType || !normalizedValue) {

      return { ok: false, reason: 'invalid' };

    }

    const rawValue = value.trim();

    resultRef.current = { ok: false, reason: 'unknown' };

    updateFavorites((prev) => {

      const previousList = Array.isArray(prev[sanitizedType]) ? prev[sanitizedType] : [];

      if (previousList.some((item) => item.normalized === normalizedValue)) {

        resultRef.current = { ok: false, reason: 'duplicate' };

        return prev;

      }

      const entry = {

        value: rawValue,

        normalized: normalizedValue,

        savedAt: new Date().toISOString(),

      };

      const nextList = [entry, ...previousList].slice(0, MAX_ITEMS_PER_TYPE);

      const next = { ...prev, [sanitizedType]: nextList };

      resultRef.current = { ok: true, entry };

      return next;

    });

    return resultRef.current;

  }, [updateFavorites]);



  const removeFavorite = useCallback((type, value) => {

    const sanitizedType = sanitizeType(type);

    const normalizedValue = normalizeValue(value);

    if (!sanitizedType || !normalizedValue) {

      return { ok: false, reason: 'invalid' };

    }

    resultRef.current = { ok: false, reason: 'not-found' };

    updateFavorites((prev) => {

      const previousList = Array.isArray(prev[sanitizedType]) ? prev[sanitizedType] : [];

      const nextList = previousList.filter((item) => item.normalized !== normalizedValue);

      if (nextList.length === previousList.length) {

        resultRef.current = { ok: false, reason: 'not-found' };

        return prev;

      }

      const next = { ...prev, [sanitizedType]: nextList };

      resultRef.current = { ok: true };

      return next;

    });

    return resultRef.current;

  }, [updateFavorites]);



  const clearType = useCallback((type) => {

    const sanitizedType = sanitizeType(type);

    if (!sanitizedType) {

      return;

    }

    updateFavorites((prev) => ({ ...prev, [sanitizedType]: [] }));

  }, [updateFavorites]);



  const memoized = useMemo(() => ({

    staff: Array.isArray(favorites.staff) ? favorites.staff : [],

    action: Array.isArray(favorites.action) ? favorites.action : [],

  }), [favorites]);



  return {

    favorites: memoized,

    addFavorite,

    removeFavorite,

    clearType,

  };

}

