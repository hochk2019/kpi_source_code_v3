import { useCallback } from "react";

import { parseDataImporterWorkbook } from "@/components/dataImporter/dataImporterWorkbookParser.js";

function resetFileInput(fileRef, inputElement) {
  if (fileRef?.current) {
    fileRef.current.value = "";
  }
  if (inputElement) {
    inputElement.value = "";
  }
}

export default function useDataImporterImportFlow({
  fileRef,
  canUploadFiles = false,
  isReadOnlyForEdits = false,
  hasUnsaved = false,
  mode = "source",
  selectedFile = "",
  effectivePreviewRows = [],
  importPreview = null,
  canOverwriteData = false,
  overwrite = false,
  actor = "system",
  isAdminRole = false,
  autoAssignStaff = false,
  defaultCoFilterMin = 5,
  loadRules,
  setRules,
  getTeamRoster,
  mapMemberNamesToTeams,
  mapHQAgenciesByMST,
  detectDateOrder,
  mapRow,
  ensureLicenseFields,
  sortDeclRows,
  setRawRows,
  setPage,
  setMode,
  setSelectedFile,
  setPreviewSource,
  setSyncPreviewMeta,
  setQuery,
  setFilterNoStaff,
  setFilterNoTeam,
  setCoFilterMode,
  setCoFilterMin,
  setSelectedKeys,
  setHasUnsaved,
  saveDeclRows,
  pushImportLog,
  loadSavedRows,
  fetchAlerts,
  xlsx,
  xlsxLoader,
  parseWorkbookRows,
  FileReaderCtor,
  toast,
  acceptedImportExtensions = [],
  maxImportFileSizeBytes = 0,
  maxImportRows = 0,
}) {
  const handleFileChange = useCallback(
    (event) => {
      if (!canUploadFiles) {
        alert(
          'Tài khoản của bạn chưa được cấp quyền "Import Data – tải file". Vui lòng liên hệ quản trị viên để mở quyền tải file import.',
        );
        return;
      }

      if (isReadOnlyForEdits) {
        alert("Bạn đang ở chế độ chỉ xem — hãy đăng nhập để import dữ liệu.");
        return;
      }

      if (hasUnsaved && mode === "saved") {
        const proceed = window.confirm(
          "Bạn có các thay đổi chưa lưu. Chọn file mới sẽ làm mất các chỉnh sửa đó. Bạn có chắc chắn muốn tiếp tục?",
        );

        if (!proceed) {
          resetFileInput(fileRef, event?.target);
          return;
        }
      }

      const inputElement = event?.target;
      const file = inputElement?.files?.[0];
      if (!file) return;

      const resetInput = () => resetFileInput(fileRef, inputElement);
      const normalizedName = String(file.name || "").toLowerCase();
      const extension = normalizedName.slice(normalizedName.lastIndexOf("."));

      if (
        extension &&
        !acceptedImportExtensions.some((acceptedExtension) =>
          normalizedName.endsWith(acceptedExtension),
        )
      ) {
        toast?.error?.("Chỉ hỗ trợ import file Excel định dạng .xlsx hoặc .xlsm.");
        resetInput();
        return;
      }

      if (file.size > maxImportFileSizeBytes) {
        const limitMb = (maxImportFileSizeBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
        toast?.error?.(
          `File vượt quá ${limitMb} MB. Vui lòng tách nhỏ hoặc xoá bớt sheet trước khi import.`,
        );
        resetInput();
        return;
      }

      if (typeof FileReaderCtor !== "function") {
        toast?.error?.("Trình duyệt hiện tại không hỗ trợ đọc file Excel để import.");
        resetInput();
        return;
      }

      const reader = new FileReaderCtor();
      reader.onerror = () => {
        toast?.error?.("Không thể đọc file Excel. Vui lòng thử lại hoặc kiểm tra định dạng file.");
        resetInput();
      };

      reader.onload = async () => {
        try {
          const workbookData = await (parseWorkbookRows
            ? parseWorkbookRows(reader.result)
            : parseDataImporterWorkbook(reader.result, { xlsx, xlsxLoader }));
          const sheetName = workbookData?.sheetName;

          if (!sheetName) {
            toast?.error?.("File Excel không chứa sheet dữ liệu nào. Vui lòng kiểm tra lại.");
            resetInput();
            return;
          }

          const rows = Array.isArray(workbookData?.rows) ? workbookData.rows : [];

          if (!Array.isArray(rows) || rows.length === 0) {
            toast?.error?.("File Excel không có dữ liệu tờ khai. Vui lòng kiểm tra lại nội dung.");
            resetInput();
            return;
          }

          if (rows.length > maxImportRows) {
            toast?.error?.(
              `File chứa ${rows.length.toLocaleString("vi-VN")} dòng, vượt giới hạn ${maxImportRows.toLocaleString(
                "vi-VN",
              )} dòng cho mỗi lần import. Vui lòng tách file hoặc lọc lại dữ liệu.`,
            );
            resetInput();
            return;
          }

          const loadedRules = loadRules();
          setRules(loadedRules);

          const excludeCodes = Array.isArray(loadedRules?.license?.exclude?.codes)
            ? loadedRules.license.exclude.codes
            : [];
          const dateOrder = detectDateOrder(rows);
          const preferMonthFirst = dateOrder === "mdy";
          const roster = getTeamRoster();
          const memberMap = mapMemberNamesToTeams(roster);
          const agencyMap = mapHQAgenciesByMST();

          const normalizedRows = rows
            .map((row) =>
              mapRow(row, {
                autoAssignStaff,
                rules: loadedRules,
                licenseExcludes: excludeCodes,
                preferMonthFirst,
                memberMap,
                agencyMap,
              }),
            )
            .map(ensureLicenseFields);

          const invalidDateCount = normalizedRows.filter((row) => !row.date).length;
          if (invalidDateCount > 0) {
            toast?.error?.(
              `Có ${invalidDateCount.toLocaleString(
                "vi-VN",
              )} dòng có ngày tờ khai không hợp lệ. Vui lòng kiểm tra lại định dạng ngày (dd/mm/yyyy).`,
            );
            resetInput();
            return;
          }

          const sanitizedRows = normalizedRows.filter((row) => row.so_tk && row.date);
          if (!sanitizedRows.length) {
            toast?.error?.("Không tìm thấy tờ khai hợp lệ sau khi kiểm tra file Excel.");
            resetInput();
            return;
          }

          setRawRows(sortDeclRows(sanitizedRows));
          setPage(1);
          setMode("preview");
          setSelectedFile(file.name || "");
          setPreviewSource?.("file");
          setSyncPreviewMeta?.(null);
          setQuery("");
          setFilterNoStaff(false);
          setFilterNoTeam(false);
          setCoFilterMode("all");
          setCoFilterMin(defaultCoFilterMin);
          setSelectedKeys([]);
          setHasUnsaved(false);
        } catch (error) {
          console.error("Không thể xử lý file Excel import", error);
          toast?.error?.("Không thể xử lý file Excel. Vui lòng kiểm tra định dạng và thử lại.");
        } finally {
          resetInput();
        }
      };

      reader.readAsArrayBuffer(file);
    },
    [
      FileReaderCtor,
      acceptedImportExtensions,
      autoAssignStaff,
      canUploadFiles,
      defaultCoFilterMin,
      detectDateOrder,
      ensureLicenseFields,
      fileRef,
      getTeamRoster,
      hasUnsaved,
      isReadOnlyForEdits,
      loadRules,
      mapHQAgenciesByMST,
      mapMemberNamesToTeams,
      mapRow,
      maxImportFileSizeBytes,
      maxImportRows,
      mode,
      setCoFilterMin,
      setCoFilterMode,
      setFilterNoStaff,
      setFilterNoTeam,
      setHasUnsaved,
      setMode,
      setPage,
      setPreviewSource,
      setSyncPreviewMeta,
      setQuery,
      setRawRows,
      setRules,
      setSelectedFile,
      setSelectedKeys,
      sortDeclRows,
      toast,
      xlsx,
      xlsxLoader,
      parseWorkbookRows,
    ],
  );

  const handleImport = useCallback(() => {
    if (!canUploadFiles) {
      alert(
        'Tài khoản của bạn chưa được cấp quyền "Import Data – tải file". Vui lòng liên hệ quản trị viên để mở quyền tải file import.',
      );
      return;
    }

    if (isReadOnlyForEdits) {
      alert(
        "Bạn không có quyền import dữ liệu. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục.",
      );
      return;
    }

    if (mode !== "preview") {
      alert("Hãy chọn file XLSX để import.");
      return;
    }

    if (effectivePreviewRows.length === 0) {
      alert("Không có dữ liệu để import");
      return;
    }

    if ((importPreview?.invalid || 0) > 0) {
      const proceed = window.confirm(
        `Có ${importPreview.invalid.toLocaleString(
          "vi-VN",
        )} dòng lỗi sẽ bị bỏ qua khi import. Bạn vẫn muốn tiếp tục?`,
      );

      if (!proceed) {
        return;
      }
    }

    if ((importPreview?.inserted || 0) === 0 && (importPreview?.updated || 0) === 0) {
      const proceed = window.confirm(
        "File không tạo ra tờ khai mới hoặc cập nhật nào. Bạn vẫn muốn tiếp tục import?",
      );

      if (!proceed) {
        return;
      }
    }

    const rows = effectivePreviewRows;
    const effectiveOverwrite = canOverwriteData ? overwrite : false;
    const result = saveDeclRows(rows, {
      overwrite: effectiveOverwrite,
      actor,
      detail: `Import từ ${selectedFile || "file XLSX"}`,
      allowReviewedOverride: isAdminRole,
    });

    const insertedLabel = result.inserted.toLocaleString("vi-VN");
    const updatedLabel = result.updated.toLocaleString("vi-VN");
    const skippedLabel = result.skipped.toLocaleString("vi-VN");
    const lockedLabel = result.locked.toLocaleString("vi-VN");
    const totalLabel = result.totalStored.toLocaleString("vi-VN");
    const skippedSummary =
      result.locked > 0 ? `bỏ qua ${skippedLabel} (khóa ${lockedLabel})` : `bỏ qua ${skippedLabel}`;
    const message = `Import ${selectedFile || "file XLSX"}: +${insertedLabel} / cập nhật ${updatedLabel} / ${skippedSummary} → tổng ${totalLabel}`;

    pushImportLog({
      kind: "manual-import",
      actor,
      message,
      summary: {
        file: selectedFile || "",
        totalIncoming: result.totalIncoming,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        locked: result.locked,
        invalid: result.invalid,
        totalStored: result.totalStored,
        newBusinesses: result.newBusinessCount,
      },
      meta: {
        file: selectedFile || "",
        errors: Array.isArray(result.errors) ? result.errors : [],
        newBusinesses: Array.isArray(result.newBusinesses) ? result.newBusinesses.slice(0, 50) : [],
      },
      insertedDeclarations: result.insertedDeclarations,
      updatedDeclarations: result.updatedDeclarations,
      lockedDeclarations: result.lockedDeclarations,
    });

    alert(`Import xong: thêm ${insertedLabel}, cập nhật ${updatedLabel}, ${skippedSummary}.`);

    if (fileRef?.current) {
      fileRef.current.value = "";
    }

    loadSavedRows?.({ bypassConfirm: true });
    fetchAlerts?.();
  }, [
    actor,
    canOverwriteData,
    canUploadFiles,
    effectivePreviewRows,
    fetchAlerts,
    fileRef,
    importPreview,
    isAdminRole,
    isReadOnlyForEdits,
    loadSavedRows,
    mode,
    overwrite,
    pushImportLog,
    saveDeclRows,
    selectedFile,
  ]);

  return {
    handleFileChange,
    handleImport,
  };
}
