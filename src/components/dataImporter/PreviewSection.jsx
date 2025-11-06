import React from "react";

export default function PreviewSection({ context }) {
  const {
    mode,
    importPreview,
    importPreviewStats,
    importPreviewSamples,
    importErrorReasonLabels,
    formatDeclarationLabel,
    formatDisplayDate,
  } = context;

  if (mode !== "preview") {
    return null;
  }

  if (importPreview?.error) {
    return (
      <div className="mt-3 space-y-3">
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Không thể kiểm tra file import. {importPreview.error?.message || "Vui lòng thử lại."}
        </div>
      </div>
    );
  }

  if (!importPreview) {
    return null;
  }

  const reasonLabels = importErrorReasonLabels || {};
  const previewSamples = importPreviewSamples || { errors: [], inserted: [] };
  const stats = Array.isArray(importPreviewStats) ? importPreviewStats : [];

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded border border-[color:var(--ds-border-strong)] bg-[color:var(--ds-surface-card)] p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Kết quả kiểm tra trước khi import</h3>
            <p className="text-xs text-gray-500">
              Tổng dòng đọc: {importPreview.totalIncoming.toLocaleString("vi-VN")} • Sau khi ghi: {" "}
              {importPreview.totalAfter.toLocaleString("vi-VN")}
            </p>
          </div>
          {importPreview.mode === "overwrite" ? (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold uppercase text-amber-700">
              Ghi đè toàn bộ
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((item) => (
            <div key={item.key} className="rounded border bg-gray-50 px-3 py-2">
              <div className="text-[11px] uppercase text-gray-500">{item.label}</div>
              <div className="text-base font-semibold text-gray-900">{item.value.toLocaleString("vi-VN")}</div>
            </div>
          ))}
        </div>

        {previewSamples.errors.length > 0 ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-red-700">
                Dòng lỗi sẽ bị bỏ qua ({importPreview.invalid.toLocaleString("vi-VN")})
              </h4>
              <span className="text-xs text-gray-500">
                Hiển thị tối đa {previewSamples.errors.length.toLocaleString("vi-VN")} dòng đầu tiên
              </span>
            </div>
            <div className="max-h-48 overflow-auto rounded border">
              <table className="min-w-full text-xs">
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
                    const reasonLabel = reasonLabels[item.reason] || reasonLabels.unknown || "Không xác định";
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
        ) : null}

        {previewSamples.inserted.length > 0 ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-emerald-700">
                Dòng thêm mới ({importPreview.inserted.toLocaleString("vi-VN")})
              </h4>
              {importPreview.inserted > previewSamples.inserted.length ? (
                <span className="text-xs text-gray-500">
                  +{(importPreview.inserted - previewSamples.inserted.length).toLocaleString("vi-VN")} dòng khác
                </span>
              ) : null}
            </div>
            <div className="max-h-60 overflow-auto rounded border">
              <table className="min-w-full text-xs">
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
                  {previewSamples.inserted.map((row, index) => {
                    const companyName =
                      row?.company ||
                      row?.cong_ty ||
                      row?.ten_dn ||
                      row?.ten_doanh_nghiep ||
                      row?.ten_doanh_nghiep_xnk ||
                      row?.["Tên doanh nghiệp"] ||
                      row?.["Doanh nghiệp"] ||
                      "";
                    return (
                      <tr
                        key={`${row.so_tk || index}-${row.nhanh || ""}`}
                        className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
                      >
                        <td className="px-2 py-1">{formatDeclarationLabel(row)}</td>
                        <td className="px-2 py-1">{row.mst || row.ma_so_thue || "—"}</td>
                        <td className="px-2 py-1">{companyName || "—"}</td>
                        <td className="px-2 py-1">{row.date ? formatDisplayDate(row.date) : "—"}</td>
                        <td className="px-2 py-1">{row.nhan_vien || ""}</td>
                        <td className="px-2 py-1">{row.team || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {importPreview.newBusinessCount > 0 ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-blue-700">
                Doanh nghiệp mới ({importPreview.newBusinessCount.toLocaleString("vi-VN")})
              </h4>
              <span className="text-xs text-gray-500">Thông tin được thêm vào tab Gán MST</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {importPreview.newBusinesses.slice(0, 10).map((biz) => (
                <span key={biz.mst} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                  {biz.mst} – {biz.company || "Không tên"}
                </span>
              ))}
              {importPreview.newBusinessCount > importPreview.newBusinesses.length ? (
                <span className="text-xs text-gray-500">
                  +{(importPreview.newBusinessCount - importPreview.newBusinesses.length).toLocaleString("vi-VN")} MST khác
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
