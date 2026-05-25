import { useEffect, useMemo } from "react";

function toTrimmedString(value) {
  return `${value ?? ""}`.trim();
}

function resolveSyncPreviewCompanyName(row) {
  return (
    row?.company ||
    row?.cong_ty ||
    row?.ten_dn ||
    row?.ten_doanh_nghiep ||
    row?.ten_doanh_nghiep_xnk ||
    row?.["Tên doanh nghiệp"] ||
    row?.["Doanh nghiệp"] ||
    ""
  );
}

function resolveSyncPreviewTotalIncoming(rows, syncPreviewMeta) {
  const fetched = Number(syncPreviewMeta?.fetched);
  if (Number.isFinite(fetched) && fetched > 0) {
    return Math.floor(fetched);
  }

  return rows.length;
}

function buildSyncImportPreview(rows, syncPreviewMeta, fallbackPreview) {
  const incomingRows = Array.isArray(rows) ? rows : [];
  const insertedSamples = [];
  const lockedSamples = [];
  const newBusinessesByMst = new Map();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let locked = 0;

  incomingRows.forEach((row) => {
    const changedFields = Array.isArray(row?.changedFields) ? row.changedFields.filter(Boolean) : [];
    const isNewRow = row?.status === "new";
    const isLockedRow = Boolean(row?.locked);

    if (isNewRow) {
      inserted += 1;
      if (insertedSamples.length < 20) {
        insertedSamples.push(row);
      }

      const mst = toTrimmedString(row?.mst || row?.ma_so_thue);
      if (mst && !newBusinessesByMst.has(mst)) {
        newBusinessesByMst.set(mst, {
          mst,
          company: resolveSyncPreviewCompanyName(row),
        });
      }
      return;
    }

    if (isLockedRow) {
      locked += 1;
      if (lockedSamples.length < 20) {
        lockedSamples.push(row);
      }
      return;
    }

    if (changedFields.length > 0) {
      updated += 1;
      return;
    }

    skipped += 1;
  });

  const totalIncoming = resolveSyncPreviewTotalIncoming(incomingRows, syncPreviewMeta);
  const fallbackTotalAfter =
    typeof fallbackPreview?.totalAfter === "number" ? fallbackPreview.totalAfter : totalIncoming;
  const fallbackTotalStored =
    typeof fallbackPreview?.totalStored === "number" ? fallbackPreview.totalStored : fallbackTotalAfter;

  return {
    mode: fallbackPreview?.mode || "merge",
    totalBefore: typeof fallbackPreview?.totalBefore === "number" ? fallbackPreview.totalBefore : 0,
    totalAfter: fallbackTotalAfter,
    totalStored: fallbackTotalStored,
    totalIncoming,
    inserted,
    updated,
    skipped,
    locked,
    invalid: 0,
    errors: [],
    insertedDeclarations: Array.isArray(fallbackPreview?.insertedDeclarations)
      ? fallbackPreview.insertedDeclarations
      : [],
    updatedDeclarations: Array.isArray(fallbackPreview?.updatedDeclarations)
      ? fallbackPreview.updatedDeclarations
      : [],
    lockedDeclarations: Array.isArray(fallbackPreview?.lockedDeclarations)
      ? fallbackPreview.lockedDeclarations
      : [],
    samples: {
      inserted: insertedSamples,
      updated: Array.isArray(fallbackPreview?.samples?.updated) ? fallbackPreview.samples.updated : [],
      locked: lockedSamples,
      errors: [],
    },
    newBusinessCount: newBusinessesByMst.size,
    newBusinesses: Array.from(newBusinessesByMst.values()),
  };
}

export default function useDataImporterImportPreview({
  rawRows = [],
  upsert11 = false,
  mode = "preview",
  previewSource = null,
  overwrite = false,
  actor = "system",
  canImportUpload = false,
  allowAdminUploadOverride = false,
  isAdminRole = false,
  syncPreviewMeta = null,
  previewDeclRows,
  setOverwrite,
}) {
  const isSyncPreview = previewSource === "sync";
  const effectivePreviewRows = useMemo(() => {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return [];
    }
    if (!upsert11) {
      return rawRows;
    }

    return rawRows.map((row) => {
      if (!row || typeof row !== "object") {
        return row;
      }

      const truncated = (row.so_tk || "").toString().slice(0, 11);
      if (!truncated || truncated === row.so_tk) {
        return row;
      }

      return { ...row, so_tk: truncated };
    });
  }, [rawRows, upsert11]);

  const canUploadFiles = canImportUpload || (allowAdminUploadOverride && isAdminRole);
  const canOverwriteData = isAdminRole && canUploadFiles;

  const importPreview = useMemo(() => {
    if (mode !== "preview" || effectivePreviewRows.length === 0) {
      return null;
    }

    const allowOverwrite = !isSyncPreview && canOverwriteData ? overwrite : false;
    let fallbackPreview = null;

    try {
      fallbackPreview = previewDeclRows(effectivePreviewRows, { overwrite: allowOverwrite, actor });
    } catch (error) {
      if (!isSyncPreview) {
        console.error("Khong the tinh toan ket qua xem truoc import", error);
        return { error };
      }

      console.error("Khong the tinh toan ket qua xem truoc import", error);
      fallbackPreview = null;
    }

    if (isSyncPreview) {
      return buildSyncImportPreview(effectivePreviewRows, syncPreviewMeta, fallbackPreview);
    }

    return fallbackPreview;
  }, [
    actor,
    canOverwriteData,
    effectivePreviewRows,
    isSyncPreview,
    mode,
    overwrite,
    previewDeclRows,
    syncPreviewMeta,
  ]);

  useEffect(() => {
    if (!canOverwriteData && overwrite) {
      setOverwrite(false);
    }
  }, [canOverwriteData, overwrite, setOverwrite]);

  return {
    effectivePreviewRows,
    canUploadFiles,
    canOverwriteData,
    importPreview,
  };
}
