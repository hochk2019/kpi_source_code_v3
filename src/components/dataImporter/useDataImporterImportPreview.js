import { useEffect, useMemo } from "react";

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

    try {
      const allowOverwrite = !isSyncPreview && canOverwriteData ? overwrite : false;
      return previewDeclRows(effectivePreviewRows, { overwrite: allowOverwrite, actor });
    } catch (error) {
      console.error("Khong the tinh toan ket qua xem truoc import", error);
      return { error };
    }
  }, [actor, canOverwriteData, effectivePreviewRows, isSyncPreview, mode, overwrite, previewDeclRows]);

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
