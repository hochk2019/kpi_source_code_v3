import { useCallback, useMemo, useState } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

import { sanitizeReportTemplateFilters } from "@/components/reporting/useReportViewerPreferences.js";

const REPORT_TEMPLATE_STORAGE_KEY = "kpi_report_viewer_templates_v1";
const LAST_REPORT_TEMPLATE_KEY = "kpi_report_viewer_last_template_v1";
const MAX_REPORT_TEMPLATES = 20;

function readTemplateStore() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(REPORT_TEMPLATE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Không thể đọc mẫu báo cáo đã lưu", error);
    return [];
  }
}

function writeTemplateStore(templates) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(REPORT_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.warn("Không thể lưu mẫu báo cáo", error);
  }
}

function readLastTemplateId() {
  if (typeof window === "undefined" || !window.localStorage) {
    return "";
  }

  try {
    return window.localStorage.getItem(LAST_REPORT_TEMPLATE_KEY) || "";
  } catch (error) {
    console.warn("Không thể đọc mẫu báo cáo gần nhất", error);
    return "";
  }
}

function writeLastTemplateId(templateId) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    if (templateId) {
      window.localStorage.setItem(LAST_REPORT_TEMPLATE_KEY, templateId);
    } else {
      window.localStorage.removeItem(LAST_REPORT_TEMPLATE_KEY);
    }
  } catch (error) {
    console.warn("Không thể cập nhật mẫu báo cáo gần nhất", error);
  }
}

function sortTemplates(list = []) {
  return [...list].sort((left, right) => {
    const timeLeft = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
    const timeRight = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
    return timeRight - timeLeft;
  });
}

function sanitizeTemplateRecord(entry, now = new Date().toISOString()) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 120) : "";
  if (!name) {
    return null;
  }

  const filters = sanitizeReportTemplateFilters(entry.filters);

  return {
    id:
      typeof entry.id === "string" && entry.id.trim()
        ? entry.id.trim()
        : `report-template-${Math.random().toString(36).slice(2, 10)}`,
    name,
    filters,
    createdAt:
      typeof entry.createdAt === "string" && entry.createdAt.trim() ? entry.createdAt : now,
    updatedAt:
      typeof entry.updatedAt === "string" && entry.updatedAt.trim() ? entry.updatedAt : now,
  };
}

function buildUpdatedTemplateList(templates, nextTemplate, removedTemplateId = "") {
  const nextEntries = templates.filter((item) => item && item.id !== removedTemplateId);

  if (nextTemplate) {
    nextEntries.unshift(nextTemplate);
  }

  return sortTemplates(nextEntries).slice(0, MAX_REPORT_TEMPLATES);
}

