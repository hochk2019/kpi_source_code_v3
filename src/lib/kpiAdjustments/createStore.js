import {
  KPI_ADJUSTMENTS_KEY,
  KPI_ADJUSTMENT_STATUS_SET,
} from "./constants.js";
import {
  safeParse,
  cloneAutoApproveSettings,
  createKpiAdjustmentSettingsStore,
} from "./settings.js";
import {
  clampHistory,
  diffAdjustments,
  normalizeAdjustmentHistoryEntry,
  normalizeAdjustmentInput,
} from "./entries.js";
import { KPI_ADJUSTMENT_CATEGORY_CONFIG } from "../../../shared/kpiAdjustments.js";

export function createKpiAdjustmentStore({
  getItem = () => null,
  setItem = () => {},
  refreshSharedKeys = () => {},
  pushAuditLog = null,
  normalizeStr = (value) => String(value ?? "").trim(),
  normalizeMST = (value) => String(value ?? "").replace(/\D/g, ""),
  roundAdjustmentPoint = (value) => value,
} = {}) {
  const helperBag = { normalizeStr };
  const settingsStore = createKpiAdjustmentSettingsStore({
    getItem,
    setItem,
    refreshSharedKeys,
    pushAuditLog,
    normalizeStr,
    roundAdjustmentPoint,
  });

  const {
    readAdjustmentSettings,
    getKpiAdjustmentSettings,
    saveKpiAdjustmentSettings,
  } = settingsStore;

  function getAllAdjustments() {
    const raw = safeParse(getItem(KPI_ADJUSTMENTS_KEY), []);
    const entries = Array.isArray(raw) ? raw : [];
    return entries
      .map((item) =>
        normalizeAdjustmentInput(item, {
          now: new Date(),
          actor: "system",
          current: item,
          permissions: { adjustOverridePoints: true },
          normalizeStr,
          normalizeMST,
          roundAdjustmentPoint,
          readAdjustmentSettings,
        }),
      )
      .filter(Boolean)
      .sort((a, b) => {
        if (a.month !== b.month) {
          return b.month.localeCompare(a.month);
        }
        if (a.staffName !== b.staffName) {
          return a.staffName.localeCompare(b.staffName, "vi", { sensitivity: "base" });
        }
        return a.id.localeCompare(b.id);
      });
  }

  function persistAdjustments(list) {
    setItem(KPI_ADJUSTMENTS_KEY, JSON.stringify(list));
  }

  function getKpiAdjustments() {
    return getAllAdjustments();
  }

  function saveKpiAdjustment(entry, { actor = "system", permissions = {} } = {}) {
    const permissionSet = permissions || {};
    const canSubmit = permissionSet.adjustSubmit === true;
    const canApprove = permissionSet.adjustApprove === true;
    if (!canSubmit && !canApprove) {
      throw new Error("Ban khong co quyen tao diem KPI bo sung");
    }

    const now = new Date();
    const settingsSnapshot = readAdjustmentSettings();
    const autoApproveConfig = cloneAutoApproveSettings(settingsSnapshot.autoApprove, helperBag);
    const autoApproveEnabled = autoApproveConfig.enabled === true;
    const adjustments = getAllAdjustments();
    const existingIndex = entry?.id ? adjustments.findIndex((item) => item.id === entry.id) : -1;
    const current = existingIndex >= 0 ? adjustments[existingIndex] : null;
    const normalized = normalizeAdjustmentInput(entry, {
      now,
      actor,
      current,
      permissions,
      normalizeStr,
      normalizeMST,
      roundAdjustmentPoint,
      readAdjustmentSettings,
    });

    if (!normalized) {
      throw new Error("Dữ liệu điểm KPI bổ sung không hợp lệ");
    }

    let status = current?.status || "pending";
    const requestedStatus = normalized.status || "pending";
    if (requestedStatus !== status) {
      if ((requestedStatus === "approved" || requestedStatus === "rejected") && !permissions.adjustApprove) {
        throw new Error("Bạn không có quyền duyệt điểm KPI bổ sung");
      }
      status = requestedStatus;
    }

    let autoApproved = false;
    if (!current && status === "pending" && autoApproveEnabled && !canApprove) {
      status = "approved";
      autoApproved = true;
    }

    normalized.status = status;
    normalized.updatedAt = now.toISOString();
    normalized.updatedBy = actor;
    if (autoApproved) {
      const autoApproveActor = autoApproveConfig.updatedBy || "auto-approve";
      normalized.approvedAt = now.toISOString();
      normalized.approvedBy = autoApproveActor;
      if ("rejectedAt" in normalized) {
        delete normalized.rejectedAt;
      }
      if ("rejectedBy" in normalized) {
        delete normalized.rejectedBy;
      }
    }

    if (!current) {
      normalized.createdAt = now.toISOString();
      normalized.createdBy = actor;
    }

    const history = current?.history ? current.history.slice() : [];
    const changes = diffAdjustments(current, normalized);
    history.push(
      normalizeAdjustmentHistoryEntry(
        {
          action: current ? "update" : "create",
          actor,
          detail: normalized.note,
          changes,
        },
        helperBag,
      ),
    );

    if (autoApproved) {
      const autoApproveActor = autoApproveConfig.updatedBy || "auto-approve";
      const autoApproveDetail = autoApproveConfig.note
        ? `Duyet tu dong: ${autoApproveConfig.note}`
        : autoApproveConfig.updatedBy
          ? `Duyet tu dong (bat boi ${autoApproveConfig.updatedBy})`
          : "Duyet tu dong";
      history.push(
        normalizeAdjustmentHistoryEntry(
          {
            action: "status.approved",
            actor: autoApproveActor,
            detail: autoApproveDetail,
          },
          helperBag,
        ),
      );
    }

    normalized.history = clampHistory(history, helperBag);

    if (existingIndex >= 0) {
      adjustments[existingIndex] = { ...current, ...normalized };
    } else {
      adjustments.unshift(normalized);
    }

    persistAdjustments(adjustments);

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: current ? "kpi.adjustment.update" : "kpi.adjustment.create",
        detail: `${normalized.staffName || "Chưa rõ"} - ${normalized.month} (${KPI_ADJUSTMENT_CATEGORY_CONFIG[normalized.category]?.label || normalized.category})`,
        meta: {
          id: normalized.id,
          status: normalized.status,
          totalPoints: normalized.totalPoints,
          autoApproved,
        },
      });
    }

    return normalized;
  }

  function updateKpiAdjustmentStatus(id, status, { actor = "system", note = "", permissions = {} } = {}) {
    const normalizedStatus = normalizeStr(status).toLowerCase();
    if (!KPI_ADJUSTMENT_STATUS_SET.has(normalizedStatus)) {
      throw new Error("Trạng thái điểm KPI bổ sung không hợp lệ");
    }

    if (!permissions.adjustApprove) {
      throw new Error("Bạn không có quyền duyệt điểm KPI bổ sung");
    }

    const adjustments = getAllAdjustments();
    const index = adjustments.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("Không tìm thấy điểm KPI bổ sung");
    }

    const selected = { ...adjustments[index] };
    selected.status = normalizedStatus;

    const now = new Date();
    selected.updatedAt = now.toISOString();
    selected.updatedBy = actor;
    if (normalizedStatus === "approved") {
      selected.approvedAt = now.toISOString();
      selected.approvedBy = actor;
    } else if (normalizedStatus === "rejected") {
      selected.rejectedAt = now.toISOString();
      selected.rejectedBy = actor;
    }

    const history = selected.history ? selected.history.slice() : [];
    history.push(
      normalizeAdjustmentHistoryEntry(
        {
          action: `status.${normalizedStatus}`,
          actor,
          detail: note,
        },
        helperBag,
      ),
    );
    selected.history = clampHistory(history, helperBag);

    adjustments[index] = selected;
    persistAdjustments(adjustments);

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "kpi.adjustment.status",
        detail: `${selected.staffName || "Chưa rõ"} - ${selected.month} (${selected.status})`,
        meta: { id: selected.id, status: selected.status },
      });
    }

    return selected;
  }

  function removeKpiAdjustment(id, { actor = "system", permissions = {} } = {}) {
    if (!permissions.adjustApprove && !permissions.adjustSubmit) {
      throw new Error("Bạn không có quyền xoá điểm KPI bổ sung");
    }

    const adjustments = getAllAdjustments();
    const index = adjustments.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    const [removed] = adjustments.splice(index, 1);
    persistAdjustments(adjustments);

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "kpi.adjustment.delete",
        detail: `${removed.staffName || "Chưa rõ"} - ${removed.month}`,
        meta: { id },
      });
    }

    return true;
  }

  function mapAdjustmentsByMonth(adjustments = []) {
    const list = Array.isArray(adjustments) ? adjustments : [];
    const map = new Map();

    for (const entry of list) {
      if (!entry || entry.status !== "approved") continue;

      const month = entry.month || "";
      if (!month) continue;

      if (!map.has(month)) {
        map.set(month, []);
      }

      map.get(month).push(entry);
    }

    return map;
  }

  return {
    getKpiAdjustmentSettings,
    saveKpiAdjustmentSettings,
    getKpiAdjustments,
    saveKpiAdjustment,
    updateKpiAdjustmentStatus,
    removeKpiAdjustment,
    mapAdjustmentsByMonth,
  };
}
