import { useCallback } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

function arraysEqual(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function sortCodes(codes) {
  return [...codes].sort((left, right) => left.localeCompare(right));
}

function formatLicenseExclusionAlert(result) {
  if (!result?.summary) {
    return `Đã cập nhật ${result?.changed ?? 0}/${result?.matchedCount ?? 0} tờ khai.`;
  }

  const {
    totalSourceCodes,
    totalExcludedCodes,
    totalKeptCodes,
    globalCodes = [],
    agencyCodes = [],
    skippedNoSource = 0,
  } = result.summary;

  const lines = [
    `Đã cập nhật ${result.changed}/${result.matchedCount} tờ khai.`,
    `Tổng mã gốc: ${totalSourceCodes}, giữ lại: ${totalKeptCodes}, loại trừ: ${totalExcludedCodes}.`,
  ];

  if (globalCodes.length) {
    lines.push(
      `Mã bị loại theo quy tắc toàn cục: ${Array.from(new Set(globalCodes)).join(", ")}`
    );
  }

  if (agencyCodes.length) {
    const agencyDetails = agencyCodes
      .map(({ agency, codes }) => `${agency}: ${codes.join(", ")}`)
      .join("; ");
    lines.push(`Mã bị loại theo đại lý: ${agencyDetails}`);
  }

  if (skippedNoSource > 0) {
    lines.push(`Bỏ qua ${skippedNoSource} tờ khai không có mã giấy phép nguồn để đối chiếu.`);
  }

  if (totalExcludedCodes === totalSourceCodes && totalSourceCodes > 0) {
    lines.push(
      "Lưu ý: các mã của tờ khai này đều nằm trong danh sách loại trừ KPI nên kết quả sau đối chiếu còn 0."
    );
  }

  return lines.join("\n");
}

export default function useDataImporterLicenseExclusions({
  mode = "saved",
  rawRows = [],
  rules = null,
  selectedKeys = [],
  filteredKeys = [],
  canEdit = false,
  canAutoReconcile = false,
  editingRestrictionMessage = "",
  ensureEditableKeys,
  filterEditableKeys,
  keyOfRow,
  getLicenseExcludeSetForRow,
  licenseExcludeSet = new Set(),
  licenseAgencyExcludeMap = new Map(),
  setRawRows,
  setHasUnsaved,
  normalizeLicenseCode,
  normalizeAgencyKey,
  extractAgencyKeys,
  extractLicenseCodesFromRowObj,
  computeLicenseSnapshot,
  computeKPI,
}) {
  const { alert } = useAppDialog();

  const applyLicenseExclusionForKeys = useCallback(
    async (targetKeys, { alreadyFiltered = false } = {}) => {
      if (mode !== "saved") {
        return { ok: false, reason: "mode", blocked: 0 };
      }

      if (!Array.isArray(targetKeys) || targetKeys.length === 0) {
        return { ok: false, reason: "empty", blocked: 0 };
      }

      let workingKeys = targetKeys;
      let blockedCount = 0;

      if (!alreadyFiltered && typeof filterEditableKeys === "function") {
        const { allowed = [], blocked = 0 } = filterEditableKeys(targetKeys);
        if (!allowed.length) {
          return { ok: false, reason: blocked ? "restricted" : "empty", blocked };
        }

        blockedCount = blocked;
        if (blocked > 0 && editingRestrictionMessage) {
          await alert(`Đã bỏ qua ${blocked} tờ khai không thuộc phạm vi của bạn khi đối chiếu giấy phép.`);
        }

        workingKeys = allowed;
      }

      const keySet = new Set(workingKeys);
      if (keySet.size === 0) {
        return { ok: false, reason: "empty", blocked: blockedCount };
      }

      const summary = {
        processedKeys: new Set(),
        totalSourceCodes: 0,
        totalExcludedCodes: 0,
        totalKeptCodes: 0,
        details: [],
        globalCodes: new Set(),
        agencyCodes: new Map(),
        skippedNoSource: 0,
      };

      let changed = 0;
      let matchedCount = 0;

      const nextRows = rawRows.map((row) => {
        const rowKey = keyOfRow(row);
        if (!keySet.has(rowKey)) {
          return row;
        }

        const excludeSet = getLicenseExcludeSetForRow(row);
        const normalizedSource = new Set();
        const addCodes = (list) => {
          if (!Array.isArray(list)) return;
          for (const code of list) {
            const normalized = normalizeLicenseCode(code);
            if (normalized) {
              normalizedSource.add(normalized);
            }
          }
        };

        addCodes(row.licenseSourceCodes);
        addCodes(row.licenseCodes);
        addCodes(row.licenseExcludedCodes);

        for (const code of extractLicenseCodesFromRowObj(row) || []) {
          const normalized = normalizeLicenseCode(code);
          if (normalized) {
            normalizedSource.add(normalized);
          }
        }

        let fallbackSnapshot = null;
        if (normalizedSource.size === 0) {
          fallbackSnapshot = computeLicenseSnapshot(row, rules);
          for (const list of [
            fallbackSnapshot?.sourceCodes,
            fallbackSnapshot?.includedCodes,
            fallbackSnapshot?.excludedCodes,
          ]) {
            addCodes(list);
          }
        }

        if (normalizedSource.size === 0) {
          summary.skippedNoSource += 1;
          summary.details.push({
            key: rowKey,
            soTk: row.so_tk,
            source: [],
            kept: [],
            excluded: [],
            reason: "no_source_codes",
            manualCount:
              fallbackSnapshot && Number.isFinite(fallbackSnapshot.manualCount)
                ? fallbackSnapshot.manualCount
                : undefined,
          });
          return row;
        }

        const sourceList = sortCodes(Array.from(normalizedSource));
        const effectiveCodes = sourceList.filter((code) => !excludeSet.has(code));
        const excludedCodes = sourceList.filter((code) => excludeSet.has(code));
        const currentCodes = Array.isArray(row.licenseCodes)
          ? sortCodes(row.licenseCodes.map(normalizeLicenseCode).filter(Boolean))
          : sourceList;
        const currentExcludedCodes = Array.isArray(row.licenseExcludedCodes)
          ? sortCodes(row.licenseExcludedCodes.map(normalizeLicenseCode).filter(Boolean))
          : [];
        const nextLicenseCount = effectiveCodes.length;
        const currentLicenseCount = Number(
          row.licenses ?? row.so_luong_gp ?? currentCodes.length ?? 0
        );

        matchedCount += 1;
        summary.processedKeys.add(rowKey);
        summary.totalSourceCodes += sourceList.length;
        summary.totalExcludedCodes += excludedCodes.length;
        summary.totalKeptCodes += effectiveCodes.length;

        const agencyKeys = extractAgencyKeys(row);
        const excludedReasons = excludedCodes.map((code) => {
          const reasons = [];
          if (licenseExcludeSet.has(code)) {
            reasons.push({ type: "global" });
            summary.globalCodes.add(code);
          }

          for (const key of agencyKeys) {
            const normalizedAgency = normalizeAgencyKey(key);
            const agencySet = licenseAgencyExcludeMap.get(normalizedAgency);
            if (agencySet?.has(code)) {
              reasons.push({ type: "agency", key: normalizedAgency });
              const agencyCodes = summary.agencyCodes.get(normalizedAgency) || new Set();
              agencyCodes.add(code);
              summary.agencyCodes.set(normalizedAgency, agencyCodes);
            }
          }

          if (!reasons.length) {
            reasons.push({ type: "other" });
          }

          return { code, reasons };
        });

        summary.details.push({
          key: rowKey,
          soTk: row.so_tk,
          source: sourceList,
          kept: effectiveCodes,
          excluded: excludedCodes,
          excludedReasons,
        });

        if (
          nextLicenseCount === currentLicenseCount &&
          arraysEqual(effectiveCodes, currentCodes) &&
          arraysEqual(excludedCodes, currentExcludedCodes)
        ) {
          return row;
        }

        changed += 1;
        const nextRow = {
          ...row,
          licenseSourceCodes: sourceList,
          licenseExcludedCodes: excludedCodes,
          licenseCodes: effectiveCodes,
          licenses: nextLicenseCount,
          so_luong_gp: nextLicenseCount,
          licenseManualCount: nextLicenseCount,
          updatedAt: new Date().toISOString(),
        };

        const recalculated = computeKPI(nextRow, rules);
        if (Number.isFinite(recalculated)) {
          nextRow.kpi = Math.round(recalculated * 10) / 10;
        }

        return nextRow;
      });

      if (matchedCount === 0) {
        return { ok: false, reason: "missing" };
      }

      if (changed === 0) {
        return { ok: false, reason: "unchanged", matchedCount, blocked: blockedCount };
      }

      setRawRows(nextRows);
      setHasUnsaved(true);

      return {
        ok: true,
        changed,
        matchedCount,
        blocked: blockedCount,
        summary: {
          totalRows: summary.processedKeys.size,
          totalSourceCodes: summary.totalSourceCodes,
          totalExcludedCodes: summary.totalExcludedCodes,
          totalKeptCodes: summary.totalKeptCodes,
          details: summary.details,
          globalCodes: Array.from(summary.globalCodes),
          agencyCodes: Array.from(summary.agencyCodes.entries()).map(([agency, codes]) => ({
            agency,
            codes: Array.from(codes),
          })),
          skippedNoSource: summary.skippedNoSource,
        },
      };
    },
    [
      computeKPI,
      computeLicenseSnapshot,
      editingRestrictionMessage,
      extractAgencyKeys,
      extractLicenseCodesFromRowObj,
      filterEditableKeys,
      getLicenseExcludeSetForRow,
      keyOfRow,
      licenseAgencyExcludeMap,
      licenseExcludeSet,
      mode,
      normalizeAgencyKey,
      normalizeLicenseCode,
      rawRows,
      rules,
      setHasUnsaved,
      setRawRows,
    ]
  );

  const handleApplyLicenseExclusion = useCallback(async () => {
    if (selectedKeys.length === 0) {
      await alert("Hay chon it nhat mot to khai de doi chieu giay phep.");
      return;
    }

    const allowedKeys = await ensureEditableKeys(selectedKeys, "doi chieu giay phep");
    if (!allowedKeys) {
      return;
    }

    const result = await applyLicenseExclusionForKeys(allowedKeys, { alreadyFiltered: true });
    if (!result?.ok) {
      if (result?.reason === "mode") {
        await alert("Chi co the dieu chinh giay phep khi dang xem du lieu da luu.");
        return;
      }
      if (result?.reason === "unchanged") {
        await alert("Cac to khai duoc chon da khong con ma giay phep nam trong danh sach loai tru.");
        return;
      }
      if (result?.reason === "missing" || result?.reason === "empty") {
        await alert("Khong tim thay to khai phu hop de doi chieu.");
        return;
      }
      await alert("Khong the doi chieu giay phep cho lua chon hien tai.");
      return;
    }

    await alert(formatLicenseExclusionAlert(result));
  }, [applyLicenseExclusionForKeys, ensureEditableKeys, selectedKeys]);

  const handleAutoApplyLicenseExclusion = useCallback(async () => {
    if (!canEdit) {
      await alert("Bạn không có quyền chỉnh sửa dữ liệu tờ khai.");
      return;
    }
    if (!canAutoReconcile) {
      await alert("Chỉ Quản lý hoặc Quản trị viên mới được phép đối chiếu KPI tự động.");
      return;
    }
    if (mode !== "saved") {
      await alert("Hãy chuyển sang chế độ dữ liệu đã lưu để đối chiếu tự động.");
      return;
    }
    if (!filteredKeys.length) {
      await alert("Không có tờ khai nào khớp với bộ lọc hiện tại để đối chiếu.");
      return;
    }

    const allowedKeys = await ensureEditableKeys(filteredKeys, "đối chiếu giấy phép tự động");
    if (!allowedKeys) {
      return;
    }

    const result = await applyLicenseExclusionForKeys(allowedKeys, { alreadyFiltered: true });
    if (!result?.ok) {
      if (result?.reason === "unchanged") {
        await alert("Tất cả tờ khai trong bộ lọc hiện tại đã loại trừ giấy phép đầy đủ.");
        return;
      }
      if (result?.reason === "missing" || result?.reason === "empty") {
        await alert("Không có tờ khai hợp lệ để tự động đối chiếu.");
        return;
      }
      await alert("Không thể tự động đối chiếu loại trừ KPI. Vui lòng thử lại.");
      return;
    }

    await alert(`Đã tự động cập nhật loại trừ giấy phép cho ${result.changed}/${result.matchedCount} tờ khai đang hiển thị.`);
  }, [
    applyLicenseExclusionForKeys,
    canAutoReconcile,
    canEdit,
    ensureEditableKeys,
    filteredKeys,
    mode,
  ]);

  return {
    applyLicenseExclusionForKeys,
    handleApplyLicenseExclusion,
    handleAutoApplyLicenseExclusion,
  };
}
