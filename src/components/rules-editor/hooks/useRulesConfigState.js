import { useMemo } from "react";

import { parseAgencyList } from "@/lib/store.js";

const EMPTY_GROUP_MAP = Object.freeze({});
const DEFAULT_LICENSE_CONFIG = Object.freeze({
  defaultPoints: 0,
  codePoints: [],
  exclude: { codes: [], agencies: [] },
});

export default function useRulesConfigState({ data, rule, hqAgencies, updateRule }) {
  const groups = useMemo(() => {
    if (rule?.groups && typeof rule.groups === "object") {
      return rule.groups;
    }

    return EMPTY_GROUP_MAP;
  }, [rule?.groups]);

  const typeOptions = useMemo(() => {
    const counter = new Map();

    data.forEach((row) => {
      const raw =
        row?.loai_hinh ||
        row?.loaiHinh ||
        row?.ma_loai_hinh ||
        row?.maLoaiHinh ||
        row?.loai_hinh_tm ||
        "";

      const code = String(raw || "").trim().toUpperCase();
      if (!code) return;

      const current = counter.get(code) || { value: code, count: 0 };
      current.count += 1;
      counter.set(code, current);
    });

    Object.values(groups).forEach((group) => {
      (group?.codes || []).forEach((code) => {
        const upper = String(code || "").trim().toUpperCase();
        if (!upper || counter.has(upper)) return;

        counter.set(upper, { value: upper, count: 0 });
      });
    });

    return Array.from(counter.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    });
  }, [data, groups]);

  const licenseConfig = useMemo(
    () => rule?.license || DEFAULT_LICENSE_CONFIG,
    [rule?.license]
  );

  const licenseOptions = useMemo(() => {
    const counter = new Map();

    const pushCode = (value, weight = 1) => {
      const code = String(value || "")
        .trim()
        .toUpperCase();
      if (!code) return;

      const current = counter.get(code) || { value: code, count: 0 };
      current.count += weight;
      counter.set(code, current);
    };

    const extractCodes = (source) => {
      if (!source) return [];
      if (Array.isArray(source)) {
        return source;
      }
      if (typeof source === "string") {
        return source
          .split(/[\s,;|]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      }

      return [];
    };

    data.forEach((row) => {
      const candidates = [
        row?.licenseCodes,
        row?.licenseSourceCodes,
        row?.licenseExcludedCodes,
        row?.licensesList,
      ];

      candidates.forEach((value) => {
        extractCodes(value).forEach((code) => pushCode(code));
      });
    });

    (licenseConfig.codePoints || []).forEach((entry) => pushCode(entry?.code));
    (licenseConfig.exclude?.codes || []).forEach((code) => pushCode(code));
    (licenseConfig.exclude?.agencies || []).forEach((entry) => {
      (entry?.codes || []).forEach((code) => pushCode(code));
    });

    return Array.from(counter.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    });
  }, [data, licenseConfig]);

  const agencyOptions = useMemo(() => {
    const counter = new Map();

    const record = (value, hint = "") => {
      const key = String(value || "").trim();
      if (!key) return;

      const current = counter.get(key) || { value: key, count: 0, hint: "" };
      current.count += 1;
      if (!current.hint && hint) {
        current.hint = hint;
      }
      counter.set(key, current);
    };

    const recordList = (value, hint = "") => {
      if (Array.isArray(value)) {
        value.forEach((item) => record(item, hint));
        return;
      }

      parseAgencyList(value).forEach((item) => record(item, hint));
    };

    data.forEach((row) => {
      const hint = row?.company || row?.cong_ty || row?.customer || "";
      recordList(row?.agency, hint);
      recordList(row?.dai_ly, hint);
      recordList(row?.hqAgency, hint);
      recordList(row?.agent, hint);
    });

    hqAgencies.forEach((entry) => {
      const hint = entry?.company || "";
      record(entry?.agent, hint);
      recordList(entry?.agents, hint);
    });

    (licenseConfig.exclude?.agencies || []).forEach((entry) => record(entry?.agency));

    return Array.from(counter.values())
      .map((item) => ({
        value: item.value,
        label: item.value,
        hint: item.hint,
        count: item.count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.value.localeCompare(b.value, "vi", { sensitivity: "base" });
      });
  }, [data, hqAgencies, licenseConfig.exclude?.agencies]);

  const updateGroup = (groupKey, updater) => {
    updateRule((prev) => {
      const group = prev.groups?.[groupKey] || {};
      const nextGroup = typeof updater === "function" ? updater(group) : updater;

      return {
        ...prev,
        groups: {
          ...prev.groups,
          [groupKey]: nextGroup,
        },
      };
    });
  };

  const handleCodesChange = (groupKey, codes) => {
    const normalized = Array.isArray(codes)
      ? codes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean)
      : [];
    const unique = Array.from(new Set(normalized));

    updateGroup(groupKey, (group) => ({ ...group, codes: unique }));
  };

  const handleGroupNumber = (groupKey, key, value) => {
    updateGroup(groupKey, (group) => ({ ...group, [key]: value }));
  };

  const handleLicenseChange = (updater) => {
    updateRule((prev) => ({
      ...prev,
      license: typeof updater === "function" ? updater(prev.license || {}) : updater,
    }));
  };

  const handleAgencyChange = (nextList) => {
    handleLicenseChange((license) => ({
      ...license,
      exclude: {
        codes: license.exclude?.codes || [],
        agencies: nextList,
      },
    }));
  };

  return {
    groups,
    typeOptions,
    licenseConfig,
    licenseOptions,
    agencyOptions,
    handleCodesChange,
    handleGroupNumber,
    handleLicenseChange,
    handleAgencyChange,
  };
}
