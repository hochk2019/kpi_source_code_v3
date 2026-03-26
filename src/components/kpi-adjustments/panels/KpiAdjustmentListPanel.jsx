import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { roundAdjustmentPoint } from "@/lib/store.js";
import { cn } from "@/lib/utils.js";

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
  categoryConfig,
  statusLabels,
  formatDecimal,
  formatDateTime,
  onEdit,
  onViewDetail,
  onApprove,
  onReject,
  onDelete,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Danh sách điểm KPI +/-</CardTitle>
        <CardDescription>Lọc và duyệt các đề xuất cộng/trừ điểm.</CardDescription>
      </CardHeader>
      <CardContent>
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

        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr className="text-left">
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
              {filteredAdjustments.length ? (
                filteredAdjustments.map((item) => {
                  const rowConfig = categoryConfig[item.category] || {};
                  const label = rowConfig.label || item.category;
                  const statusLabel = statusLabels[item.status] || item.status;
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
                      <td className="px-4 py-2 align-top">{item.taxCode || "—"}</td>
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
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={10}>
                    Không có điểm KPI bổ sung nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
