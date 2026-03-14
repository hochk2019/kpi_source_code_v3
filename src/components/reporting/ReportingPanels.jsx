import React from "react";

import { QUICK_RANGE_OPTIONS } from "@/lib/reports.js";
import {
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.jsx";

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

export function createScheduleDraft(entry = null) {
  const raw = entry && typeof entry === "object" ? entry : {};
  const formats = Array.isArray(raw.formats) && raw.formats.length ? raw.formats : ["excel"];
  const recipients = Array.isArray(raw.recipients)
    ? raw.recipients.join(", ")
    : typeof raw.recipientsInput === "string"
      ? raw.recipientsInput
      : "";

  return {
    id: raw.id || "",
    name: raw.name || "",
    frequency: raw.frequency || "weekly",
    dayOfWeek: Number.isFinite(Number(raw.dayOfWeek)) ? Number(raw.dayOfWeek) : 1,
    dayOfMonth: Number.isFinite(Number(raw.dayOfMonth)) ? Number(raw.dayOfMonth) : 1,
    time: raw.time || "08:00",
    recipientsInput: recipients,
    formats,
    active: raw.active !== false,
  };
}

export function toSchedulePayload(draft) {
  return {
    id: draft.id || undefined,
    name: draft.name,
    frequency: draft.frequency,
    dayOfWeek:
      draft.frequency === "weekly"
        ? Number.isFinite(Number(draft.dayOfWeek))
          ? Number(draft.dayOfWeek)
          : 1
        : null,
    dayOfMonth:
      draft.frequency === "monthly"
        ? Number.isFinite(Number(draft.dayOfMonth))
          ? Number(draft.dayOfMonth)
          : 1
        : null,
    time: draft.time || "08:00",
    recipients: draft.recipientsInput || "",
    formats: Array.isArray(draft.formats) && draft.formats.length ? draft.formats : ["excel"],
    active: Boolean(draft.active),
  };
}

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

function ReportControlsMeta({ summaryDeclsText, selectedRuleName }) {
  return (
    <>
      <span className={SHELL_META_PILL_CLASS_NAME}>{summaryDeclsText}</span>
      <span className={SHELL_META_PILL_CLASS_NAME}>{selectedRuleName || "Chưa có bộ quy tắc KPI"}</span>
    </>
  );
}

function ScheduleShellMeta({ nextScheduleRun, scheduleAggregateStatus }) {
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

export function ReportingControlsPanel({
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
}) {
  return (
    <SectionSurface className="print:hidden" aria-label="Điều khiển báo cáo KPI">
      <SectionHeader
        title="Điều khiển báo cáo KPI"
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

      <SectionToolbar mainClassName="items-end">
        <div className="flex flex-col">
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

        <div className="flex flex-col">
          <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Từ ngày</label>
          <input
            type="date"
            className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </div>

        <div className="flex flex-col">
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
}

export function ReportingSchedulePanel({
  collapsed,
  onToggleCollapsed,
  nextScheduleRun,
  scheduleAggregateStatus,
  scheduleDraft,
  editingScheduleId,
  onSubmit,
  onFieldChange,
  onToggleFormat,
  onReset,
  onEdit,
  onDelete,
  schedules,
}) {
  return (
    <SectionSurface className="print:hidden" aria-label="Lập lịch gửi báo cáo KPI">
      <SectionHeader
        title="Lập lịch gửi báo cáo KPI"
        titleAs="h3"
        description="Thiết lập gửi tự động file Excel/PDF theo tuần hoặc tháng tới danh sách email mong muốn."
        meta={<ScheduleShellMeta nextScheduleRun={nextScheduleRun} scheduleAggregateStatus={scheduleAggregateStatus} />}
        actions={
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-controls="report-schedule-panel"
            aria-expanded={String(!collapsed)}
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
                Email nhận (phân tách bằng dấu phẩy)
              </label>
              <textarea
                id="schedule-recipients"
                rows={2}
                value={scheduleDraft.recipientsInput}
                onChange={(event) => onFieldChange("recipientsInput", event.target.value)}
                placeholder="ceo@company.vn, kpi@company.vn"
                className="min-h-[60px] rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-frequency">
                Chu kỳ gửi
              </label>
              <select
                id="schedule-frequency"
                value={scheduleDraft.frequency}
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
                  value={scheduleDraft.dayOfWeek}
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
                    value={scheduleDraft.dayOfMonth}
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
                value={scheduleDraft.time}
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
                {schedules.map((schedule) => (
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

                    <div className="mt-2 text-xs text-[color:var(--ds-text-secondary)]">
                      <div>Lần tiếp theo: {formatScheduleNextRunLabel(schedule.nextRun || "")}</div>
                      <div>Định dạng: {schedule.formatsSummary || "EXCEL"}</div>
                      <div>Email: {schedule.recipientsSummary || "—"}</div>
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
                ))}
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
}
