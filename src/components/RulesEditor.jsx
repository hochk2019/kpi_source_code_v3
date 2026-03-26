import React, { useMemo } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.jsx";

import { Badge } from "@/components/ui/badge.jsx";

import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import RulesConfigTabsPanel from "@/components/rules-editor/RulesConfigTabsPanel.jsx";
import RulesHistoryPanel from "@/components/rules-editor/RulesHistoryPanel.jsx";
import RulesSimulationPanel from "@/components/rules-editor/RulesSimulationPanel.jsx";
import RulesTestWorkspacePanel from "@/components/rules-editor/RulesTestWorkspacePanel.jsx";

import { getData, getHQAgencies } from "@/lib/store.js";
import useRulesConfigState from "@/components/rules-editor/hooks/useRulesConfigState.js";
import useRulesEditorWorkflow from "@/components/rules-editor/hooks/useRulesEditorWorkflow.js";
import useRulesTestWorkspace from "@/components/rules-editor/hooks/useRulesTestWorkspace.js";


function formatHistoryTimestamp(value) {

  if (!value) return "—";

  try {

    return new Date(value).toLocaleString("vi-VN", { hour12: false });

  } catch (err) {

    console.warn("Không thể định dạng thời gian lịch sử quy tắc", value, err);

    return value;

  }

}


