import React from "react";

import { QUICK_RANGE_OPTIONS } from "@/lib/reports.js";
import ReportingTemplateControls from "@/components/reporting/ReportingTemplateControls.jsx";
import {
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.tsx";

interface ScheduleAggregateStatus {
  available: boolean;
  range?: { from?: string; to?: string };
  generatedAt?: string;
}

interface ScheduleDraft {
  name?: string;
  recipientsInput?: string;
  frequency?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  time?: string;
  formats?: string[];
  active?: boolean;
  deliveryChannels?: string[];
}

interface ScheduleRecord {
  id: string;
  name?: string;
  active?: boolean;
  nextRun?: string;
  formatsSummary?: string;
  recipientsSummary?: string;
  deliveryChannels?: string[];
  frequency?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  time?: string;
  deliveryStatus?: string;
  lastDeliveryError?: string;
  lastDeliveryAt?: string;
}

interface NextScheduleRun {
  nextRun?: string;
}

interface ReportControlsMetaProps {
  summaryDeclsText: string;
  selectedRuleName?: string;
}

interface ScheduleShellMetaProps {
  nextScheduleRun?: NextScheduleRun | null;
  scheduleAggregateStatus?: ScheduleAggregateStatus | null;
}

interface WorkspaceJumpLinkProps {
  href: string;
  title: string;
  detail: string;
}

interface ReportingWorkspaceGuidePanelProps {
  canManageSchedule?: boolean;
}

interface ReportingControlsPanelProps {
  summaryDeclsText: string;
  selectedRuleName?: string;
  reloading?: boolean;
  onReloadData: () => void;
  quickRange: string;
  onQuickRangeChange: (value: string) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  ruleOptions: { value: string; label: string }[];
  selectedRuleId: string;
  onRuleChange: (value: string) => void;
  selectedRuleVersionLabel?: string;
  ruleComparisonLabel?: string;
  activeRuleMessage?: string;
  nextScheduleRun?: NextScheduleRun | null;
  reportRange?: { from?: string; to?: string };
  ruleApply?: string;
  scheduleAggregateStatus?: ScheduleAggregateStatus | null;
  templates?: unknown[];
  selectedTemplateId?: string;
  appliedTemplate?: unknown;
  appliedTemplateUpdatedAt?: string;
  templateBusy?: boolean;
  templateSaving?: boolean;
  onSelectTemplate?: (id: string) => void;
  onApplySelectedTemplate?: () => void;
  onSaveTemplateAsNew?: () => void;
  onOverwriteSelectedTemplate?: () => void;
  onDeleteSelectedTemplate?: () => void;
  onRefreshTemplates?: () => void;
}

interface ReportingSchedulePanelProps {
  collapsed?: boolean;
  onToggleCollapsed: () => void;
  nextScheduleRun?: NextScheduleRun | null;
  scheduleAggregateStatus?: ScheduleAggregateStatus | null;
  scheduleDraft: ScheduleDraft;
  editingScheduleId?: string;
  onSubmit: (e: React.FormEvent) => void;
  onFieldChange: (field: string, value: unknown) => void;
  onToggleFormat: (format: string) => void;
  onToggleDeliveryChannel: (channel: string) => void;
  onReset: () => void;
  onEdit: (schedule: ScheduleRecord) => void;
  onDelete: (schedule: ScheduleRecord) => void;
  schedules: ScheduleRecord[];
}

const SHELL_META_PILL_CLASS_NAME =
  "rounded-full border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--ds-text-secondary)]";

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Thứ hai" },
  { value: 2, label: "Thứ ba" },
  { value: 3, label: "Thứ tư" },
  { value: 4, label: "Thứ năm" },
  { value: 5, label: "Thứ sáu" },
  { value: 6, label: "Thứ bảy" },
  { value: 7, label: "Chủ nhật" },
];

const SCHEDULE_FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Hàng tuần" },
  { value: "monthly", label: "Hàng tháng" },
];

