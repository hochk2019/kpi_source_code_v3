import React, { useEffect, useMemo, useState } from "react";
import {
  getKpiAdjustments,
  saveKpiAdjustment,
  updateKpiAdjustmentStatus,
  removeKpiAdjustment,
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  KPI_ADJUSTMENT_STATUS_SET,
  KPI_ADJUSTMENTS_KEY,
  getTeamRoster,
  getDeclRows,
  sortDeclRows,
  normalizeStr,
} from "@/lib/store.js";
import { subscribe as subscribeStorage } from "@/lib/storageClient.js";

const STATUS_LABELS = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
};

function formatInt(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("vi-VN") : "0";
}

function formatDecimal(value) {
  const num = Number(value || 0);
  return Number.isFinite(num)
    ? num.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "0,0";
}

function getCurrentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseReferences(text) {
  if (!text) return [];
  const raw = text
    .split(/[\n,;]+/)
    .map((item) => normalizeStr(item))
    .filter(Boolean);
  return Array.from(new Set(raw));
}

function buildStaffOptions(roster) {
  const options = [];
  if (!roster || !Array.isArray(roster.teams)) {
    return options;
  }
  for (const team of roster.teams) {
    if (!team?.name || !Array.isArray(team.members)) continue;
    for (const member of team.members) {
      const name = normalizeStr(member?.name);
      if (!name) continue;
      options.push({
        team: team.name,
        name,
      });
    }
  }
  return options;
}

function buildTeamOptions(roster) {
  if (!roster || !Array.isArray(roster.teams)) {
    return [];
  }
  return roster.teams
    .map((team) => normalizeStr(team?.name))
    .filter(Boolean);
}

function resolveCategoryOptions() {
  return Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG).map(([key, config]) => ({
    value: key,
    label: config.label,
    type: config.type,
  }));
}

const CATEGORY_OPTIONS = resolveCategoryOptions();

function resolveCategoryDefaults(category) {
  const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category] || {};
  if (config.type === "grade") {
    const defaultGrade = config.grades?.find((item) => item.value === 0) || config.grades?.[0];
    return {
      quantity: 1,
      unitPoints: defaultGrade ? defaultGrade.value : 0,
      gradeValue: defaultGrade ? defaultGrade.value : 0,
    };
  }
  if (config.type === "fixed") {
    return {
      quantity: 1,
      unitPoints: Number.isFinite(config.defaultUnit) ? config.defaultUnit : 0,
      gradeValue: null,
    };
  }
  return {
    quantity: 1,
    unitPoints: Number.isFinite(config.defaultUnit) ? config.defaultUnit : 0,
    gradeValue: null,
  };
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("vi-VN", { hour12: false });
  } catch (err) {
    console.warn("Khong the dinh dang thoi gian dieu chinh KPI", value, err);
    return value;
  }
}

const initialFormState = (month = getCurrentMonth()) => {
  const defaults = resolveCategoryDefaults("support_fixed");
  return {
    id: null,
    category: "support_fixed",
    month,
    staffName: "",
    teamName: "",
    quantity: defaults.quantity,
    unitPoints: defaults.unitPoints,
    gradeValue: defaults.gradeValue,
    note: "",
    referencesInput: "",
    status: "pending",
    history: [],
  };
};

