import { useCallback, useMemo, useState } from "react";

import {
  getDeclRows,
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  normalizeMST,
  normalizeName,
  normalizeStr,
  roundAdjustmentPoint,
  sortDeclRows,
} from "@/lib/store.js";

import {
  buildBusinessDirectory,
  buildDeclarationSuggestions,
  extractDigits,
  MAX_DECLARATION_SUGGESTIONS,
} from "../model/businessDirectory.js";
import { buildGuidanceGroups } from "../model/guidanceGroups.js";

const EMPTY_BUSINESS_DIRECTORY = Object.freeze({
  entries: [],
  byMst: new Map(),
  byCompany: new Map(),
});

function buildTeamOptions(roster) {
  if (!roster || !Array.isArray(roster.teams)) {
    return [];
  }

  return roster.teams
    .map((team) => normalizeStr(team?.name))
    .filter(Boolean);
}

function resolveLicenseOptions(formCategoryConfig) {
  const baseLicenseOptions = Array.isArray(formCategoryConfig.licenseOptions)
    ? formCategoryConfig.licenseOptions
    : [];

  let licenseOptions = baseLicenseOptions.map((option) => {
    if (!option) return option;

    const code = String(option.value || "").toUpperCase();
    let label = option.label || option.value;
    if (code === "ZB02") label = "ZB02 - Xin cấp phép tiền chất CN";
    else if (code === "ZB03") label = "ZB03 - Khai báo hóa chất";

    return { ...option, value: code, label };
  });

  if (!licenseOptions.some((option) => String(option?.value || "").toUpperCase() === "ZB99")) {
    licenseOptions = [...licenseOptions, { value: "ZB99", label: "ZB99 - Giấy phép khác" }];
  }

  return licenseOptions;
}

function computeFormTotals(form, formCategoryConfig, isHybridFixed) {
  const computedQuantity = Number.parseFloat(form.quantity ?? 0) || 0;
  const computedUnit =
    formCategoryConfig.type === "grade"
      ? Number.parseFloat(form.gradeValue ?? form.unitPoints ?? 0) || 0
      : Number.parseFloat(form.unitPoints ?? 0) || 0;
  const computedExtraQuantity = Number.parseFloat(form.extraQuantity ?? 0) || 0;
  const computedExtraUnit = Number.parseFloat(form.extraUnitPoints ?? 0) || 0;
  const computedExtraTotal = roundAdjustmentPoint(computedExtraQuantity * computedExtraUnit);

  let baseTotal = 0;
  if (formCategoryConfig.type === "grade") {
    baseTotal = roundAdjustmentPoint(computedUnit);
  }
  if (formCategoryConfig.type === "hybrid" && isHybridFixed) {
    baseTotal = roundAdjustmentPoint(computedUnit);
  }
  if (baseTotal === 0 && formCategoryConfig.type !== "grade") {
    baseTotal = roundAdjustmentPoint(computedQuantity * computedUnit);
  }

  return {
    computedExtraTotal,
    computedTotal: roundAdjustmentPoint(baseTotal + computedExtraTotal),
  };
}