const SCHEDULE_FORMAT_OPTIONS = [
  { value: "excel", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

const DELIVERY_CHANNEL_OPTIONS = [
  {
    value: "email",
    label: "Email",
    description: "Gửi file Excel/PDF tới danh sách nhận.",
  },
  {
    value: "report_center",
    label: "Trung tâm báo cáo",
    description: "Giữ bản báo cáo trong report center để mở trực tiếp.",
  },
  {
    value: "download_bundle",
    label: "Gói tải xuống",
    description: "Chuẩn bị gói file để trợ lý vận hành tải thủ công.",
  },
];

function formatScheduleNextRunLabel(isoString) {
  if (!isoString) {
    return "Chưa lên lịch";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Chưa lên lịch";
  }

  return date.toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeScheduleFrequency(schedule) {
  if (!schedule) {
    return "";
  }

  const timeLabel = schedule.time || "08:00";
  if (schedule.frequency === "weekly") {
    const dayOption = WEEKDAY_OPTIONS.find((item) => item.value === Number(schedule.dayOfWeek));
    const dayLabel = dayOption ? dayOption.label : "tuần";
    return `Mỗi ${dayLabel.toLowerCase()} lúc ${timeLabel}`;
  }

  if (schedule.frequency === "monthly") {
    const day = Number.isFinite(Number(schedule.dayOfMonth)) ? Number(schedule.dayOfMonth) : 1;
    return `Ngày ${day} hàng tháng lúc ${timeLabel}`;
  }

  return "";
}

function describeScheduleFormats(formats) {
  const normalized = Array.isArray(formats) && formats.length ? formats : ["excel"];

  return normalized
    .map((format) => {
      const option = SCHEDULE_FORMAT_OPTIONS.find((item) => item.value === format);
      return option ? option.label : String(format || "").toUpperCase();
    })
    .join(" + ");
}

function describeScheduleRecipients(recipientsInput) {
  const recipients = String(recipientsInput || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!recipients.length) {
    return "Chưa thêm email nhận";
  }

  if (recipients.length === 1) {
    return recipients[0];
  }

  const visibleRecipients = recipients.slice(0, 2).join(", ");
  const extraCount = recipients.length - 2;

  return extraCount > 0
    ? `${recipients.length} email • ${visibleRecipients} +${extraCount}`
    : `${recipients.length} email • ${visibleRecipients}`;
}

function describeScheduleChannels(channels) {
  const normalized = Array.isArray(channels) ? channels.filter(Boolean) : [];

  if (!normalized.length) {
    return "Chưa chọn kênh giao";
  }

  return normalized
    .map((channel) => {
      const option = DELIVERY_CHANNEL_OPTIONS.find((item) => item.value === channel);
      return option ? option.label : String(channel || "");
    })
    .join(" + ");
}

function describeScheduleDataSource(scheduleAggregateStatus) {
  if (!scheduleAggregateStatus?.available) {
    return "Read model tháng mặc định chưa sẵn sàng";
  }

  const rangeFrom = scheduleAggregateStatus?.range?.from;
  const rangeTo = scheduleAggregateStatus?.range?.to;

  if (rangeFrom && rangeTo) {
    return `Read model tháng mặc định ${rangeFrom} → ${rangeTo}`;
  }

  return "Read model tháng mặc định sẵn sàng";
}

function scheduleUsesEmailChannel(scheduleLike) {
  return Array.isArray(scheduleLike?.deliveryChannels)
    ? scheduleLike.deliveryChannels.includes("email")
    : true;
}

function resolveScheduleDeliveryState(schedule, scheduleAggregateStatus) {
  const deliveryStatus = String(schedule?.deliveryStatus || "").trim().toLowerCase();
  const lastDeliveryError = String(schedule?.lastDeliveryError || "").trim();

  if (deliveryStatus === "success") {
    return {
      toneClassName: "bg-emerald-500/10 text-emerald-700",
      label: "Đã giao thành công",
      detail: schedule?.lastDeliveryAt
        ? `Lần giao gần nhất ${formatScheduleNextRunLabel(schedule.lastDeliveryAt)}`
        : "Lịch đã có bản ghi giao thành công gần nhất.",
    };
  }

  if (deliveryStatus === "error") {
    return {
      toneClassName: "bg-rose-500/10 text-rose-700",
      label: "Lỗi giao gần nhất",
      detail: lastDeliveryError || "Chưa có chi tiết lỗi từ runtime giao báo cáo.",
    };
  }

  if (!schedule?.active) {
    return {
      toneClassName: "bg-slate-500/10 text-slate-600",
      label: "Tạm dừng theo lịch",
      detail: "Lịch đang tắt nên chưa phát hành thêm đợt giao nào.",
    };
  }

  if (!scheduleAggregateStatus?.available) {
    return {
      toneClassName: "bg-amber-500/10 text-amber-700",
      label: "Chờ nguồn dữ liệu",
      detail: "Read model tháng mặc định chưa sẵn sàng nên chưa thể phát hành báo cáo tự động.",
    };
  }

  return {
    toneClassName: "bg-sky-500/10 text-sky-700",
    label: "Sẵn sàng giao",
    detail: "Kênh giao đã cấu hình đủ điều kiện cho lần chạy kế tiếp.",
  };
}

function clampScheduleDayOfMonth(year, monthIndex, requestedDay) {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  const normalizedDay = Number.isFinite(Number(requestedDay)) ? Number(requestedDay) : 1;

  return Math.min(Math.max(normalizedDay, 1), maxDay);
}

function estimateScheduleNextRun(scheduleDraft, now = new Date()) {
  if (!scheduleDraft) {
    return null;
  }

  const reference = now instanceof Date && !Number.isNaN(now.getTime()) ? new Date(now) : new Date();
  const [rawHour = "08", rawMinute = "00"] = String(scheduleDraft.time || "08:00").split(":");
  const hours = Number.isFinite(Number(rawHour)) ? Number(rawHour) : 8;
  const minutes = Number.isFinite(Number(rawMinute)) ? Number(rawMinute) : 0;

  if (scheduleDraft.frequency === "monthly") {
    const requestedDay = Number.isFinite(Number(scheduleDraft.dayOfMonth))
      ? Number(scheduleDraft.dayOfMonth)
      : 1;

    const candidate = new Date(reference);
    candidate.setHours(hours, minutes, 0, 0);
    candidate.setDate(clampScheduleDayOfMonth(candidate.getFullYear(), candidate.getMonth(), requestedDay));

    if (candidate <= reference) {
      const nextMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 1, hours, minutes, 0, 0);
      nextMonth.setDate(
        clampScheduleDayOfMonth(nextMonth.getFullYear(), nextMonth.getMonth(), requestedDay)
      );
      return nextMonth;
    }

    return candidate;
  }

  const normalizedDayOfWeek = Number.isFinite(Number(scheduleDraft.dayOfWeek))
    ? Number(scheduleDraft.dayOfWeek)
    : 1;
  const targetDay = normalizedDayOfWeek === 7 ? 0 : Math.min(Math.max(normalizedDayOfWeek, 1), 6);
  const candidate = new Date(reference);
  candidate.setHours(hours, minutes, 0, 0);

  const offset = (targetDay - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + offset);

  if (candidate <= reference) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate;
}

function ReportControlsMeta({ summaryDeclsText, selectedRuleName }: ReportControlsMetaProps) {
  return (
    <>
      <span className={SHELL_META_PILL_CLASS_NAME}>{summaryDeclsText}</span>
      <span className={SHELL_META_PILL_CLASS_NAME}>{selectedRuleName || "Chưa có bộ quy tắc KPI"}</span>
    </>
  );
}

function ScheduleShellMeta({ nextScheduleRun, scheduleAggregateStatus }: ScheduleShellMetaProps) {
  return (
    <>
      <span className={SHELL_META_PILL_CLASS_NAME}>
        {nextScheduleRun
          ? `Lịch sắp chạy: ${formatScheduleNextRunLabel(nextScheduleRun.nextRun)}`
          : "Chưa có lịch chạy tự động"}
      </span>
      <span className={SHELL_META_PILL_CLASS_NAME}>
        {scheduleAggregateStatus?.available
          ? "Read model tháng mặc định sẵn sàng"
          : "Read model tháng mặc định chưa sẵn sàng"}
      </span>
    </>
  );
}

function WorkspaceJumpLink({ href, title, detail }: WorkspaceJumpLinkProps) {
  return (
    <a
      href={href}
      className="flex min-h-24 flex-col justify-between rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/45 p-3 transition hover:border-[color:var(--ds-border-strong)] hover:bg-[color:var(--ds-surface-muted)]"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">{title}</p>
        <p className="text-[13px] leading-5 text-[color:var(--ds-text-secondary)]">{detail}</p>
      </div>
      <span className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ds-text-muted)]">
        Đi tới
      </span>
    </a>
  );
}