export default function KPIAdjustments({ currentUser }) {
  const [adjustments, setAdjustments] = useState(() => getKpiAdjustments());
  const [roster, setRoster] = useState(() => getTeamRoster());
  const [recentDeclarations, setRecentDeclarations] = useState(() => {
    const rows = sortDeclRows(getDeclRows());
    return rows.slice(-20).reverse();
  });
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState(() => initialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState("");
  const canSubmit = currentUser?.permissions?.adjustSubmit !== false;
  const canApprove = !!currentUser?.permissions?.adjustApprove;
  const actor = currentUser?.username || currentUser?.name || "ui";

  useEffect(() => {
    const unsubscribe = subscribeStorage(KPI_ADJUSTMENTS_KEY, () => {
      setAdjustments(getKpiAdjustments());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setRoster(getTeamRoster());
  }, [currentUser]);

  const staffOptions = useMemo(() => buildStaffOptions(roster), [roster]);
  const teamOptions = useMemo(() => buildTeamOptions(roster), [roster]);
  const normalizedTeamFilter = normalizeStr(form.teamName);
  const filteredStaffOptions = useMemo(() => {
    if (!normalizedTeamFilter) {
      return staffOptions;
    }
    return staffOptions.filter((option) => normalizeStr(option.team) === normalizedTeamFilter);
  }, [normalizedTeamFilter, staffOptions]);

  const stats = useMemo(() => {
    const base = { total: 0, approved: 0, pending: 0, rejected: 0, totalPoints: 0 };
    for (const item of adjustments) {
      if (!item) continue;
      base.total += 1;
      if (item.status === "approved") {
        base.approved += 1;
        base.totalPoints += Number(item.totalPoints || 0);
      } else if (item.status === "pending") {
        base.pending += 1;
      } else if (item.status === "rejected") {
        base.rejected += 1;
      }
    }
    return base;
  }, [adjustments]);

  const filteredAdjustments = useMemo(() => {
    return adjustments
      .filter((item) => {
        if (!item) return false;
        if (filterMonth && filterMonth !== "all" && item.month !== filterMonth) {
          return false;
        }
        if (filterStatus !== "all" && item.status !== filterStatus) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const timeB = new Date(a.updatedAt || a.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (b.month || "").localeCompare(a.month || "");
      });
  }, [adjustments, filterMonth, filterStatus]);

  const handleRefreshDeclarations = () => {
    const rows = sortDeclRows(getDeclRows());
    setRecentDeclarations(rows.slice(-20).reverse());
  };

  const handleCategoryChange = (value) => {
    const defaults = resolveCategoryDefaults(value);
    setForm((prev) => ({
      ...prev,
      category: value,
      quantity: defaults.quantity,
      unitPoints: defaults.unitPoints,
      gradeValue: defaults.gradeValue,
    }));
  };

  const handleEdit = (entry) => {
    if (!entry) return;
    const defaults = resolveCategoryDefaults(entry.category);
    setForm({
      id: entry.id,
      category: entry.category,
      month: entry.month || getCurrentMonth(),
      staffName: entry.staffName || "",
      teamName: entry.teamName || "",
      quantity: entry.quantity ?? defaults.quantity,
      unitPoints: entry.unitPoints ?? defaults.unitPoints,
      gradeValue: entry.unitPoints ?? defaults.gradeValue,
      note: entry.note || "",
      referencesInput: Array.isArray(entry.references) ? entry.references.join("\n") : "",
      status: entry.status || "pending",
      history: Array.isArray(entry.history) ? entry.history : [],
    });
    setIsEditing(true);
    setFormError("");
  };

  const resetForm = () => {
    setForm(initialFormState(filterMonth && filterMonth !== "all" ? filterMonth : getCurrentMonth()));
    setIsEditing(false);
    setFormError("");
  };

  const handleDelete = async (entry) => {
    if (!entry) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa mục điểm KPI bổ sung này?")) {
      return;
    }
    try {
      const ok = removeKpiAdjustment(entry.id, {
        actor,
        permissions: currentUser?.permissions || {},
      });
      if (ok) {
        setAdjustments(getKpiAdjustments());
      }
    } catch (err) {
      console.error(err);
      window.alert("Không thể xóa mục điểm KPI bổ sung. Vui lòng thử lại.");
    }
  };

  const handleStatusChange = async (entry, status) => {
    if (!entry) return;
    if (!canApprove) {
      window.alert("Bạn không có quyền duyệt điểm KPI bổ sung.");
      return;
    }
    let note = "";
    if (status === "rejected") {
      note = window.prompt("Nhập lý do từ chối (tuỳ chọn)", "") || "";
    }
    try {
      updateKpiAdjustmentStatus(entry.id, status, {
        actor,
        note,
        permissions: currentUser?.permissions || {},
      });
      setAdjustments(getKpiAdjustments());
    } catch (err) {
      console.error(err);
      window.alert("Không thể cập nhật trạng thái. Vui lòng thử lại.");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setFormError("Tài khoản hiện không có quyền tạo điểm KPI bổ sung.");
      return;
    }
    if (!form.staffName) {
      setFormError("Vui lòng nhập tên nhân viên.");
      return;
    }
    if (!form.month) {
      setFormError("Vui lòng chọn tháng áp dụng.");
      return;
    }

    const categoryConfig = KPI_ADJUSTMENT_CATEGORY_CONFIG[form.category] || {};
    const references = parseReferences(form.referencesInput);
    const payload = {
      id: form.id || undefined,
      category: form.category,
      month: form.month,
      staffName: form.staffName,
      teamName: form.teamName,
      references,
      note: form.note,
      status: canApprove && form.id ? form.status : "pending",
    };
    if (categoryConfig.type === "grade") {
      payload.quantity = 1;
      payload.unitPoints = Number(form.gradeValue ?? form.unitPoints ?? 0);
    } else {
      payload.quantity = Number(form.quantity || 0) || 0;
      payload.unitPoints = Number(form.unitPoints || 0) || 0;
    }

    try {
      saveKpiAdjustment(payload, {
        actor,
        permissions: currentUser?.permissions || {},
      });
      setAdjustments(getKpiAdjustments());
      resetForm();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Không thể lưu điểm KPI bổ sung.");
    }
  };

  const formCategoryConfig = KPI_ADJUSTMENT_CATEGORY_CONFIG[form.category] || {};
  const historyEntries = Array.isArray(form.history) ? form.history.slice().reverse() : [];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[color:var(--ds-text-primary)]">Tổng quan điểm KPI +/-</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-3 text-sm">
            <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Tổng số mục</div>
            <div className="text-2xl font-semibold text-[color:var(--ds-text-primary)]">{formatInt(stats.total)}</div>
          </div>
          <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-3 text-sm">
            <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Đã duyệt</div>
            <div className="text-2xl font-semibold text-emerald-600">{formatInt(stats.approved)}</div>
          </div>
          <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-3 text-sm">
            <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Chờ duyệt</div>
            <div className="text-2xl font-semibold text-amber-600">{formatInt(stats.pending)}</div>
          </div>
          <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-3 text-sm">
            <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Điểm đã cộng/trừ</div>
            <div className="text-2xl font-semibold text-blue-600">{formatDecimal(stats.totalPoints)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--ds-text-secondary)]">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Tháng áp dụng</label>
              <input
                type="month"
                className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                value={form.month}
                onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Nhân viên</label>
              <input
                list="kpi-adjust-staff-options"
                className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                placeholder="Nhập tên nhân viên"
                value={form.staffName}
                onChange={(e) => {
                  const nextName = e.target.value;
                  const normalizedName = normalizeStr(nextName);
                  const matched = staffOptions.find((option) => normalizeStr(option.name) === normalizedName);
                  setForm((prev) => ({
                    ...prev,
                    staffName: nextName,
                    teamName:
                      matched && matched.team
                        ? matched.team
                        : prev.teamName,
                  }));
                }}
                required
              />
              <datalist id="kpi-adjust-staff-options">
                {filteredStaffOptions.map((option) => (
                  <option key={`${option.team}-${option.name}`} value={option.name}>
                    {option.name} — {option.team}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Tổ đội</label>
              <input
                list="kpi-adjust-team-options"
                className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                placeholder="Ví dụ: Team 1"
                value={form.teamName}
                onChange={(e) => {
                  const nextTeam = e.target.value;
                  setForm((prev) => {
                    const normalized = normalizeStr(nextTeam);
                    if (!normalized) {
                      return { ...prev, teamName: nextTeam };
                    }
                    const currentStaffNormalized = normalizeStr(prev.staffName);
                    if (currentStaffNormalized) {
                      const matched = staffOptions.find(
                        (option) =>
                          normalizeStr(option.name) === currentStaffNormalized &&
                          normalizeStr(option.team) === normalized
                      );
                      if (!matched) {
                        return { ...prev, teamName: nextTeam, staffName: '' };
                      }
                    }
                    return { ...prev, teamName: nextTeam };
                  });
                }}
              />
              <datalist id="kpi-adjust-team-options">
                {teamOptions.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Hạng mục</label>
              <select
                className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                value={form.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {isEditing && canApprove ? (
              <div className="flex flex-col">
                <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Trạng thái</label>
                <select
                  className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {[...KPI_ADJUSTMENT_STATUS_SET].map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <div>
                <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Mô tả / ghi chú</label>
                <textarea
                  className="mt-1 h-20 w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Nhập ghi chú, lý do cộng/trừ điểm..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Tham chiếu tờ khai / quyết định</label>
                <textarea
                  className="mt-1 h-24 w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                  value={form.referencesInput}
                  onChange={(e) => setForm((prev) => ({ ...prev, referencesInput: e.target.value }))}
                  placeholder="Nhập số tờ khai, mỗi dòng một số hoặc ngăn cách bằng dấu phẩy"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--ds-text-muted)]">
                  <span>Gợi ý gần đây:</span>
                  {recentDeclarations.slice(0, 5).map((decl) => (
                    <button
                      type="button"
                      key={`${decl.date}-${decl.so_tk}`}
                      className="rounded border border-[color:var(--ds-border-subtle)] px-2 py-1 text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          referencesInput: parseReferences(`${prev.referencesInput}\n${decl.so_tk}`)
                            .join("\n"),
                        }))
                      }
                    >
                      {decl.so_tk}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded border border-[color:var(--ds-border-subtle)] px-2 py-1 text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
                    onClick={handleRefreshDeclarations}
                  >
                    Làm mới danh sách
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {formCategoryConfig.type === "grade" ? (
                <div>
                  <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Chọn mức đánh giá</label>
                  <div className="mt-2 grid gap-2 text-[color:var(--ds-text-primary)]">
                    {(formCategoryConfig.grades || []).map((grade) => (
                      <label key={grade.value} className="flex cursor-pointer items-center gap-2 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm hover:bg-[color:var(--ds-surface-muted)]">
                        <input
                          type="radio"
                          name="gradeValue"
                          value={grade.value}
                          checked={Number(form.gradeValue) === grade.value}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              gradeValue: Number(e.target.value),
                              unitPoints: Number(e.target.value),
                            }))
                          }
                        />
                        <span>{grade.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Số lượng</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="mt-1 w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                      value={form.quantity}
                      onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Điểm mỗi đơn vị</label>
                    <input
                      type="number"
                      step="0.1"
                      className="mt-1 w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
                      value={form.unitPoints}
                      onChange={(e) => setForm((prev) => ({ ...prev, unitPoints: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-2 text-sm">
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Điểm dự kiến</div>
                <div className="text-lg font-semibold text-[color:var(--ds-text-primary)]">
                  {formCategoryConfig.type === "grade"
                    ? formatDecimal(form.gradeValue ?? form.unitPoints)
                    : formatDecimal((Number(form.quantity || 0) || 0) * (Number(form.unitPoints || 0) || 0))}
                </div>
              </div>
            </div>
          </div>

          {formError ? <div className="rounded border border-red-300 bg-[color:var(--ds-surface-muted)] px-3 py-2 text-sm text-red-600">{formError}</div> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!canSubmit}
            >
              {isEditing ? "Cập nhật điểm" : "Thêm điểm KPI"}
            </button>
            {isEditing ? (
              <button
                type="button"
                className="rounded border border-[color:var(--ds-border-subtle)] px-4 py-2 text-sm text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
                onClick={resetForm}
              >
                Hủy chỉnh sửa
              </button>
            ) : null}
          </div>

          {isEditing && historyEntries.length ? (
            <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3 text-sm">
              <div className="font-semibold text-[color:var(--ds-text-primary)]">Lịch sử cập nhật</div>
              <ul className="mt-2 space-y-1">
                {historyEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3">
                    <span className="text-[color:var(--ds-text-secondary)]">{formatDateTime(entry.ts)}</span>
                    <span className="flex-1 text-[color:var(--ds-text-primary)]">{entry.actor || "system"}</span>
                    <span className="text-[color:var(--ds-text-muted)]">{entry.action || "update"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>
      </div>

      <div className="rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--ds-text-secondary)]">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Lọc theo tháng</label>
            <input
              type="month"
              className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
              value={filterMonth === "all" ? "" : filterMonth}
              onChange={(e) => setFilterMonth(e.target.value || "all")}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Trạng thái</label>
            <select
              className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="approved">Đã duyệt</option>
              <option value="pending">Chờ duyệt</option>
              <option value="rejected">Đã từ chối</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded border border-[color:var(--ds-border-subtle)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-secondary)]">
              <tr className="text-left text-xs uppercase">
                <th className="px-3 py-2">Tháng</th>
                <th className="px-3 py-2">Hạng mục</th>
                <th className="px-3 py-2">Nhân viên</th>
                <th className="px-3 py-2">Tổ đội</th>
                <th className="px-3 py-2 text-right">Điểm</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Cập nhật</th>
                <th className="px-3 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody className="text-[color:var(--ds-text-primary)]">
              {filteredAdjustments.length ? (
                filteredAdjustments.map((item) => {
                  const label = KPI_ADJUSTMENT_CATEGORY_CONFIG[item.category]?.label || item.category;
                  const statusLabel = STATUS_LABELS[item.status] || item.status;
                  return (
                    <tr key={item.id} className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]">
                      <td className="px-3 py-1.5">{item.month || "—"}</td>
                      <td className="px-3 py-1.5">{label}</td>
                      <td className="px-3 py-1.5">{item.staffName || "Chưa gán"}</td>
                      <td className="px-3 py-1.5">{item.teamName || "—"}</td>
                      <td className={`px-3 py-1.5 text-right font-semibold ${item.totalPoints >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatDecimal(item.totalPoints)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            item.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.status === "rejected"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-[color:var(--ds-text-secondary)]">{formatDateTime(item.updatedAt || item.createdAt)}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded border border-[color:var(--ds-border-subtle)] px-2 py-1 text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
                            onClick={() => handleEdit(item)}
                          >
                            Sửa
                          </button>
                          {canApprove ? (
                            <>
                              {item.status !== "approved" ? (
                                <button
                                  type="button"
                                  className="rounded border border-emerald-400 px-2 py-1 text-emerald-500 hover:bg-emerald-500/10"
                                  onClick={() => handleStatusChange(item, "approved")}
                                >
                                  Duyệt
                                </button>
                              ) : null}
                              {item.status !== "rejected" ? (
                                <button
                                  type="button"
                                  className="rounded border border-rose-400 px-2 py-1 text-rose-500 hover:bg-rose-500/10"
                                  onClick={() => handleStatusChange(item, "rejected")}
                                >
                                  Từ chối
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="rounded border border-red-400/60 px-2 py-1 text-rose-500 hover:bg-rose-500/10"
                            onClick={() => handleDelete(item)}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center text-[color:var(--ds-text-muted)]" colSpan={8}>
                    Không có điểm KPI bổ sung nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
