import { useCallback, useRef, useState } from "react";

import * as XLSX from "xlsx";

import { getMSTMap, upsertMSTRows } from "@/lib/store.js";
import { sortMSTRows } from "@/components/mst-assignment/model/displaySelectors.js";

export function appendImportedKeys(prev, keys = []) {
  if (!Array.isArray(keys) || !keys.length) {
    return prev;
  }

  let changed = false;
  const next = new Set(prev);
  keys.forEach((key) => {
    if (key && !next.has(key)) {
      next.add(key);
      changed = true;
    }
  });

  return changed ? next : prev;
}

export function mergeImportedRows(existingRows, importedRows, helpers) {
  const { createRowState, makeRowKey } = helpers;
  const byKey = new Map();
  const newRowKeys = [];

  for (const row of existingRows) {
    byKey.set(makeRowKey(row), { ...row });
  }

  for (const row of importedRows) {
    const key = makeRowKey(row);
    const previous = byKey.get(key);

    if (previous) {
      byKey.set(
        key,
        createRowState(
          { ...previous, ...row },
          {
            originalKey: previous.__originalKey,
            isNew: previous.__isNew,
          }
        )
      );
      continue;
    }

    byKey.set(key, createRowState(row, { isNew: true }));
    newRowKeys.push(key);
  }

  return {
    nextRows: sortMSTRows(Array.from(byKey.values())),
    newRowKeys,
  };
}

function mapSheetRows(jsonRows, { applyFrom, findCell, normalizeStatusLabel, tidyMST, toISO }) {
  return jsonRows
    .map((row) => {
      const mst = tidyMST(findCell(row, "mst"));
      if (!mst) return null;

      return {
        mst,
        company: String(findCell(row, "company") ?? "").trim(),
        person_import: String(findCell(row, "person_import") ?? "").trim(),
        person_export: String(findCell(row, "person_export") ?? "").trim(),
        team: String(findCell(row, "team") ?? "").trim(),
        effective_from: toISO(findCell(row, "effective_from")) || applyFrom || "",
        effective_to: toISO(findCell(row, "effective_to")) || "",
        status: normalizeStatusLabel(findCell(row, "status")),
      };
    })
    .filter(Boolean);
}

function hasValidDateRange(row) {
  if (!row?.effective_from || !row?.effective_to) {
    return true;
  }
  return row.effective_to >= row.effective_from;
}

const NOOP_ALERT = () => {};

export default function useMSTAssignmentImportSaveWorkspace({
  actor,
  applyFrom,
  helpers,
  isReadOnly,
  refreshHistory,
  rows,
  setOriginalRows,
  setRecentlyImportedKeys,
  setRows,
  goToFirstPage,
  alertFn = typeof window !== "undefined" && typeof window.alert === "function"
    ? window.alert.bind(window)
    : NOOP_ALERT,
  loadRows = getMSTMap,
  persistRows = upsertMSTRows,
  xlsx = XLSX,
}) {
  const fileRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const markRecentlyImported = useCallback(
    (keys = []) => {
      setRecentlyImportedKeys((prev) => appendImportedKeys(prev, keys));
    },
    [setRecentlyImportedKeys]
  );

  const clearSelectedFile = useCallback(() => {
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    setSelectedFileName("");
  }, []);

  const handleFileChange = useCallback((event) => {
    const name = event?.target?.files?.[0]?.name || "";
    setSelectedFileName(name);
  }, []);

  const onImportXLSX = useCallback(async () => {
    if (isReadOnly) {
      alertFn("Bạn không có quyền import bảng MST. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục.");
      return;
    }

    const file = fileRef.current?.files?.[0];
    if (!file) {
      alertFn("Chưa chọn file .xlsx/.xls");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = xlsx.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      });

      const mappedRows = mapSheetRows(jsonRows, {
        applyFrom,
        findCell: helpers.findCell,
        normalizeStatusLabel: helpers.normalizeStatusLabel,
        tidyMST: helpers.tidyMST,
        toISO: helpers.toISO,
      });

      if (!mappedRows.length) {
        alertFn("Không thấy dữ liệu hợp lệ trong file.");
        return;
      }

      const sanitizedRows = mappedRows.filter((item) => {
        if (!hasValidDateRange(item)) {
          console.warn("Bỏ qua dòng do ngày kết thúc nhỏ hơn ngày bắt đầu", item);
          return false;
        }
        return true;
      });

      if (!sanitizedRows.length) {
        alertFn("Tất cả dòng trong file bị bỏ qua vì ngày kết thúc nhỏ hơn ngày bắt đầu.");
        return;
      }

      const { nextRows, newRowKeys } = mergeImportedRows(rows, sanitizedRows, helpers);
      setRows(nextRows);
      goToFirstPage();
      markRecentlyImported(newRowKeys);
      alertFn(`Đọc file thành công: ${sanitizedRows.length} dòng. Bấm Lưu để ghi.`);
    } catch (error) {
      console.error(error);
      alertFn("Không thể đọc file .xlsx — kiểm tra lại định dạng.");
    } finally {
      clearSelectedFile();
    }
  }, [
    alertFn,
    applyFrom,
    clearSelectedFile,
    goToFirstPage,
    helpers,
    isReadOnly,
    markRecentlyImported,
    rows,
    setRows,
    xlsx,
  ]);

  const onSave = useCallback(() => {
    if (isReadOnly) {
      alertFn("Bạn không có quyền lưu bảng MST.");
      return;
    }

    try {
      persistRows(rows, {
        actor,
        detail: "Cập nhật gán MST từ giao diện",
      });
      refreshHistory();

      const synced = sortMSTRows(loadRows()).map((row) =>
        helpers.createRowState(row, {
          originalKey: helpers.makeRowKey(row),
          isNew: false,
        })
      );

      setRows(synced);
      setOriginalRows(synced);
      setRecentlyImportedKeys(new Set());
      alertFn("Lưu thành công!");
    } catch (error) {
      console.error(error);
      alertFn("Lưu thất bại!");
    }
  }, [
    actor,
    alertFn,
    helpers,
    isReadOnly,
    loadRows,
    persistRows,
    refreshHistory,
    rows,
    setOriginalRows,
    setRecentlyImportedKeys,
    setRows,
  ]);

  return {
    fileRef,
    selectedFileName,
    handleFileChange,
    markRecentlyImported,
    onImportXLSX,
    onSave,
  };
}
