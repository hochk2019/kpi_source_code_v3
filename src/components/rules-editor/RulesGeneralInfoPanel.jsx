import React from "react";

import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";

export default function RulesGeneralInfoPanel({
  collection,
  activeTab,
  isReadOnly,
  isDefaultRule,
  currentVersion,
  savedVersion,
  rule,
  formatTimestamp,
  onSelectTab,
  onAddRule,
  onSetDefault,
  onSetDefaultButton,
  onRuleChange,
}) {
  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {collection.sets.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`rounded border px-3 py-2 text-sm transition ${
                item.id === activeTab
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white hover:border-blue-300"
              }`}
            >
              <span className="font-medium">{item.name || "Bộ quy tắc"}</span>
              {collection.activeId === item.id && (
                <Badge variant="secondary" className="ml-2">
                  Mặc định
                </Badge>
              )}
            </button>
          ))}
          {!isReadOnly && (
            <Button variant="outline" onClick={onAddRule}>
              Thêm bộ quy tắc
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-gray-600">Bộ quy tắc mặc định:</label>

          <select
            value={collection.activeId}
            onChange={onSetDefault}
            className="rounded border px-3 py-2"
            disabled={isReadOnly}
          >
            {collection.sets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || "Bộ quy tắc"}
              </option>
            ))}
          </select>

          {!isDefaultRule && !isReadOnly && (
            <Button variant="outline" onClick={onSetDefaultButton}>
              Đặt bộ đang mở làm mặc định
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded border p-3">
        <div className="font-semibold">Thông tin chung</div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span>
            Phiên bản đang chỉnh: <strong>{currentVersion !== null ? currentVersion : "—"}</strong>
          </span>
          {savedVersion !== null && savedVersion !== currentVersion ? (
            <span>
              Phiên bản đã lưu gần nhất: <strong>{savedVersion}</strong>
            </span>
          ) : null}
          {rule?.updatedAt ? (
            <span>Cập nhật gần nhất: {formatTimestamp(rule.updatedAt)}</span>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-gray-600">Tên bộ quy tắc</label>
            <Input
              value={rule.name || ""}
              onChange={(event) => onRuleChange({ ...rule, name: event.target.value })}
              disabled={isReadOnly}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Ghi chú (tuỳ chọn)</label>
            <Input
              value={rule.description || ""}
              onChange={(event) => onRuleChange({ ...rule, description: event.target.value })}
              disabled={isReadOnly}
            />
          </div>
        </div>
      </div>
    </>
  );
}
