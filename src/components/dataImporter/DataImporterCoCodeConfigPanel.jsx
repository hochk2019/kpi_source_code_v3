import React from "react";

import CollapsibleCard from "@/components/CollapsibleCard.jsx";

export default function DataImporterCoCodeConfigPanel({
  canManageSync,
  loading,
  saving,
  error,
  message,
  form,
  onFormChange,
  onRefresh,
  onSave,
  onReset,
  updatedLabel,
}) {
  const handleFieldChange = (field, value) => {
    onFormChange({
      ...form,
      [field]: value,
    });
  };

  return (
    <CollapsibleCard
      id="co-code-config"
      title="Cấu hình mã ưu đãi C/O"
      description="Quản lý danh sách mã ưu đãi để hệ thống đánh giá C/O chính xác."
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded border px-3 py-1 text-sm"
            disabled={loading}
            data-tooltip="Tải lại cấu hình mã ưu đãi C/O"
          >
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      }
      bodyClassName="space-y-3"
    >
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {message ? <div className="text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>Whitelist ưu tiên</span>
            <span className="text-xs text-gray-600">Mỗi dòng một mã (để trống nếu không dùng)</span>
          </label>
          <textarea
            value={form.whitelist}
            onChange={(event) => handleFieldChange("whitelist", event.target.value)}
            className="mt-1 h-32 w-full resize-y rounded border px-3 py-2 text-sm"
            placeholder="VD: CA3"
            disabled={loading || saving || !canManageSync}
          />
        </div>

        <div>
          <label className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>Blacklist không C/O</span>
            <span className="text-xs text-gray-600">Mỗi dòng một mã</span>
          </label>
          <textarea
            value={form.blacklist}
            onChange={(event) => handleFieldChange("blacklist", event.target.value)}
            className="mt-1 h-32 w-full resize-y rounded border px-3 py-2 text-sm"
            placeholder="VD: B01"
            disabled={loading || saving || !canManageSync}
          />
        </div>
      </div>

      <p className="text-xs text-gray-700">
        Nếu whitelist để trống, hệ thống sẽ sử dụng blacklist để loại bỏ các mã không được xem là C/O.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          className="rounded bg-emerald-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          disabled={saving || loading || !canManageSync}
          data-tooltip="Lưu danh sách mã ưu đãi"
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          disabled={loading || saving}
          data-tooltip="Khôi phục cấu hình mã ưu đãi"
        >
          Khôi phục
        </button>
      </div>

      <div className="text-xs text-gray-600">{updatedLabel}</div>
    </CollapsibleCard>
  );
}
