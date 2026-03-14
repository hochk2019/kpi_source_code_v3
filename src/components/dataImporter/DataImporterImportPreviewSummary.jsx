import React from "react";

import { formatDisplayDate } from "../../../packages/domain/src/format.js";

function resolvePreviewCompanyName(row) {
  return (
    row?.company ||
    row?.cong_ty ||
    row?.ten_dn ||
    row?.ten_doanh_nghiep ||
    row?.ten_doanh_nghiep_xnk ||
    row?.["Tên doanh nghiệp"] ||
    row?.["Doanh nghiệp"] ||
    ""
  );
}

function formatPreviewNumber(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export default function DataImporterImportPreviewSummary({
  importPreview = null,
  previewSource = null,
  errorReasonLabels = {},
  formatDeclarationLabel = (entry) => entry?.so_tk || "—",
}) {
  const isSyncPreview = previewSource === "sync";

  if (!importPreview) {
    return null;
  }

  if (importPreview.error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        Không thể kiểm tra file import. {importPreview.error?.message || "Vui lòng thử lại."}
      </div>
    );
  }

  const previewStats = [
    { key: "inserted", label: "Dòng sẽ thêm mới", value: importPreview.inserted || 0 },
    { key: "updated", label: "Dòng sẽ cập nhật", value: importPreview.updated || 0 },
    { key: "skipped", label: "Giữ nguyên", value: importPreview.skipped || 0 },
    { key: "locked", label: "Đang bị khóa", value: importPreview.locked || 0 },
    { key: "invalid", label: "Lỗi dữ liệu", value: importPreview.invalid || 0 },
    { key: "mst", label: "MST mới", value: importPreview.newBusinessCount || 0 },
  ];
  const previewSamples = {
    inserted: Array.isArray(importPreview.samples?.inserted) ? importPreview.samples.inserted : [],
    errors: Array.isArray(importPreview.samples?.errors) ? importPreview.samples.errors : [],
  };
  const newBusinesses = Array.isArray(importPreview.newBusinesses) ? importPreview.newBusinesses : [];

  return (
    <div className="rounded border border-[color:var(--ds-border-strong)] bg-[color:var(--ds-surface-card)] p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {isSyncPreview ? "Kết quả kiểm tra trước khi đồng bộ" : "Kết quả kiểm tra trước khi import"}
          </h3>
          <p className="text-xs text-gray-500">
            Tổng dòng đọc: {formatPreviewNumber(importPreview.totalIncoming)} • Sau khi ghi: {formatPreviewNumber(importPreview.totalAfter)}
          </p>
        </div>
        {importPreview.mode === "overwrite" && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold uppercase text-amber-700">
            Ghi đè toàn bộ
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {previewStats.map((item) => (
          <div key={item.key} className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-[11px] uppercase text-gray-500">{item.label}</div>
            <div className="text-base font-semibold text-gray-900">{formatPreviewNumber(item.value)}</div>
          </div>
        ))}
      </div>

      {previewSamples.errors.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-red-700">
              Dòng lỗi sẽ bị bỏ qua ({formatPreviewNumber(importPreview.invalid)})
            </h4>
            <span className="text-xs text-gray-500">
              Hiển thị tối đa {formatPreviewNumber(previewSamples.errors.length)} dòng đầu tiên
            </span>
          </div>
          <div className="max-h-48 overflow-auto rounded border">
            <table className="min-w-full text-xs" aria-label="Bảng các dòng lỗi import">
              <thead className="bg-red-50 text-red-700">
                <tr>
                  <th className="px-2 py-1 text-left">Lý do</th>
                  <th className="px-2 py-1 text-left">Số tờ khai</th>
                  <th className="px-2 py-1 text-left">Nhánh</th>
                  <th className="px-2 py-1 text-left">MST</th>
                  <th className="px-2 py-1 text-left">Doanh nghiệp</th>
                </tr>
              </thead>
              <tbody>
                {previewSamples.errors.map((item, index) => {
                  const reasonLabel =
                    errorReasonLabels[item.reason] || errorReasonLabels.unknown || item.reason || "Không xác định";

                  return (
                    <tr
                      key={`${item.reason}-${item.so_tk || index}-${item.nhanh || ""}`}
                      className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
                    >
                      <td className="px-2 py-1 text-red-600">{reasonLabel}</td>
                      <td className="px-2 py-1">{item.so_tk || "—"}</td>
                      <td className="px-2 py-1">{item.nhanh || "—"}</td>
                      <td className="px-2 py-1">{item.mst || "—"}</td>
                      <td className="px-2 py-1">{item.company || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {previewSamples.inserted.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-emerald-700">
              Dòng thêm mới ({formatPreviewNumber(importPreview.inserted)})
            </h4>
            {importPreview.inserted > previewSamples.inserted.length && (
              <span className="text-xs text-gray-500">
                +{formatPreviewNumber(importPreview.inserted - previewSamples.inserted.length)} dòng khác
              </span>
            )}
          </div>
          <div className="max-h-60 overflow-auto rounded border">
            <table
              className="min-w-full text-xs"
              aria-label={
                isSyncPreview
                  ? "Bảng các dòng thêm mới từ xem trước đồng bộ ECUS"
                  : "Bảng các dòng thêm mới từ file import"
              }
            >
              <thead className="bg-emerald-50 text-emerald-700">
                <tr>
                  <th className="px-2 py-1 text-left">Số tờ khai</th>
                  <th className="px-2 py-1 text-left">MST</th>
                  <th className="px-2 py-1 text-left">Công ty</th>
                  <th className="px-2 py-1 text-left">Ngày đăng ký</th>
                  <th className="px-2 py-1 text-left">Nhân viên</th>
                  <th className="px-2 py-1 text-left">Tổ đội</th>
                </tr>
              </thead>
              <tbody>
                {previewSamples.inserted.map((row, index) => (
                  <tr
                    key={`${row.so_tk || index}-${row.nhanh || ""}`}
                    className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
                  >
                    <td className="px-2 py-1">{formatDeclarationLabel(row)}</td>
                    <td className="px-2 py-1">{row.mst || row.ma_so_thue || "—"}</td>
                    <td className="px-2 py-1">{resolvePreviewCompanyName(row) || "—"}</td>
                    <td className="px-2 py-1">{row.date ? formatDisplayDate(row.date) : "—"}</td>
                    <td className="px-2 py-1">{row.nhan_vien || ""}</td>
                    <td className="px-2 py-1">{row.team || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importPreview.newBusinessCount > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-blue-700">
              Doanh nghiệp mới ({formatPreviewNumber(importPreview.newBusinessCount)})
            </h4>
            <span className="text-xs text-gray-500">Thông tin được thêm vào tab Gán MST</span>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Danh sách doanh nghiệp mới">
            {newBusinesses.slice(0, 10).map((biz) => (
              <span key={biz.mst} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                {biz.mst} – {biz.company || "Không tên"}
              </span>
            ))}
            {importPreview.newBusinessCount > newBusinesses.length && (
              <span className="text-xs text-gray-500">
                +{formatPreviewNumber(importPreview.newBusinessCount - newBusinesses.length)} MST khác
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