export const ReportingWorkspaceGuidePanel = React.memo(function ReportingWorkspaceGuidePanel({ canManageSchedule = false }: ReportingWorkspaceGuidePanelProps) {
  return (
    <SectionSurface className="print:hidden" aria-label="Sơ đồ điều hướng report center">
      <SectionHeader
        title="Sơ đồ report center"
        titleAs="h3"
        description="Đi theo thứ tự đọc insight trước, drill-down sau, rồi mới chạm tới lịch gửi hoặc ghi chú phát hành để giảm cognitive load trên mobile."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <WorkspaceJumpLink
          href="#report-viewer-insights"
          title="Dashboard insight"
          detail="Đọc summary, trend, phân bổ tổ đội và top staff trước khi đi sâu từng phạm vi."
        />
        <WorkspaceJumpLink
          href="#report-viewer-explorer"
          title="Drill-down phạm vi"
          detail="Chọn nhân viên hoặc tổ đội, đổi cột hiển thị và xuất đúng lát cắt đang phân tích."
        />
        <WorkspaceJumpLink
          href={canManageSchedule ? "#report-viewer-schedule" : "#report-viewer-notes"}
          title={canManageSchedule ? "Lịch gửi & phát hành" : "Ghi chú phát hành"}
          detail={
            canManageSchedule
              ? "Quản lý lịch gửi sau khi đã đọc xong insight thay vì phải lướt qua form ngay từ đầu."
              : "Xem quy tắc tính điểm, lưu ý export và các điểm kiểm tra cuối trước khi phát hành."
          }
        />
      </div>
    </SectionSurface>
  );
});

