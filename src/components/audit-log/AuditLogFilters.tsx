import React from "react";
import { t } from '@/lib/i18n.js';
import { PageHeader } from "@/components/designSystem/PageHeader";

interface AuditLogFiltersProps {
  filter: string;
  setFilter: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
  availableCategories: string[];
  onReset: () => void;
  onDownload: () => void;
  onRefresh: () => void;
}

export function AuditLogFilters({
  filter,
  setFilter,
  typeFilter,
  setTypeFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  availableCategories,
  onReset,
  onDownload,
  onRefresh,
}: AuditLogFiltersProps) {
  return (
    <PageHeader
      eyebrow="NHẬT KÝ"
      title={t('audit.title') || "Audit Log"}
      info={t('audit.description') || "Xem lịch sử hoạt động và thay đổi trong hệ thống"}
      meta={[]}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-sm font-medium bg-ds-surface-card border border-ds-border-subtle rounded-md hover:bg-ds-surface-muted transition-colors"
          >
            {t('audit.refresh') || "Làm mới"}
          </button>
          <button
            onClick={onDownload}
            className="px-3 py-1.5 text-sm font-medium bg-ds-accent text-white rounded-md hover:bg-ds-accent/90 transition-colors"
          >
            {t('audit.download') || "Tải xuống"}
          </button>
        </div>
      }
    />
  );
}