export default function RulesEditor({ canEdit = true, currentUser = null }) {
  const hqAgencies = useMemo(() => getHQAgencies(), []);
  const data = useMemo(() => getData(), []);
  const {
    activeTab,
    applyNow,
    collection,
    configTab,
    currentVersion,
    expandedHistoryId,
    exportAllRules,
    exportCurrentRule,
    handleAddRule,
    handleDeleteRule,
    handleHistoryRefresh,
    handleReset,
    handleRestoreEntry,
    handleSave,
    handleSelectTab,
    handleSetDefault,
    handleSetDefaultButton,
    historyCollapsed,
    historyEntries,
    historyError,
    historyLoading,
    importAllRules,
    importCurrentRule,
    isDefaultRule,
    isReadOnly,
    restoringId,
    rule,
    runSimulation,
    savedVersion,
    setApplyNow,
    setConfigTab,
    setExpandedHistoryId,
    setHistoryCollapsed,
    simError,
    simResult,
    simRunning,
    updateRule,
  } = useRulesEditorWorkflow({
    canEdit,
    currentUser,
    data,
  });
  const testWorkspace = useRulesTestWorkspace({ data, rule });



  const {
    groups,
    typeOptions,
    licenseConfig,
    licenseOptions,
    agencyOptions,
    handleCodesChange,
    handleGroupNumber,
    handleLicenseChange,
    handleAgencyChange,
  } = useRulesConfigState({
    data,
    rule,
    hqAgencies,
    updateRule,
  });

  return (

    <div className="mx-auto max-w-6xl space-y-6 p-4">

      {isReadOnly && (

        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">

          Bạn đang xem quy tắc KPI ở chế độ chỉ xem. Các trường cấu hình bị khóa; vẫn có thể dùng khu vực test để kiểm tra điểm KPI.

        </div>

      )}

      <Card>

        <CardHeader>

          <CardTitle>Quy tắc KPI</CardTitle>

        </CardHeader>

        <CardContent className="space-y-8">

          <div className="space-y-3">

            <div className="flex flex-wrap items-center gap-2">

              {collection.sets.map((item) => (

                <button

                  key={item.id}

                  type="button"

                  onClick={() => handleSelectTab(item.id)}

                  className={`rounded border px-3 py-2 text-sm transition ${

                    item.id === activeTab

                      ? "border-blue-500 bg-blue-50 text-blue-700"

                      : "border-gray-200 bg-white hover:border-blue-300"

                  }`}

                >

                  <span className="font-medium">{item.name || "Bộ quy tắc"}</span>

                  {collection.activeId === item.id && (

                    <Badge variant="secondary" className="ml-2">Mặc định</Badge>

                  )}

                </button>

              ))}

              {!isReadOnly && (

                <Button variant="outline" onClick={handleAddRule}>

                  Thêm bộ quy tắc

                </Button>

              )}

            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">

              <label className="text-gray-600">Bộ quy tắc mặc định:</label>

              <select

                value={collection.activeId}

                onChange={handleSetDefault}

                className="rounded border px-3 py-2"

              >

                {collection.sets.map((item) => (

                  <option key={item.id} value={item.id}>

                    {item.name || "Bộ quy tắc"}

                  </option>

                ))}

              </select>

              {!isDefaultRule && !isReadOnly && (

                <Button variant="outline" onClick={handleSetDefaultButton}>

                  Đặt bộ đang mở làm mặc định

                </Button>

              )}

            </div>

          </div>



          <div className="space-y-3 rounded border p-3">

            <div className="font-semibold">Thông tin chung</div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">

              <span>

                Phiên bản đang chỉnh: <strong>{currentVersion !== null ? currentVersion : '—'}</strong>

              </span>

              {savedVersion !== null && savedVersion !== currentVersion ? (

                <span>

                  Phiên bản đã lưu gần nhất: <strong>{savedVersion}</strong>

                </span>

              ) : null}

              {rule?.updatedAt ? (

                <span>Cập nhật gần nhất: {formatHistoryTimestamp(rule.updatedAt)}</span>

              ) : null}

            </div>

            <div className="grid gap-4 md:grid-cols-2">

              <div>

                <label className="text-sm text-gray-600">Tên bộ quy tắc</label>

                <Input

                  value={rule.name || ""}

                  onChange={(event) => updateRule({ ...rule, name: event.target.value })}

                  disabled={isReadOnly}

                />

              </div>

              <div>

                <label className="text-sm text-gray-600">Ghi chú (tuỳ chọn)</label>

                <Input

                  value={rule.description || ""}

                  onChange={(event) => updateRule({ ...rule, description: event.target.value })}

                  disabled={isReadOnly}

                />

              </div>

            </div>

          </div>



          <RulesConfigTabsPanel
            configTab={configTab}
            onConfigTabChange={setConfigTab}
            groups={groups}
            typeOptions={typeOptions}
            isReadOnly={isReadOnly}
            onGroupCodesChange={handleCodesChange}
            onGroupNumberChange={handleGroupNumber}
            licenseConfig={licenseConfig}
            onLicenseChange={handleLicenseChange}
            licenseOptions={licenseOptions}
            onAgencyChange={handleAgencyChange}
            agencyOptions={agencyOptions}
            rule={rule}
            onRuleChange={updateRule}
          />



          <RulesSimulationPanel
            declarationCount={data.length}
            simRunning={simRunning}
            simError={simError}
            simResult={simResult}
            onRunSimulation={runSimulation}
          />



          <div className="space-y-3 rounded border p-3">

            <div className="font-semibold">Áp dụng</div>

            <div className="grid gap-4 md:grid-cols-3">

              <div>

                <label className="text-sm text-gray-600">Áp dụng từ ngày (yyyy-mm-dd)</label>

                <Input

                  value={rule.applyFrom || ""}

                  onChange={(event) => updateRule({ ...rule, applyFrom: event.target.value })}

                  placeholder="yyyy-mm-dd"

                  disabled={isReadOnly}

                />

              </div>

              <label className="mt-6 inline-flex items-center gap-2 text-sm">

                <input

                  type="checkbox"

                  checked={applyNow}

                  onChange={(event) => setApplyNow(event.target.checked)}

                  disabled={isReadOnly}

                />

                Tính lại KPI cho dữ liệu từ ngày này sau khi lưu

              </label>

            </div>

            <div className="flex flex-wrap gap-2">

              <Button onClick={handleSave} disabled={isReadOnly}>Lưu</Button>

              <Button variant="outline" onClick={handleReset} disabled={isReadOnly}>Khôi phục bản đã lưu</Button>

              <Button variant="outline" onClick={exportCurrentRule}>Xuất bộ đang mở</Button>

              <label className="inline-flex items-center gap-2">

                <input

                  id="import-rule-json"

                  type="file"

                  accept=".json"

                  className="hidden"

                  onChange={importCurrentRule}

                  disabled={isReadOnly}

                />

                <Button

                  variant="outline"

                  onClick={() => {

                    if (isReadOnly) return;

                    const input = document.getElementById("import-rule-json");

                    if (input) input.click();

                  }}

                  disabled={isReadOnly}

                >

                  Nhập vào bộ đang mở

                </Button>

              </label>

              <Button variant="outline" onClick={exportAllRules}>Xuất quy tắc (sao lưu)</Button>

              <label className="inline-flex items-center gap-2">

                <input

                  id="import-rules-collection"

                  type="file"

                  accept=".json"

                  className="hidden"

                  onChange={importAllRules}

                  disabled={isReadOnly}

                />

                <Button

                  variant="outline"

                  onClick={() => {

                    if (isReadOnly) return;

                    const input = document.getElementById("import-rules-collection");

                    if (input) input.click();

                  }}

                  disabled={isReadOnly}

                >

                  Khôi phục toàn bộ quy tắc

                </Button>

              </label>

              <Button

                variant="destructive"

                onClick={handleDeleteRule}

                disabled={isReadOnly || collection.sets.length <= 1}

              >

                Xóa bộ quy tắc

              </Button>

            </div>

          </div>



          <RulesTestWorkspacePanel
            workspace={testWorkspace}
            licenseOptions={licenseOptions}
            agencyOptions={agencyOptions}
          />



          <RulesHistoryPanel
            entries={historyEntries}
            loading={historyLoading}
            error={historyError}
            collapsed={historyCollapsed}
            expandedId={expandedHistoryId}
            isReadOnly={isReadOnly}
            restoringId={restoringId}
            onToggleCollapsed={() => setHistoryCollapsed((prev) => !prev)}
            onRefresh={handleHistoryRefresh}
            onToggleExpanded={setExpandedHistoryId}
            onRestoreEntry={handleRestoreEntry}
            formatTimestamp={formatHistoryTimestamp}
          />
        </CardContent>

      </Card>

    </div>

  );

}

