import { useState } from "react";

import {
  deleteReportingSchedule,
  saveReportingSchedule,
} from "../../../packages/api-client/src/reportingClient.js";
import {
  createScheduleDraft,
  toSchedulePayload,
} from "@/components/reporting/ReportingPanels.jsx";
import { toast } from "@/shared/toast.js";

let reportExporterPromise;

function loadReportExporterModule() {
  if (!reportExporterPromise) {
    reportExporterPromise = import("@/lib/reportExport.js");
  }

  return reportExporterPromise;
}

export function validateReportExportPermission({ canExport = true, summary = {} }) {
  if (!canExport) {
    return "Tai khoan hien tai khong duoc phep xuat bao cao.";
  }

  if (!summary?.decls) {
    return "Khong co du lieu de xuat";
  }

  return "";
}

export function useReportViewerActions({
  canExport = true,
  summary = {},
  report = {},
  exportColumns = {},
}) {
  const [scheduleDraft, setScheduleDraft] = useState(() => createScheduleDraft());
  const [editingScheduleId, setEditingScheduleId] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleScheduleFieldChange = (field, value) => {
    setScheduleDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleScheduleFormat = (format) => {
    setScheduleDraft((prev) => {
      const current = Array.isArray(prev.formats) ? [...prev.formats] : [];
      const index = current.indexOf(format);

      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(format);
      }

      if (!current.length) {
        current.push(format);
      }

      return { ...prev, formats: current };
    });
  };

  const handleEditSchedule = (schedule) => {
    setEditingScheduleId(schedule?.id || "");
    setScheduleDraft(createScheduleDraft(schedule));
  };

  const handleResetScheduleForm = () => {
    setEditingScheduleId("");
    setScheduleDraft(createScheduleDraft());
  };

  const handleSaveSchedule = async (event) => {
    event?.preventDefault?.();

    const payload = toSchedulePayload({ ...scheduleDraft, id: editingScheduleId });
    if (!payload.name || !payload.name.trim()) {
      toast.warning?.("Dat ten cho lich gui bao cao de de quan ly.");
      return;
    }

    if (!String(payload.recipients || "").trim()) {
      toast.warning?.(
        "Nhap danh sach email nhan bao cao (ngan cach boi dau phay hoac xuong dong).",
      );
      return;
    }

    try {
      const saved = await saveReportingSchedule(payload, { actor: "ui.report" });
      setEditingScheduleId(saved.id);
      setScheduleDraft(createScheduleDraft(saved));
      toast.success?.("Da luu lich gui bao cao KPI.");
    } catch (error) {
      console.error(error);
      toast.error?.(error?.message || "Khong the luu lich gui bao cao.");
    }
  };

  const handleDeleteSchedule = async (schedule) => {
    if (!schedule?.id) {
      return;
    }

    const confirmed = window.confirm(`Xoa lich gui "${schedule.name || "Bao cao KPI"}"?`);
    if (!confirmed) {
      return;
    }

    try {
      const ok = await deleteReportingSchedule(schedule.id, { actor: "ui.report" });
      if (ok) {
        if (editingScheduleId === schedule.id) {
          handleResetScheduleForm();
        }

        toast.success?.("Da xoa lich gui bao cao.");
      } else {
        toast.error?.("Khong the xoa lich gui bao cao da chon.");
      }
    } catch (error) {
      console.error(error);
      toast.error?.(error?.message || "Khong the xoa lich gui bao cao.");
    }
  };

  const withExporter = async (runner) => {
    setExporting(true);

    try {
      const exporter = await loadReportExporterModule();
      await runner(exporter);
    } catch (err) {
      console.error("Khong the xuat bao cao", err);
      window.alert(`Khong the xuat bao cao: ${err?.message || "Loi khong xac dinh"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportStaffAll = async () => {
    const message = validateReportExportPermission({ canExport, summary });
    if (message) {
      window.alert(message);
      return;
    }

    await withExporter((module) =>
      module.exportAllStaffReport({
        range: report.range,
        rules: report.rules,
        columns: exportColumns,
      }),
    );
  };

  const handleExportStaffDetail = async (staffEntry) => {
    const message = validateReportExportPermission({ canExport, summary });
    if (message) {
      window.alert(message);
      return;
    }

    await withExporter((module) =>
      module.exportStaffReport({
        staff: staffEntry,
        range: report.range,
        rules: report.rules,
        columns: exportColumns,
      }),
    );
  };

  const handleExportTeamAll = async () => {
    const message = validateReportExportPermission({ canExport, summary });
    if (message) {
      window.alert(message);
      return;
    }

    await withExporter((module) =>
      module.exportAllTeamReport({
        range: report.range,
        rules: report.rules,
        columns: exportColumns,
      }),
    );
  };

  const handleExportTeamDetail = async (teamEntry) => {
    const message = validateReportExportPermission({ canExport, summary });
    if (message) {
      window.alert(message);
      return;
    }

    await withExporter((module) =>
      module.exportTeamReport({
        team: teamEntry,
        range: report.range,
        rules: report.rules,
        columns: exportColumns,
      }),
    );
  };

  return {
    scheduleDraft,
    editingScheduleId,
    exporting,
    handleScheduleFieldChange,
    handleToggleScheduleFormat,
    handleEditSchedule,
    handleResetScheduleForm,
    handleSaveSchedule,
    handleDeleteSchedule,
    handleExportStaffAll,
    handleExportStaffDetail,
    handleExportTeamAll,
    handleExportTeamDetail,
  };
}

export default useReportViewerActions;
