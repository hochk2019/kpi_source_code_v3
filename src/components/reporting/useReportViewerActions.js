import { useState } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

import {
  deleteReportingSchedule,
  saveReportingSchedule,
} from "../../../packages/api-client/src/reportingClient.js";
import {
  createScheduleDraft,
  toSchedulePayload,
} from "@/components/reporting/reportingScheduleDraft.js";
import { validateReportExportPermissionState } from "@/components/reporting/reportingExportState.js";
import { toast } from "@/shared/toast.js";

let reportExporterPromise;

function loadReportExporterModule() {
  if (!reportExporterPromise) {
    reportExporterPromise = import("@/lib/reportExport.js");
  }

  return reportExporterPromise;
}

export function validateReportExportPermission({ canExport = true, summary = {} }) {
  return validateReportExportPermissionState({
    canExport,
    summary,
  });
}

export function useReportViewerActions({
  canExport = true,
  summary = {},
  report = {},
  exportColumns = {},
  reportLoading = false,
  reportError = "",
}) {
  const { alert, confirm } = useAppDialog();
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

  const handleToggleDeliveryChannel = (channel) => {
    setScheduleDraft((prev) => {
      const current = Array.isArray(prev.deliveryChannels) ? [...prev.deliveryChannels] : [];
      const index = current.indexOf(channel);

      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(channel);
      }

      return { ...prev, deliveryChannels: current };
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

    if (!Array.isArray(payload.deliveryChannels) || !payload.deliveryChannels.length) {
      toast.warning?.("Chon it nhat mot kenh giao bao cao truoc khi luu.");
      return;
    }

    if (payload.deliveryChannels.includes("email") && !String(payload.recipients || "").trim()) {
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

    const confirmed = await confirm(`Xoa lich gui "${schedule.name || "Bao cao KPI"}"?`, { variant: "destructive", confirmLabel: "Xóa" });
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

  const withExporter = async (runner, label = "báo cáo") => {
    setExporting(true);
    const stickyId = toast.sticky(`Đang xuất ${label}…`, {
      kind: "info",
      description: "Vui lòng chờ trong khi file Excel được tạo.",
    });

    try {
      const exporter = await loadReportExporterModule();
      await runner(exporter);
      toast.dismiss(stickyId);
      toast.success("Xuất báo cáo thành công.");
    } catch (err) {
      toast.dismiss(stickyId);
      console.error("Khong the xuat bao cao", err);
      toast.error(err?.message || "Không thể xuất báo cáo.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportStaffAll = async () => {
    const message = validateReportExportPermissionState({
      canExport,
      summary,
      reportLoading,
      reportError,
    });
    if (message) {
      await alert(message);
      return;
    }

    await withExporter((module) =>
      module.exportAllStaffReport({
        range: report.range,
        rules: report.rules,
        columns: exportColumns,
      }),
      "báo cáo tất cả nhân viên",
    );
  };

  const handleExportStaffDetail = async (staffEntry) => {
    const message = validateReportExportPermissionState({
      canExport,
      summary,
      reportLoading,
      reportError,
    });
    if (message) {
      await alert(message);
      return;
    }

    await withExporter((module) =>
      module.exportStaffReport({
        staff: staffEntry,
        range: report.range,
        rules: report.rules,
        columns: exportColumns,
      }),
      `báo cáo nhân viên ${staffEntry?.name || ""}`,
    );
  };

  const handleExportTeamAll = async () => {
    const message = validateReportExportPermissionState({
      canExport,
      summary,
      reportLoading,
      reportError,
    });
    if (message) {
      await alert(message);
      return;
    }

    await withExporter((module) =>
      module.exportAllTeamReport({
        range: report.range,
        rules: report.rules,
        columns: exportColumns,
      }),
      "báo cáo tất cả đội nhóm",
    );
  };

  const handleExportTeamDetail = async (teamEntry) => {
    const message = validateReportExportPermissionState({
      canExport,
      summary,
      reportLoading,
      reportError,
    });
    if (message) {
      await alert(message);
      return;
    }

    await withExporter((module) =>
      module.exportTeamReport({
        team: teamEntry,
        range: report.range,
        rules: report.rules,
        columns: exportColumns,
      }),
      `báo cáo đội nhóm ${teamEntry?.name || ""}`,
    );
  };

  return {
    scheduleDraft,
    editingScheduleId,
    exporting,
    handleScheduleFieldChange,
    handleToggleScheduleFormat,
    handleToggleDeliveryChannel,
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