export default function useReportViewerTemplates({
  templatePayload,
  onApplyTemplateFilters,
} = {}) {
  const { alert, confirm } = useAppDialog();
  const [templates, setTemplates] = useState(() => sortTemplates(readTemplateStore()));
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => readLastTemplateId());
  const [appliedTemplateId, setAppliedTemplateId] = useState(() => readLastTemplateId());
  const [templateSaving, setTemplateSaving] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );

  const appliedTemplate = useMemo(
    () => templates.find((item) => item.id === appliedTemplateId) || null,
    [appliedTemplateId, templates],
  );

  const appliedTemplateUpdatedAt = useMemo(() => {
    if (!appliedTemplate?.updatedAt) {
      return "";
    }

    try {
      return new Date(appliedTemplate.updatedAt).toLocaleString("vi-VN");
    } catch (error) {
      console.warn("Không thể định dạng thời gian cập nhật mẫu báo cáo", error);
      return "";
    }
  }, [appliedTemplate]);

  const refreshTemplates = useCallback(() => {
    const nextTemplates = sortTemplates(readTemplateStore());
    setTemplates(nextTemplates);

    if (selectedTemplateId && !nextTemplates.some((item) => item.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
    if (appliedTemplateId && !nextTemplates.some((item) => item.id === appliedTemplateId)) {
      setAppliedTemplateId("");
    }
  }, [appliedTemplateId, selectedTemplateId]);

  const handleSelectTemplate = useCallback((templateId) => {
    setSelectedTemplateId(templateId);
  }, []);

  const handleApplySelectedTemplate = useCallback(async () => {
    if (!selectedTemplate) {
      await alert("Vui lòng chọn mẫu báo cáo cần áp dụng.");
      return;
    }

    onApplyTemplateFilters?.(selectedTemplate.filters);
    setSelectedTemplateId(selectedTemplate.id);
    setAppliedTemplateId(selectedTemplate.id);
    writeLastTemplateId(selectedTemplate.id);
    await alert(`Đã áp dụng mẫu báo cáo "${selectedTemplate.name}".`);
  }, [onApplyTemplateFilters, selectedTemplate]);

  const handleSaveTemplateAsNew = useCallback(async () => {
    let nextName = selectedTemplate ? `${selectedTemplate.name} (bản sao)` : "Mẫu báo cáo mới";

    if (typeof window !== "undefined") {
      const input = window.prompt("Đặt tên cho mẫu báo cáo", nextName);
      if (input === null) {
        return;
      }

      nextName = input.trim();
      if (!nextName) {
        await alert("Tên mẫu báo cáo không được bỏ trống.");
        return;
      }
    }

    setTemplateSaving(true);

    try {
      const now = new Date().toISOString();
      const template = sanitizeTemplateRecord(
        {
          name: nextName,
          filters: templatePayload,
          createdAt: now,
          updatedAt: now,
        },
        now,
      );

      if (!template) {
        throw new Error("Không có cấu hình báo cáo hợp lệ để lưu.");
      }

      const nextTemplates = buildUpdatedTemplateList(templates, template);
      setTemplates(nextTemplates);
      setSelectedTemplateId(template.id);
      setAppliedTemplateId(template.id);
      writeTemplateStore(nextTemplates);
      writeLastTemplateId(template.id);
      await alert(`Đã lưu mẫu báo cáo "${template.name}".`);
    } catch (error) {
      await alert(error?.message || "Không thể lưu mẫu báo cáo.");
    } finally {
      setTemplateSaving(false);
    }
  }, [selectedTemplate, templatePayload, templates]);

  const handleOverwriteSelectedTemplate = useCallback(async () => {
    if (!selectedTemplate) {
      await alert("Vui lòng chọn mẫu báo cáo cần ghi đè.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !await confirm(`Ghi đè mẫu báo cáo "${selectedTemplate.name}" bằng cấu hình hiện tại?`)
    ) {
      return;
    }

    setTemplateSaving(true);

    try {
      const now = new Date().toISOString();
      const template = sanitizeTemplateRecord(
        {
          ...selectedTemplate,
          filters: templatePayload,
          updatedAt: now,
        },
        now,
      );

      if (!template) {
        throw new Error("Không có cấu hình báo cáo hợp lệ để lưu.");
      }

      const nextTemplates = buildUpdatedTemplateList(templates, template, template.id);
      setTemplates(nextTemplates);
      setAppliedTemplateId(template.id);
      writeTemplateStore(nextTemplates);
      writeLastTemplateId(template.id);
      await alert(`Đã cập nhật mẫu báo cáo "${template.name}".`);
    } catch (error) {
      await alert(error?.message || "Không thể cập nhật mẫu báo cáo.");
    } finally {
      setTemplateSaving(false);
    }
  }, [selectedTemplate, templatePayload, templates]);

  const handleDeleteSelectedTemplate = useCallback(async () => {
    if (!selectedTemplate) {
      await alert("Vui lòng chọn mẫu báo cáo cần xoá.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !await confirm(`Xoá mẫu báo cáo "${selectedTemplate.name}"?`, { variant: "destructive", confirmLabel: "Xóa" })
    ) {
      return;
    }

    setTemplateSaving(true);

    try {
      const nextTemplates = buildUpdatedTemplateList(templates, null, selectedTemplate.id);
      setTemplates(nextTemplates);
      setSelectedTemplateId("");

      if (appliedTemplateId === selectedTemplate.id) {
        setAppliedTemplateId("");
        writeLastTemplateId("");
      }

      writeTemplateStore(nextTemplates);
      await alert(`Đã xoá mẫu báo cáo "${selectedTemplate.name}".`);
    } catch (error) {
      await alert(error?.message || "Không thể xoá mẫu báo cáo.");
    } finally {
      setTemplateSaving(false);
    }
  }, [appliedTemplateId, selectedTemplate, templates]);

  return {
    templates,
    selectedTemplateId,
    selectedTemplate,
    appliedTemplate,
    appliedTemplateUpdatedAt,
    templateBusy: templateSaving,
    templateSaving,
    handleSelectTemplate,
    handleApplySelectedTemplate,
    handleSaveTemplateAsNew,
    handleOverwriteSelectedTemplate,
    handleDeleteSelectedTemplate,
    handleRefreshTemplates: refreshTemplates,
  };
}

