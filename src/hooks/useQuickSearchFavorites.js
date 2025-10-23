import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "kpi:data-importer:quick-search-favorites:v1";

const MAX_ITEMS_PER_TYPE = 25;

const ALLOWED_TYPES = new Set(["mst", "company", "status"]);

function sanitizeType(type) {
  if (typeof type !== "string") {
    return "";
  }

  const normalized = type.trim().toLowerCase();

  return ALLOWED_TYPES.has(normalized) ? normalized : "";
}

function normalizeValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value

    .normalize("NFD")

    .replace(/\p{Diacritic}/gu, "")

    .toLowerCase()

    .trim();
}

function readStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { mst: [], company: [], status: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { mst: [], company: [], status: [] };
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return { mst: [], company: [], status: [] };
    }

    const buildList = (key) => {
      const list = Array.isArray(parsed[key]) ? parsed[key] : [];

      return list

        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const value = typeof item.value === "string" ? item.value : "";

          const normalized =
            typeof item.normalized === "string" ? item.normalized : normalizeValue(value);

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
      mst: buildList("mst"),

      company: buildList("company"),

      status: buildList("status"),
    };
  } catch (error) {
    console.warn("Không thể đọc danh sách tìm kiếm nhanh đã lưu", error);

    return { mst: [], company: [], status: [] };
  }
}

function writeStorage(favorites) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,

      JSON.stringify({
        mst: favorites.mst || [],

        company: favorites.company || [],

        status: favorites.status || [],
      }),
    );
  } catch (error) {
    console.warn("Không thể lưu danh sách tìm kiếm nhanh đã lưu", error);
  }
}

export default function useQuickSearchFavorites() {
  const [favorites, setFavorites] = useState(() => readStorage());

  const resultRef = useRef({ ok: false });

  useEffect(() => {
    setFavorites(readStorage());
  }, []);

  const updateFavorites = useCallback((updater) => {
    setFavorites((prev) => {
      const current = prev || { mst: [], company: [], status: [] };

      const next = updater(current);

      writeStorage(next);

      return next;
    });
  }, []);

  const addFavorite = useCallback(
    (type, value) => {
      const sanitizedType = sanitizeType(type);

      const normalizedValue = normalizeValue(value);

      if (!sanitizedType || !normalizedValue) {
        return { ok: false, reason: "invalid" };
      }

      const rawValue = value.trim();

      resultRef.current = { ok: false, reason: "unknown" };

      updateFavorites((prev) => {
        const previousList = Array.isArray(prev[sanitizedType]) ? prev[sanitizedType] : [];

        if (previousList.some((item) => item.normalized === normalizedValue)) {
          resultRef.current = { ok: false, reason: "duplicate" };

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
    },
    [updateFavorites],
  );

  const removeFavorite = useCallback(
    (type, value) => {
      const sanitizedType = sanitizeType(type);

      const normalizedValue = normalizeValue(value);

      if (!sanitizedType || !normalizedValue) {
        return { ok: false, reason: "invalid" };
      }

      resultRef.current = { ok: false, reason: "not-found" };

      updateFavorites((prev) => {
        const previousList = Array.isArray(prev[sanitizedType]) ? prev[sanitizedType] : [];

        const nextList = previousList.filter((item) => item.normalized !== normalizedValue);

        if (nextList.length === previousList.length) {
          resultRef.current = { ok: false, reason: "not-found" };

          return prev;
        }

        const next = { ...prev, [sanitizedType]: nextList };

        resultRef.current = { ok: true };

        return next;
      });

      return resultRef.current;
    },
    [updateFavorites],
  );

  const clearType = useCallback(
    (type) => {
      const sanitizedType = sanitizeType(type);

      if (!sanitizedType) {
        return;
      }

      updateFavorites((prev) => ({ ...prev, [sanitizedType]: [] }));
    },
    [updateFavorites],
  );

  const memoized = useMemo(
    () => ({
      mst: Array.isArray(favorites.mst) ? favorites.mst : [],

      company: Array.isArray(favorites.company) ? favorites.company : [],

      status: Array.isArray(favorites.status) ? favorites.status : [],
    }),
    [favorites],
  );

  return {
    favorites: memoized,

    addFavorite,

    removeFavorite,

    clearType,
  };
}
