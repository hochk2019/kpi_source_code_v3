import { useCallback, useMemo } from "react";

import { extractLicenseCodesFromRowObj } from "@/lib/rules.js";
import {
  coerceLicenseValue,
  extractAgencyKeys,
  normalizeAgencyKey,
  normalizeLicenseCode,
} from "@/components/dataImporter/dataImporterLicenseUtils.js";

export default function useDataImporterLicenseSummary({ rules }) {
  const licenseExcludeSet = useMemo(() => {
    const codes = Array.isArray(rules?.license?.exclude?.codes) ? rules.license.exclude.codes : [];
    return new Set(codes.map(normalizeLicenseCode).filter(Boolean));
  }, [rules]);

  const licenseAgencyExcludeMap = useMemo(() => {
    const entries = Array.isArray(rules?.license?.exclude?.agencies)
      ? rules.license.exclude.agencies
      : [];
    const map = new Map();

    for (const entry of entries) {
      const agencyKey = normalizeAgencyKey(entry?.agency);
      if (!agencyKey) continue;
      const codes = Array.isArray(entry?.codes)
        ? entry.codes.map(normalizeLicenseCode).filter(Boolean)
        : [];
      if (!codes.length) continue;
      map.set(agencyKey, new Set(codes));
    }

    return map;
  }, [rules]);

  const getLicenseExcludeSetForRow = useCallback(
    (row) => {
      const combined = new Set(licenseExcludeSet);
      const agencyKeys = extractAgencyKeys(row);
      for (const key of agencyKeys) {
        if (!licenseAgencyExcludeMap.has(key)) continue;
        for (const code of licenseAgencyExcludeMap.get(key)) {
          combined.add(code);
        }
      }
      return combined;
    },
    [licenseAgencyExcludeMap, licenseExcludeSet],
  );

  const summarizeLicenseSnapshot = useCallback(
    (row) => {
      if (!row || typeof row !== "object") {
        return {
          sourceCodes: [],
          includedCodes: [],
          excludedCodes: [],
          sourceCount: 0,
          includedCount: 0,
          excludedCount: 0,
        };
      }

      const excludeSet = getLicenseExcludeSetForRow(row);
      const baseSource = Array.isArray(row.licenseSourceCodes) ? row.licenseSourceCodes : [];
      const currentCodes = Array.isArray(row.licenseCodes) ? row.licenseCodes : [];
      const storedExcluded = Array.isArray(row.licenseExcludedCodes) ? row.licenseExcludedCodes : [];
      const extracted = extractLicenseCodesFromRowObj(row) || [];
      const normalizedSource = Array.from(
        new Set(
          [...baseSource, ...currentCodes, ...storedExcluded, ...extracted]
            .map(normalizeLicenseCode)
            .filter(Boolean),
        ),
      );
      const explicitExcluded = Array.from(
        new Set(storedExcluded.map(normalizeLicenseCode).filter(Boolean)),
      );
      const computedExcluded = normalizedSource.filter((code) => excludeSet.has(code));
      const excludedSet = new Set([...explicitExcluded, ...computedExcluded]);
      const includedCodes = normalizedSource.filter((code) => !excludedSet.has(code));
      const manualOverride = coerceLicenseValue(row.licenseManualCount);
      const directCountSource =
        manualOverride !== "" ? manualOverride : coerceLicenseValue(row.licenses ?? row.so_luong_gp);
      const manualCount = directCountSource === "" ? null : Number(directCountSource);
      const includedCount =
        Number.isFinite(manualCount) && manualCount >= 0 ? manualCount : includedCodes.length;
      const sourceCount = normalizedSource.length || includedCodes.length + excludedSet.size;

      return {
        sourceCodes: normalizedSource,
        includedCodes,
        excludedCodes: Array.from(excludedSet),
        sourceCount,
        includedCount,
        excludedCount: excludedSet.size,
      };
    },
    [getLicenseExcludeSetForRow],
  );

  return {
    licenseExcludeSet,
    licenseAgencyExcludeMap,
    getLicenseExcludeSetForRow,
    summarizeLicenseSnapshot,
  };
}
