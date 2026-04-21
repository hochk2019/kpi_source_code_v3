import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { emitCommand } from "@/lib/commandBus.js";
import { roundAdjustmentPoint } from "@/lib/store.js";
import { cn } from "@/lib/utils.js";

function copyLookupValue(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return;
  }

  navigator.clipboard.writeText(normalizedValue).catch(() => { });
}

function openWorkflowLookup(tab, focus, value) {
  copyLookupValue(value);
  emitCommand("navigate:tab", { tab, focus });
}

export default function KpiAdjustmentListPanel({
  formFieldIds,
  selectFieldClass,
  filterMonth,
  onFilterMonthChange,
  filterStatus,
  onFilterStatusChange,
  showMineToggle,
  showMineOnly,
  currentStaffKey,
  onMineToggle,
  canApprove,
  staffFilter,
  onStaffFilterChange,
  staffFilterOptions,
  filteredAdjustments,
  currentPageItems,
  page,
  pageSize,
  pageCount,
  totalItems,
  pageSizeOptions,
  onPageSizeChange,
  onNextPage,
  onPreviousPage,
  PageSizeControlComponent,
  categoryConfig,
  statusLabels,
  formatDecimal,
  formatDateTime,
  selectedAdjustmentIds,
  allVisibleAdjustmentsSelected,
  selectedAdjustmentCount,
  bulkApproveCount,
  bulkRejectCount,
  onToggleAdjustmentSelection,
  onToggleVisibleAdjustmentsSelection,
  onClearSelection,
  onBulkApprove,
  onBulkReject,
  onEdit,
  onViewDetail,
  onApprove,
  onReject,
  onDelete,
}) {
  const visibleAdjustments = Array.isArray(currentPageItems) ? currentPageItems : filteredAdjustments;
  const selectedIdSet = selectedAdjustmentIds instanceof Set ? selectedAdjustmentIds : new Set(selectedAdjustmentIds || []);
  const rangeStart = totalItems > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = totalItems > 0 ? Math.min(totalItems, page * pageSize) : 0;
  const canGoPrevious = page > 1;
  const canGoNext = page < pageCount;

  return (
    <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Danh sách điểm KPI +/-</h3>
        <p className="text-sm text-gray-500">Lọc và duyệt các đề xuất cộng/trừ điểm.</p>
      </div>
      <div>
        <div className="grid gap-4 text-sm md:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.filterMonth}>
              Lọc theo tháng
            </label>
            <Input
              id={formFieldIds.filterMonth}
              type="month"
              value={filterMonth === "all" ? "" : filterMonth}
              onChange={(event) => onFilterMonthChange(event.target.value || "all")}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.filterStatus}>
              Trạng thái
            </label>
            <select
              id={formFieldIds.filterStatus}
              className={selectFieldClass}
              value={filterStatus}
              onChange={(event) => onFilterStatusChange(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="approved">Đã duyệt</option>
              <option value="pending">Chờ duyệt</option>
              <option value="rejected">Đã từ chối</option>
            </select>
          </div>

          {showMineToggle ? (
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.filterMine}>
                Chỉ hiển thị điểm bổ sung của tôi
              </label>
              <div className="mt-2 flex items-center gap-3">
                <Switch
                  id={formFieldIds.filterMine}
                  checked={showMineOnly}
                  onCheckedChange={onMineToggle}
                  disabled={!currentStaffKey}
                />
                <span className="text-xs text-muted-foreground">
                  {showMineOnly ? "Đang lọc theo chính bạn" : "Đang xem tất cả"}
                </span>
              </div>
            </div>
          ) : null}

          {canApprove ? (
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.filterStaff}>
                Lọc theo nhân viên
              </label>
              <select
                id={formFieldIds.filterStaff}
                className={selectFieldClass}
                value={staffFilter}
                onChange={(event) => onStaffFilterChange(event.target.value)}
                disabled={showMineOnly || staffFilterOptions.length === 0}
              >
                <option value="all">Tất cả</option>
                {staffFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {totalItems > 0
                ? `Hiển thị ${rangeStart}-${rangeEnd} / ${totalItems} mục`
                : "Không có mục nào khớp bộ lọc hiện tại"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Trang {page} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onPreviousPage}
                disabled={!canGoPrevious}
              >
                Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onNextPage}
                disabled={!canGoNext}
              >
                Trang sau
              </Button>
            </div>
          </div>

          {PageSizeControlComponent ? (
            <PageSizeControlComponent
              value={pageSize}
              onChange={onPageSizeChange}
              options={pageSizeOptions}
              selectId="kpi-adjustment-page-size"
            />
          ) : null}
        </div>

        {canApprove ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {selectedAdjustmentCount > 0
                  ? `Đã chọn ${selectedAdjustmentCount} mục trên trang hiện tại`
                  : "Chưa chọn mục nào để xử lý hàng loạt"}
              </p>
              <p className="text-xs text-muted-foreground">
                Chọn các dòng đang hiển thị rồi duyệt hoặc từ chối cùng lúc để giảm thao tác lặp lại.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onClearSelection}
                disabled={selectedAdjustmentCount === 0}
              >
                Bỏ chọn
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={onBulkApprove}
                disabled={bulkApproveCount === 0}
              >
                Duyệt đã chọn ({bulkApproveCount})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="button"
                onClick={onBulkReject}
                disabled={bulkRejectCount === 0}
              >
                Từ chối đã chọn ({bulkRejectCount})
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr className="text-left">
                {canApprove ? (
                  <th className="px-4 py-2">
                    <Checkbox
                      checked={allVisibleAdjustmentsSelected}
                      aria-label="Chọn tất cả mục trên trang"
                      onCheckedChange={onToggleVisibleAdjustmentsSelection}
                      disabled={visibleAdjustments.length === 0}
                    />
                  </th>
                ) : null}
                <th className="px-4 py-2">Tháng</th>
                <th className="px-4 py-2">Hạng mục</th>
                <th className="px-4 py-2">Công ty</th>
                <th className="px-4 py-2">Mã số thuế</th>
                <th className="px-4 py-2">Nhân viên</th>
                <th className="px-4 py-2">Tổ đội</th>
                <th className="px-4 py-2 text-right">Điểm</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Cập nhật</th>
                <th className="px-4 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground">
              {visibleAdjustments.length ? (
                visibleAdjustments.map((item) => {
                  const rowConfig = categoryConfig[item.category] || {};
                  const label = rowConfig.label || item.category;
                  const statusLabel = statusLabels[item.status] || item.status;
                  const primaryReference = Array.isArray(item.references)
                    ? item.references.find((reference) => String(reference || "").trim())
                    : "";
                  const statusClass = cn(
                    "rounded-md px-2 py-1 text-xs font-medium",
                    item.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : item.status === "rejected"
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-amber-500/10 text-amber-600"
                  );
                  const extraQuantity =
                    rowConfig.extraPointConfig ? Number.parseFloat(item.extraQuantity ?? 0) || 0 : 0;
                  const extraUnitPoints = rowConfig.extraPointConfig
                    ? Number.parseFloat(item.extraUnitPoints ?? rowConfig.extraPointConfig.defaultUnit ?? 0) || 0
                    : 0;
                  const extraTotal = rowConfig.extraPointConfig
                    ? roundAdjustmentPoint(extraQuantity * extraUnitPoints)
                    : 0;

                  return (
                    <tr key={item.id} className="odd:bg-background even:bg-muted/30">
                      {canApprove ? (
                        <td className="px-4 py-2 align-top">
                          <Checkbox
                            checked={selectedIdSet.has(item.id)}
                            aria-label={`Chọn mục điểm ${label} của ${item.staffName || "Chưa gán"}`}
                            onCheckedChange={(checked) => onToggleAdjustmentSelection(item.id, checked === true)}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-2 align-top">{item.month || "—"}</td>
                      <td className="px-4 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground">{label}</span>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {item.mode ? (
                              <Badge variant="outline" className="border-dashed">
                                Chế độ: {item.mode === "fixed" ? "Cố định" : "Linh hoạt"}
                              </Badge>
                            ) : null}
                            {item.licenseCode ? <Badge variant="outline">GP: {item.licenseCode}</Badge> : null}
                            {rowConfig.groupLabel ? <Badge variant="outline">{rowConfig.groupLabel}</Badge> : null}
                            {rowConfig.extraPointConfig && extraQuantity > 0 ? (
                              <Badge variant="outline">
                                Bổ sung: {formatDecimal(extraQuantity)} x {formatDecimal(extraUnitPoints)} (
                                {formatDecimal(extraTotal)})
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top">{item.companyName || "—"}</td>
                      <td className="px-4 py-2 align-top">
                        {item.taxCode ? (
                          <div className="flex flex-col items-start gap-2">
                            <span>{item.taxCode}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="h-auto px-0 py-0 text-xs font-medium text-primary hover:bg-transparent"
                              onClick={() => openWorkflowLookup("mst", "review", item.taxCode)}
                            >
                              Mở MST
                            </Button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 align-top">{item.staffName || "Chưa gán"}</td>
                      <td className="px-4 py-2 align-top">{item.teamName || "—"}</td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right font-semibold",
                          item.totalPoints >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}
                      >
                        {formatDecimal(item.totalPoints)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <span className={statusClass}>{statusLabel}</span>
                      </td>
                      <td className="px-4 py-2 align-top text-muted-foreground">
                        {formatDateTime(item.updatedAt || item.createdAt)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" type="button" onClick={() => onEdit(item)}>
                            Sửa
                          </Button>
                          <Button variant="ghost" size="sm" type="button" onClick={() => onViewDetail(item)}>
                            Chi tiết
                          </Button>
                          {primaryReference ? (
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              aria-label={`Mở tờ khai ${primaryReference}`}
                              onClick={() => openWorkflowLookup("import", "review", primaryReference)}
                            >
                              {primaryReference}
                            </Button>
                          ) : null}
                          {canApprove ? (
                            <>
                              {item.status !== "approved" ? (
                                <Button size="sm" type="button" onClick={() => onApprove(item)}>
                                  Duyệt
                                </Button>
                              ) : null}
                              {item.status !== "rejected" ? (
                                <Button variant="destructive" size="sm" type="button" onClick={() => onReject(item)}>
                                  Từ chối
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            type="button"
                            onClick={() => onDelete(item)}
                          >
                            Xóa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={canApprove ? 11 : 10}>
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
