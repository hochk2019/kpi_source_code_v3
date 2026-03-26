import { useCallback, useState } from "react";

import { sortMSTRows } from "@/components/mst-assignment/model/displaySelectors.js";

function createEmptyDraft(effectiveFrom = "") {
  return {
    mst: "",
    company: "",
    person_import: "",
    person_export: "",
    team: "",
    effective_from: effectiveFrom,
    effective_to: "",
  };
}

function computeNextStageStart(row, applyFrom) {
  if (!row) {
    return applyFrom || "";
  }

  const base = row.effective_to || row.effective_from || applyFrom || "";
  if (!base) return "";

  const date = new Date(base);
  if (Number.isNaN(date.getTime())) {
    return base;
  }

  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function useMSTAssignmentAddFormWorkspace({
  applyFrom,
  computeStoredStatus,
  createRowState,
  goToFirstPage,
  isReadOnly,
  makeRowKey,
  markRecentlyImported,
  normalizeName,
  normalizeStr,
  rows,
  scrollToTopFn,
  setRows,
  tidyMST,
  alertFn = (message) => window.alert(message),
  scheduleScrollFn = (callback, delay) => window.setTimeout(callback, delay),
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState(() => createEmptyDraft(applyFrom || ""));
  const [addError, setAddError] = useState("");

  const handleDraftChange = useCallback(
    (field, formatter = (value) => value) =>
      (event) => {
        const raw = event?.target?.value ?? "";
        const value = formatter(raw);
        setDraft((prev) => ({ ...prev, [field]: value }));
      },
    []
  );

  const handleDraftImportSelect = useCallback(
    ({ staffName, teamName, isCustom }) => {
      setDraft((prev) => {
        const next = { ...prev, person_import: staffName || "" };
        if (staffName && teamName && !isCustom) {
          const prevTeamKey = normalizeName(normalizeStr(prev.team || ""));
          const nextTeamKey = normalizeName(normalizeStr(teamName));
          if (!prevTeamKey || prevTeamKey === nextTeamKey) {
            next.team = teamName;
          }
        }
        return next;
      });
    },
    [normalizeName, normalizeStr]
  );

  const handleDraftExportSelect = useCallback(
    ({ staffName, teamName, isCustom }) => {
      setDraft((prev) => {
        const next = { ...prev, person_export: staffName || "" };
        if (staffName && teamName && !isCustom) {
          const prevTeamKey = normalizeName(normalizeStr(prev.team || ""));
          const nextTeamKey = normalizeName(normalizeStr(teamName));
          if (!prevTeamKey || prevTeamKey === nextTeamKey) {
            next.team = teamName;
          }
        }
        return next;
      });
    },
    [normalizeName, normalizeStr]
  );

  const handleCloseAddForm = useCallback(() => {
    setShowAddForm(false);
    setAddError("");
  }, []);

  const toggleAddForm = useCallback(() => {
    if (isReadOnly) {
      alertFn(
        "Bạn không có quyền thêm mới thủ công. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục."
      );
      return;
    }

    if (showAddForm) {
      setShowAddForm(false);
      setAddError("");
      return;
    }

    setDraft(createEmptyDraft(applyFrom || ""));
    setAddError("");
    setShowAddForm(true);
  }, [alertFn, applyFrom, isReadOnly, showAddForm]);

  const startNewStageFromRow = useCallback(
    (row) => {
      if (isReadOnly) {
        alertFn("Bạn không có quyền thêm giai đoạn mới.");
        return;
      }

      const nextStart = computeNextStageStart(row, applyFrom);
      setDraft({
        mst: row?.mst || "",
        company: row?.company || "",
        person_import: row?.person_import || "",
        person_export: row?.person_export || "",
        team: row?.team || "",
        effective_from: nextStart || "",
        effective_to: "",
      });
      setAddError("");
      setShowAddForm(true);

      scheduleScrollFn(() => {
        scrollToTopFn?.();
      }, 60);
    },
    [alertFn, applyFrom, isReadOnly, scheduleScrollFn, scrollToTopFn]
  );

  const handleAddSubmit = useCallback(
    (event) => {
      event.preventDefault();

      if (isReadOnly) {
        alertFn("Bạn không có quyền thêm mới.");
        return;
      }

      const mst = tidyMST(draft.mst);
      if (!mst) {
        setAddError("Vui lòng nhập mã số thuế hợp lệ (chỉ chứa số).");
        return;
      }

      const normalizedCompany = String(draft.company || "").trim();
      const normalizedImport = String(draft.person_import || "").trim();
      const normalizedExport = String(draft.person_export || "").trim();
      const normalizedTeam = String(draft.team || "").trim();
      const normalizedDate = draft.effective_from || "";
      const normalizedEnd = draft.effective_to || "";

      if (normalizedDate && normalizedEnd && normalizedEnd < normalizedDate) {
        setAddError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
        return;
      }

      const newRow = {
        mst,
        company: normalizedCompany,
        person_import: normalizedImport,
        person_export: normalizedExport,
        team: normalizedTeam,
        effective_from: normalizedDate,
        effective_to: normalizedEnd,
        status: computeStoredStatus({
          person_import: normalizedImport,
          person_export: normalizedExport,
        }),
      };

      const newKey = makeRowKey(newRow);
      const createdKey = (Array.isArray(rows) ? rows : []).some(
        (row) => makeRowKey(row) === newKey
      )
        ? ""
        : newKey;

      setRows((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        const next = [...current];
        const existingIndex = next.findIndex((row) => makeRowKey(row) === newKey);
        const resolvedTeam =
          normalizedTeam || (existingIndex >= 0 ? next[existingIndex]?.team || "" : "");
        const resolvedStatus = computeStoredStatus({
          ...newRow,
          team: resolvedTeam,
          status: newRow.status,
        });
        const payload = { ...newRow, team: resolvedTeam, status: resolvedStatus };

        if (existingIndex >= 0) {
          const originalMeta = next[existingIndex];
          next[existingIndex] = createRowState(
            { ...originalMeta, ...payload },
            {
              originalKey: originalMeta.__originalKey,
              isNew: originalMeta.__isNew,
            }
          );
        } else {
          next.push(createRowState(payload, { isNew: true }));
        }

        return sortMSTRows(next);
      });

      if (createdKey) {
      markRecentlyImported?.([createdKey]);
      }

      goToFirstPage?.();
      setShowAddForm(false);
      setAddError("");
      alertFn("Đã thêm vào danh sách. Bấm Lưu để ghi vào hệ thống.");
    },
    [
      alertFn,
      computeStoredStatus,
      createRowState,
      draft,
      goToFirstPage,
      isReadOnly,
      makeRowKey,
      markRecentlyImported,
      rows,
      setRows,
      tidyMST,
    ]
  );

  return {
    showAddForm,
    draft,
    addError,
    toggleAddForm,
    startNewStageFromRow,
    handleDraftChange,
    handleDraftImportSelect,
    handleDraftExportSelect,
    handleCloseAddForm,
    handleAddSubmit,
  };
}