export const ReportingControlsPanel = React.memo(function ReportingControlsPanel({
  summaryDeclsText,
  selectedRuleName,
  reloading,
  onReloadData,
  quickRange,
  onQuickRangeChange,
  from,
  to,
  onFromChange,
  onToChange,
  ruleOptions,
  selectedRuleId,
  onRuleChange,
  selectedRuleVersionLabel = "—",
  ruleComparisonLabel = "",
  activeRuleMessage,
  nextScheduleRun,
  reportRange,
  ruleApply,
  scheduleAggregateStatus,
  templates = [],
  selectedTemplateId = "",
  appliedTemplate = null,
  appliedTemplateUpdatedAt = "",
  templateBusy = false,
  templateSaving = false,
  onSelectTemplate,
  onApplySelectedTemplate,
  onSaveTemplateAsNew,
  onOverwriteSelectedTemplate,
  onDeleteSelectedTemplate,
  onRefreshTemplates,
}: ReportingControlsPanelProps) {
  return (
    <SectionSurface className="print:hidden" aria-label="Điều khiển báo cáo KPI">
      <SectionHeader
        title="Điều khiển báo cáo KPI"
        titleAs="h3"
        description="Chọn khoảng thời gian, bộ quy tắc và trạng thái read model trước khi xem dashboard KPI."
        meta={<ReportControlsMeta summaryDeclsText={summaryDeclsText} selectedRuleName={selectedRuleName} />}
        actions={
          <button
            type="button"
            onClick={onReloadData}
            disabled={reloading}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reloading ? "Đang tải..." : "Tải lại dữ liệu"}
          </button>
        }
      />

      <ReportingTemplateControls
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        appliedTemplate={appliedTemplate}
        appliedTemplateUpdatedAt={appliedTemplateUpdatedAt}
        templateBusy={templateBusy}
        templateSaving={templateSaving}
        onSelectTemplate={onSelectTemplate}
        onApplySelectedTemplate={onApplySelectedTemplate}
        onSaveTemplateAsNew={onSaveTemplateAsNew}
        onOverwriteSelectedTemplate={onOverwriteSelectedTemplate}
        onDeleteSelectedTemplate={onDeleteSelectedTemplate}
        onRefreshTemplates={onRefreshTemplates}
      />

      <SectionToolbar mainClassName="items-end">
        <div className="flex min-w-[11rem] flex-1 flex-col">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Khoảng thời gian</label>
          <select
            className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
            value={quickRange}
            onChange={(event) => onQuickRangeChange(event.target.value)}
          >
            {QUICK_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[11rem] flex-1 flex-col">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Từ ngày</label>
          <input
            type="date"
            className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </div>

        <div className="flex min-w-[11rem] flex-1 flex-col">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Đến ngày</label>
          <input
            type="date"
            className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
          />
        </div>
      </SectionToolbar>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-2 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3">
          <label
            htmlFor="report-rule-select"
            className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
          >
            Bộ quy tắc KPI
          </label>
          <select
            id="report-rule-select"
            value={selectedRuleId}
            onChange={(event) => onRuleChange(event.target.value)}
            className="w-full rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
          >
            {ruleOptions.length ? (
              ruleOptions.map((option) => (
                <option key={option.value || "__default"} value={option.value}>
                  {option.label}
                </option>
              ))
            ) : (
              <option value="">Chưa có bộ quy tắc</option>
            )}
          </select>
          <div className="text-xs text-[color:var(--ds-text-secondary)]">Phiên bản: {selectedRuleVersionLabel}</div>
          {ruleComparisonLabel ? (
            <div className="rounded-lg border border-dashed border-emerald-400 bg-emerald-500/10 p-2 text-xs text-emerald-700">
              Chênh lệch so với bộ đang áp dụng: {ruleComparisonLabel}
            </div>
          ) : (
            <div className="text-xs text-[color:var(--ds-text-secondary)]">{activeRuleMessage}</div>
          )}
        </div>

        <div className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3 text-sm text-[color:var(--ds-text-secondary)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase text-[color:var(--ds-text-muted)]">Thông tin báo cáo</span>
            {nextScheduleRun ? (
              <span className="text-xs font-medium text-emerald-600">
                Lịch gửi tiếp theo: {formatScheduleNextRunLabel(nextScheduleRun.nextRun)}
              </span>
            ) : (
              <span className="text-xs text-[color:var(--ds-text-muted)]">Chưa thiết lập lịch gửi</span>
            )}
          </div>

          <div className="mt-2 text-base font-semibold text-[color:var(--ds-text-primary)]">{summaryDeclsText}</div>
          <div className="mt-1 text-xs text-[color:var(--ds-text-secondary)]">
            Khoảng: {reportRange?.from || "…"} → {reportRange?.to || "…"}
          </div>
          <div className="mt-1 text-xs text-[color:var(--ds-text-secondary)]">{ruleApply}</div>
          <div className="mt-1 text-xs text-[color:var(--ds-text-secondary)]">
            {scheduleAggregateStatus?.available
              ? `Tổng hợp tháng mặc định: ${scheduleAggregateStatus?.range?.from || "…"} → ${
                  scheduleAggregateStatus?.range?.to || "…"
                }`
              : "Tổng hợp tháng mặc định: chưa sẵn sàng"}
          </div>
          {scheduleAggregateStatus?.available && scheduleAggregateStatus?.generatedAt ? (
            <div className="mt-1 text-xs text-[color:var(--ds-text-muted)]">
              Cập nhật read model: {formatScheduleNextRunLabel(scheduleAggregateStatus.generatedAt)}
            </div>
          ) : null}
        </div>
      </div>
    </SectionSurface>
  );
});

export const ReportingSchedulePanel = React.memo(function ReportingSchedulePanel({
  collapsed,
  onToggleCollapsed,
  nextScheduleRun,
  scheduleAggregateStatus,
  scheduleDraft,
  editingScheduleId,
  onSubmit,
  onFieldChange,
  onToggleFormat,
  onToggleDeliveryChannel,
  onReset,
  onEdit,
  onDelete,
  schedules,
}: ReportingSchedulePanelProps) {
  const draftNextRun = estimateScheduleNextRun(scheduleDraft);
  const previewCadence = describeScheduleFrequency(scheduleDraft) || "Chưa chọn chu kỳ gửi";
  const previewFormats = describeScheduleFormats(scheduleDraft?.formats);
  const previewRecipients = scheduleUsesEmailChannel(scheduleDraft)
    ? describeScheduleRecipients(scheduleDraft?.recipientsInput)
    : "Không dùng email";
  const previewChannels = describeScheduleChannels(scheduleDraft?.deliveryChannels);
  const previewDataSource = describeScheduleDataSource(scheduleAggregateStatus);
  const previewNextRunLabel = draftNextRun
    ? formatScheduleNextRunLabel(draftNextRun.toISOString())
    : nextScheduleRun?.nextRun
      ? formatScheduleNextRunLabel(nextScheduleRun.nextRun)
      : "Chưa lên lịch";

  return (
    <SectionSurface className="print:hidden" aria-label="Lập lịch gửi báo cáo KPI">
      <SectionHeader
        title="Lập lịch gửi báo cáo KPI"
        titleAs="h3"
        description="Thiết lập lịch phát hành Excel/PDF theo tuần hoặc tháng qua email, report center hoặc gói tải xuống cho vận hành."
        meta={<ScheduleShellMeta nextScheduleRun={nextScheduleRun} scheduleAggregateStatus={scheduleAggregateStatus} />}
        actions={
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-controls="report-schedule-panel"
            aria-expanded={!collapsed}
            className="inline-flex items-center gap-1 rounded border border-[color:var(--ds-border-subtle)] px-2 py-1 font-semibold text-[color:var(--ds-text-secondary)] transition-colors hover:border-[color:var(--ds-border-strong)] hover:text-[color:var(--ds-text-primary)]"
          >
            {collapsed ? "Mở rộng" : "Thu gọn"}
          </button>
        }
      />

      {!collapsed ? (
        <div id="report-schedule-panel" className="space-y-4">
          <form
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={onSubmit}
            aria-label="Biểu mẫu lịch gửi báo cáo KPI"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-name">
                Tên lịch gửi
              </label>
              <input
                id="schedule-name"
                type="text"
                value={scheduleDraft.name}
                onChange={(event) => onFieldChange("name", event.target.value)}
                placeholder="Báo cáo KPI tuần"
                className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-recipients">
                Email nhận (khi bật kênh email)
              </label>
              <textarea
                id="schedule-recipients"
                rows={2}
                value={scheduleDraft.recipientsInput}
                onChange={(event) => onFieldChange("recipientsInput", event.target.value)}
                placeholder="ceo@company.vn, kpi@company.vn"
                className="min-h-[60px] rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
              />
              <span className="text-[11px] text-[color:var(--ds-text-muted)]">
                Có thể bỏ trống nếu chỉ dùng report center hoặc gói tải xuống.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-frequency">
                Chu kỳ gửi
              </label>
              <select
                id="schedule-frequency"
                value={scheduleDraft.frequency ?? ''}
                onChange={(event) => onFieldChange("frequency", event.target.value)}
                className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
              >
                {SCHEDULE_FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {scheduleDraft.frequency === "weekly" ? (
                <select
                  value={scheduleDraft.dayOfWeek ?? ''}
                  onChange={(event) => onFieldChange("dayOfWeek", Number(event.target.value))}
                  className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                >
                  {WEEKDAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={scheduleDraft.dayOfMonth ?? ''}
                    onChange={(event) => onFieldChange("dayOfMonth", Number(event.target.value))}
                    className="w-20 rounded border border-[color:var(--ds-border-subtle)] bg-white px-2 py-2 text-sm text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                  />
                  <span className="text-xs text-[color:var(--ds-text-secondary)]">Ngày trong tháng</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-time">
                Thời gian gửi
              </label>
              <input
                id="schedule-time"
                type="time"
                value={scheduleDraft.time ?? ''}
                onChange={(event) => onFieldChange("time", event.target.value)}
                className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[color:var(--ds-text-secondary)]">
                {SCHEDULE_FORMAT_OPTIONS.map((option) => {
                  const checked = Array.isArray(scheduleDraft.formats)
                    ? scheduleDraft.formats.includes(option.value)
                    : option.value === "excel";

                  return (
                    <label key={option.value} className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleFormat(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
              <label className="mt-1 inline-flex items-center gap-2 text-xs text-[color:var(--ds-text-secondary)]">
                <input
                  type="checkbox"
                  checked={Boolean(scheduleDraft.active)}
                  onChange={(event) => onFieldChange("active", event.target.checked)}
                />
                Kích hoạt lịch gửi này
              </label>
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <div className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ds-text-muted)]">
                    Kênh giao báo cáo
                  </p>
                  <p className="text-xs text-[color:var(--ds-text-secondary)]">
                    Có thể bật nhiều kênh cùng lúc để vừa phát hành nội bộ, vừa giữ bản báo cáo trong workspace.
                  </p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {DELIVERY_CHANNEL_OPTIONS.map((option) => {
                    const checked = Array.isArray(scheduleDraft.deliveryChannels)
                      ? scheduleDraft.deliveryChannels.includes(option.value)
                      : option.value === "email";

                    return (
                      <label
                        key={option.value}
                        className="flex min-h-[92px] cursor-pointer flex-col gap-2 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/40 p-3"
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--ds-text-primary)]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleDeliveryChannel(option.value)}
                          />
                          <span>{option.label}</span>
                        </span>
                        <span className="text-xs leading-5 text-[color:var(--ds-text-secondary)]">
                          {option.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <div className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ds-text-muted)]">
                      Xem trước lần gửi kế tiếp
                    </p>
                    <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                      {scheduleDraft.name || "Báo cáo KPI tự động"}
                    </h4>
                    <p className="text-xs text-[color:var(--ds-text-secondary)]">{previewCadence}</p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      scheduleDraft.active
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-700"
                    }`}
                  >
                    {scheduleDraft.active ? "Lịch đang bật" : "Lịch đang tạm tắt"}
                  </span>
                </div>

                <dl className="mt-3 grid gap-3 text-xs text-[color:var(--ds-text-secondary)] md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-1">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-[color:var(--ds-text-muted)]">
                      Lần chạy dự kiến
                    </dt>
                    <dd>{previewNextRunLabel}</dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-[color:var(--ds-text-muted)]">
                      Tệp sẽ gửi
                    </dt>
                    <dd>{previewFormats}</dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-[color:var(--ds-text-muted)]">
                      Người nhận
                    </dt>
                    <dd>{previewRecipients}</dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-[color:var(--ds-text-muted)]">
                      Kênh giao
                    </dt>
                    <dd>{previewChannels}</dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-[color:var(--ds-text-muted)]">
                      Nguồn dữ liệu
                    </dt>
                    <dd>{previewDataSource}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-end gap-2 pt-2">
              {editingScheduleId ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-2 text-sm font-semibold text-[color:var(--ds-text-secondary)] transition-colors hover:border-[color:var(--ds-border-strong)]"
                >
                  Huỷ chỉnh sửa
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded bg-[color:var(--ds-accent)] px-3 py-2 text-sm font-semibold text-[color:var(--ds-text-inverse)] shadow-sm transition-colors hover:bg-[color:var(--ds-accent-strong)]"
              >
                {editingScheduleId ? "Cập nhật lịch gửi" : "Thêm lịch gửi"}
              </button>
            </div>
          </form>

          <div className="border-t border-[color:var(--ds-border-subtle)] pt-4">
            {schedules.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Danh sách lịch gửi báo cáo KPI">
                {schedules.map((schedule) => {
                  const deliveryState = resolveScheduleDeliveryState(schedule, scheduleAggregateStatus);

                  return (
                    <div
                      key={schedule.id}
                      role="listitem"
                      className="rounded-lg border border-[color:var(--ds-border-subtle)] bg-white p-3 text-sm text-[color:var(--ds-text-secondary)] shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                            {schedule.name || "Lịch gửi"}
                          </div>
                          <div className="text-xs text-[color:var(--ds-text-muted)]">
                            {describeScheduleFrequency(schedule)}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            schedule.active
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {schedule.active ? "Đang bật" : "Tạm tắt"}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-[color:var(--ds-text-secondary)]">
                        <div>Lần tiếp theo: {formatScheduleNextRunLabel(schedule.nextRun || "")}</div>
                        <div>Định dạng: {schedule.formatsSummary || "EXCEL"}</div>
                        <div>
                          Email:{" "}
                          {scheduleUsesEmailChannel(schedule) ? schedule.recipientsSummary || "Chưa cấu hình" : "Không dùng email"}
                        </div>
                        <div>Kênh: {describeScheduleChannels(schedule.deliveryChannels)}</div>
                      </div>

                      <div className="mt-3 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/45 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ds-text-muted)]">
                            Trạng thái giao
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${deliveryState.toneClassName}`}>
                            {deliveryState.label}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[color:var(--ds-text-secondary)]">
                          {deliveryState.detail}
                        </p>
                        {schedule.lastDeliveryAt ? (
                          <p className="mt-2 text-[11px] text-[color:var(--ds-text-muted)]">
                            Lần giao gần nhất: {formatScheduleNextRunLabel(schedule.lastDeliveryAt)}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(schedule)}
                          className="rounded border border-[color:var(--ds-border-subtle)] px-2 py-1 text-xs font-semibold text-[color:var(--ds-text-secondary)] transition-colors hover:border-[color:var(--ds-border-strong)]"
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(schedule)}
                          className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:border-rose-400 hover:text-rose-700"
                        >
                          Xoá
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--ds-text-muted)]">
                Chưa có lịch gửi báo cáo. Hãy thêm mới để tự động gửi KPI cho lãnh đạo.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </SectionSurface>
  );
});
