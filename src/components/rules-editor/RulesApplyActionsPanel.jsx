import React, { useRef } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";

export default function RulesApplyActionsPanel({
  rule,
  applyNow,
  isReadOnly,
  canDeleteRule,
  onRuleChange,
  onApplyNowChange,
  onSave,
  onReset,
  onExportCurrentRule,
  onImportCurrentRule,
  onExportAllRules,
  onImportAllRules,
  onDeleteRule,
}) {
  const currentRuleImportRef = useRef(null);
  const collectionImportRef = useRef(null);

  return (
    <div className="space-y-3 rounded border p-3">
      <div className="font-semibold">Áp dụng</div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm text-gray-600">Áp dụng từ ngày (yyyy-mm-dd)</label>
          <Input
            value={rule.applyFrom || ""}
            onChange={(event) => onRuleChange({ ...rule, applyFrom: event.target.value })}
            placeholder="yyyy-mm-dd"
            disabled={isReadOnly}
          />
        </div>

        <label className="mt-6 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={applyNow}
            onChange={(event) => onApplyNowChange(event.target.checked)}
            disabled={isReadOnly}
          />
          Tính lại KPI cho dữ liệu từ ngày này sau khi lưu
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={isReadOnly}>
          Lưu
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isReadOnly}>
          Khôi phục bản đã lưu
        </Button>
        <Button variant="outline" onClick={onExportCurrentRule}>
          Xuất bộ đang mở
        </Button>

        <input
          ref={currentRuleImportRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={onImportCurrentRule}
          disabled={isReadOnly}
          data-testid="import-rule-json"
        />
        <Button
          variant="outline"
          onClick={() => currentRuleImportRef.current?.click()}
          disabled={isReadOnly}
        >
          Nhập vào bộ đang mở
        </Button>

        <Button variant="outline" onClick={onExportAllRules}>
          Xuất quy tắc (sao lưu)
        </Button>

        <input
          ref={collectionImportRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={onImportAllRules}
          disabled={isReadOnly}
          data-testid="import-rules-collection"
        />
        <Button
          variant="outline"
          onClick={() => collectionImportRef.current?.click()}
          disabled={isReadOnly}
        >
          Khôi phục toàn bộ quy tắc
        </Button>

        <Button variant="destructive" onClick={onDeleteRule} disabled={isReadOnly || !canDeleteRule}>
          Xóa bộ quy tắc
        </Button>
      </div>
    </div>
  );
}