export function useKpiAdjustmentFormWorkspace({
  form,
  setForm,
  settings,
  roster,
  staffOptions,
  canOverridePoints,
  parseReferences,
}) {
  const [businessData, setBusinessData] = useState(() => {
    const suggestions = buildDeclarationSuggestions(MAX_DECLARATION_SUGGESTIONS);
    return { suggestions, directory: buildBusinessDirectory(suggestions) };
  });
  const [declarationSearch, setDeclarationSearch] = useState("");

  const declarationSuggestions = useMemo(() => businessData.suggestions ?? [], [businessData.suggestions]);
  const businessDirectory = useMemo(
    () => businessData.directory ?? EMPTY_BUSINESS_DIRECTORY,
    [businessData.directory]
  );
  const businessEntries = useMemo(() => businessDirectory.entries || [], [businessDirectory]);
  const businessByMst = useMemo(
    () => (businessDirectory.byMst instanceof Map ? businessDirectory.byMst : new Map()),
    [businessDirectory]
  );
  const businessByCompany = useMemo(
    () => (businessDirectory.byCompany instanceof Map ? businessDirectory.byCompany : new Map()),
    [businessDirectory]
  );

  const teamOptions = useMemo(() => buildTeamOptions(roster), [roster]);
  const normalizedTeamFilter = normalizeStr(form.teamName);
  const filteredStaffOptions = useMemo(() => {
    if (!normalizedTeamFilter) {
      return staffOptions;
    }
    return staffOptions.filter((option) => normalizeStr(option.team) === normalizedTeamFilter);
  }, [normalizedTeamFilter, staffOptions]);

  const mstOptions = useMemo(() => {
    return businessEntries.slice(0, 400).map((entry) => ({
      value: entry.mst,
      label: entry.company ? `${entry.mst} — ${entry.company}` : entry.mst,
    }));
  }, [businessEntries]);

  const companyOptions = useMemo(() => {
    const list = Array.from(businessByCompany.values()).map((entry) => {
      const msts = Array.from(entry.msts || []);
      return {
        company: entry.company,
        msts,
        label: entry.company,
        description: msts.length ? `MST: ${msts.join(", ")}` : "Chưa có MST",
      };
    });

    return list
      .filter((item) => item.company)
      .sort((a, b) => a.company.localeCompare(b.company, "vi", { sensitivity: "base" }))
      .slice(0, 400);
  }, [businessByCompany]);

  const quickDeclarationSuggestions = useMemo(() => declarationSuggestions.slice(0, 5), [declarationSuggestions]);
  const guidanceGroups = useMemo(() => buildGuidanceGroups(settings), [settings]);

  const filteredDeclarationResults = useMemo(() => {
    if (!declarationSuggestions.length) return [];

    const rawQuery = normalizeStr(declarationSearch);
    if (!rawQuery) {
      return declarationSuggestions.slice(0, 8);
    }

    const digits = extractDigits(rawQuery);
    const normalizedQuery = normalizeName(rawQuery);
    const primaryResults = declarationSuggestions
      .filter((item) => {
        if (!item) return false;
        if (digits) {
          if ((item.soTkDigits || "").includes(digits)) return true;
          if ((item.soTk || "").includes(digits)) return true;
          if (item.mst && item.mst.includes(digits)) return true;
        }
        if (normalizedQuery && item.company && normalizeName(item.company).includes(normalizedQuery)) {
          return true;
        }
        return false;
      })
      .slice(0, 10);

    if (digits && primaryResults.length < 10) {
      const seenKeys = new Set(primaryResults.map((item) => item.key));
      const fallback = [];
      const rows = sortDeclRows(getDeclRows());

      for (const row of rows) {
        if (primaryResults.length + fallback.length >= 10) {
          break;
        }

        const rawNumber = row?.so_tk_full ?? row?.so_tk ?? "";
        const soTkDigits = extractDigits(rawNumber);
        const soTkValue = normalizeStr(rawNumber);
        const mstDigits = normalizeMST(row?.mst ?? row?.ma_so_thue ?? row?.taxCode ?? "");
        const hasMatch = (soTkDigits && soTkDigits.includes(digits)) || (mstDigits && mstDigits.includes(digits));
        if (!hasMatch) {
          continue;
        }

        const branch = normalizeStr(row?.nhanh ?? row?.branch ?? "");
        const key = `${soTkDigits || soTkValue}|${branch}`;
        if (seenKeys.has(key)) {
          continue;
        }

        seenKeys.add(key);
        fallback.push({
          key,
          soTk: soTkValue,
          soTkDigits,
          branch,
          mst: mstDigits,
          company: normalizeStr(row?.cong_ty ?? row?.company ?? row?.ten_cong_ty ?? row?.doanh_nghiep ?? ""),
          date: row?.date || "",
          timestamp: row?.date ? Date.parse(row.date) || 0 : 0,
        });
      }

      if (fallback.length) {
        return primaryResults.concat(fallback);
      }
    }

    return primaryResults;
  }, [declarationSearch, declarationSuggestions]);

  const mergeBusinessInfo = useCallback(
    (draft, info = {}) => {
      if (!draft) return draft;

      const next = { ...draft };
      const incomingMst = info.mst ? normalizeMST(info.mst) : "";
      const incomingCompany = info.company ? normalizeStr(info.company) : "";

      if (incomingMst) {
        next.taxCode = incomingMst;
        const mstEntry = businessByMst.get(incomingMst);
        if (mstEntry?.company) {
          next.companyName = mstEntry.company;
        } else if (
          incomingCompany &&
          (!next.companyName || normalizeName(next.companyName) !== normalizeName(incomingCompany))
        ) {
          next.companyName = incomingCompany;
        }
      }

      if (incomingCompany) {
        if (!next.companyName || normalizeName(next.companyName) !== normalizeName(incomingCompany)) {
          next.companyName = incomingCompany;
        }

        const companyKey = normalizeName(incomingCompany);
        const companyEntry = businessByCompany.get(companyKey);
        if (companyEntry) {
          const currentMst = next.taxCode ? normalizeMST(next.taxCode) : "";
          const hasCurrent = currentMst && companyEntry.msts instanceof Set && companyEntry.msts.has(currentMst);
          if (!hasCurrent) {
            const firstMst = companyEntry.msts instanceof Set ? Array.from(companyEntry.msts)[0] : undefined;
            if (firstMst) {
              next.taxCode = firstMst;
              const resolved = businessByMst.get(firstMst);
              if (resolved?.company) {
                next.companyName = resolved.company;
              }
            }
          }
        }
      }

      return next;
    },
    [businessByCompany, businessByMst]
  );

  const appendReference = useCallback(
    (referenceValue, metadata = null) => {
      if (!referenceValue) return;

      setForm((prev) => {
        const combined = parseReferences(`${prev.referencesInput}\n${referenceValue}`).join("\n");
        let next = { ...prev, referencesInput: combined };
        if (metadata) {
          next = mergeBusinessInfo(next, metadata);
        }
        return next;
      });
    },
    [mergeBusinessInfo, parseReferences, setForm]
  );

  const refreshBusinessData = useCallback(() => {
    const suggestions = buildDeclarationSuggestions(MAX_DECLARATION_SUGGESTIONS);
    setBusinessData({ suggestions, directory: buildBusinessDirectory(suggestions) });
  }, []);

  const handleTaxCodeInput = useCallback(
    (value) => {
      const sanitized = normalizeMST(value);
      setForm((prev) => {
        const draft = { ...prev, taxCode: sanitized };
        if (!sanitized) {
          return draft;
        }
        return mergeBusinessInfo(draft, { mst: sanitized });
      });
    },
    [mergeBusinessInfo, setForm]
  );

  const handleCompanyInput = useCallback(
    (value) => {
      const trimmed = normalizeStr(value);
      setForm((prev) => {
        if (!trimmed) {
          return { ...prev, companyName: "" };
        }

        const draft = { ...prev, companyName: trimmed };
        return mergeBusinessInfo(draft, { company: trimmed });
      });
    },
    [mergeBusinessInfo, setForm]
  );

  const handleReferencePick = useCallback(
    (item) => {
      if (!item) return;
      appendReference(item.soTk, { mst: item.mst, company: item.company });
    },
    [appendReference]
  );

  const formCategoryConfig = useMemo(
    () => KPI_ADJUSTMENT_CATEGORY_CONFIG[form.category] || {},
    [form.category]
  );
  const historyEntries = Array.isArray(form.history) ? form.history.slice().reverse() : [];
  const modeOptions = Array.isArray(formCategoryConfig.modes) ? formCategoryConfig.modes : [];
  const licenseOptions = useMemo(() => resolveLicenseOptions(formCategoryConfig), [formCategoryConfig]);
  const normalizedMode = normalizeStr(form.mode || "").toLowerCase();
  const isHybridFixed = formCategoryConfig.type === "hybrid" && normalizedMode === "fixed";
  const allowManualPointOverride = canOverridePoints || form.category === "support_misc";
  const { computedExtraTotal, computedTotal } = computeFormTotals(form, formCategoryConfig, isHybridFixed);

  return {
    guidanceGroups,
    mstOptions,
    companyOptions,
    teamOptions,
    filteredStaffOptions,
    quickDeclarationSuggestions,
    declarationSearch,
    setDeclarationSearch,
    filteredDeclarationResults,
    refreshBusinessData,
    handleTaxCodeInput,
    handleCompanyInput,
    handleReferencePick,
    formCategoryConfig,
    historyEntries,
    modeOptions,
    licenseOptions,
    normalizedMode,
    isHybridFixed,
    allowManualPointOverride,
    computedExtraTotal,
    computedTotal,
  };
}
