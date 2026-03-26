import React, { useCallback, useId, useMemo, useState } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.jsx";

import { Badge } from "@/components/ui/badge.jsx";

import { Button } from "@/components/ui/button.jsx";

import { Input } from "@/components/ui/input.jsx";

import RuleNumberInput from "@/components/rules-editor/controls/RuleNumberInput.jsx";
import RulesConfigTabsPanel from "@/components/rules-editor/RulesConfigTabsPanel.jsx";
import RulesHistoryPanel from "@/components/rules-editor/RulesHistoryPanel.jsx";
import RulesSimulationPanel from "@/components/rules-editor/RulesSimulationPanel.jsx";

import { computeKPI } from "@/lib/rules.js";

import { getData, getHQAgencies } from "@/lib/store.js";
import useRulesConfigState from "@/components/rules-editor/hooks/useRulesConfigState.js";
import useRulesEditorWorkflow from "@/components/rules-editor/hooks/useRulesEditorWorkflow.js";


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

  const manualLicenseListId = useId();

  const manualAgencyListId = useId();

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

  const testList = useMemo(() => {

    return data.map((row, index) => {

      const soTkRaw = row?.so_tk ?? row?.soToKhai ?? row?.soTK ?? row?.so_to_khai ?? "";

      const soTk = soTkRaw ? String(soTkRaw).trim() : "";

      const date = row?.date || row?.ngay || "";

      const company = row?.cong_ty || row?.company || row?.customer || "";

      const mst = row?.mst || "";

      const loai = row?.loai_hinh || row?.loaiHinh || "";

      const label = [date, soTk, mst, company, loai]

        .filter(Boolean)

        .join(" | ") || `Tờ khai ${index + 1}`;

      return {

        key: `${index}-${soTk}-${date}`,

        soTk,

        label,

        labelLower: label.toLowerCase(),

        soTkLower: soTk.toLowerCase(),

        row,

      };

    });

  }, [data]);



  const [testSearch, setTestSearch] = useState("");

  const [pickedKey, setPickedKey] = useState("");



  const filteredTestList = useMemo(() => {

    const keyword = testSearch.trim().toLowerCase();

    const base = keyword

      ? testList.filter((item) =>

          item.soTkLower.includes(keyword) || item.labelLower.includes(keyword)

        )

      : testList;

    return base.slice(0, 400);

  }, [testList, testSearch]);



  const firstMatch = useMemo(() => {

    const keyword = testSearch.trim().toLowerCase();

    if (!keyword) return null;

    return testList.find((item) => item.soTkLower.includes(keyword)) || null;

  }, [testList, testSearch]);



  const handleSearchSubmit = useCallback((event) => {

    event.preventDefault();

    if (firstMatch) {

      setPickedKey(firstMatch.key);

    } else if (testSearch.trim()) {

      alert("Không tìm thấy tờ khai khớp với số đã nhập.");

    }

  }, [firstMatch, testSearch]);



  const pickedEntry = useMemo(

    () => testList.find((item) => item.key === pickedKey) || null,

    [testList, pickedKey]

  );



  const pickedRow = pickedEntry?.row || null;

  const kpiPicked = pickedRow ? computeKPI(pickedRow, rule) : 0;



  const [manualType, setManualType] = useState("A11");

  const [manualItems, setManualItems] = useState(10);

  const [manualLicenses, setManualLicenses] = useState("ZB02,ZB03");

  const [manualAgency, setManualAgency] = useState("G&B");

  const [manualHasCO, setManualHasCO] = useState(true);

  const [manualCoLines, setManualCoLines] = useState(0);



  const manualRow = useMemo(() => {

    const codes = manualLicenses

      .split(",")

      .map((code) => code.trim().toUpperCase())

      .filter(Boolean);

    const coLines = Number(manualCoLines || 0);

    const hasCOFlag = manualHasCO || coLines > 0;

    return {

      loaiHinh: manualType,

      num_items: Number(manualItems || 0),

      licenseCodes: codes,

      agency: manualAgency,

      has_co: hasCOFlag,

      co: hasCOFlag ? "Có" : "",

      co_line_count: coLines,

    };

  }, [manualAgency, manualCoLines, manualHasCO, manualItems, manualLicenses, manualType]);



  const kpiManual = computeKPI(manualRow, rule);



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



          <div className="space-y-4 rounded border p-3">

            <div className="font-semibold">Test nhanh 1 tờ khai đã import</div>

            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearchSubmit}>

              <Input

                placeholder="Nhập số tờ khai để tìm"

                value={testSearch}

                onChange={(event) => setTestSearch(event.target.value)}

              />

              <Button type="submit" variant="outline">

                Tìm theo số tờ khai

              </Button>

            </form>

            <div className="text-xs text-gray-500">

              Hiển thị {filteredTestList.length} / {testList.length} tờ khai đã lưu

            </div>

            <select

              className="h-40 w-full rounded border p-2"

              size={8}

              value={pickedKey}

              onChange={(event) => setPickedKey(event.target.value)}

            >

              <option value="">-- Chọn 1 tờ khai --</option>

              {filteredTestList.map((item) => (

                <option key={item.key} value={item.key}>

                  {item.label}

                </option>

              ))}

            </select>

            <div className="text-sm">

              {pickedRow ? (

                <>

                  <div>

                    <b>Số tờ khai:</b> {pickedRow.so_tk || pickedRow.soToKhai || ""} &nbsp;

                    <b>Loại hình:</b> {pickedRow.loai_hinh || pickedRow.loaiHinh || ""} &nbsp;

                    <b>Mục hàng:</b> {pickedRow.num_items ?? pickedRow.muc_hang ?? 0} &nbsp;

                    <b>MST:</b> {pickedRow.mst || ""} &nbsp;

                    <b>Cty:</b> {pickedRow.cong_ty || pickedRow.company || ""}

                  </div>

                  <div className="mt-1">

                    <b>KẾT QUẢ:</b> {kpiPicked.toFixed(1)}

                  </div>

                </>

              ) : (

                <i>Chọn 1 dòng để test…</i>

              )}

            </div>

          </div>



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



          <div className="space-y-4 rounded border p-3">

            <div className="font-semibold">Test nhập tay</div>

            <div className="grid gap-4 md:grid-cols-2">

              <div>

                <label className="text-sm text-gray-600">Loại hình</label>

                <Input value={manualType} onChange={(event) => setManualType(event.target.value.toUpperCase())} />

              </div>

              <div>

                <label className="text-sm text-gray-600">Tổng số mục hàng</label>

                <RuleNumberInput step="1" value={manualItems} onChange={setManualItems} />

              </div>

              <div>

                <label className="text-sm text-gray-600">Mã giấy phép (phẩy)</label>

                <Input

                  value={manualLicenses}

                  onChange={(event) => setManualLicenses(event.target.value)}

                  list={manualLicenseListId}

                  placeholder="Ví dụ: ZB02,ZB03"

                />

                <datalist id={manualLicenseListId}>

                  {licenseOptions.map((item) => (

                    <option

                      key={`manual-license-${item.value}`}

                      value={item.value}

                      label={

                        item.count

                          ? `${item.value} (${item.count.toLocaleString("vi-VN")})`

                          : item.value

                      }

                    />

                  ))}

                </datalist>

              </div>

              <div>

                <label className="text-sm text-gray-600">Đại lý HQ</label>

                <Input

                  value={manualAgency}

                  onChange={(event) => setManualAgency(event.target.value)}

                  list={manualAgencyListId}

                  placeholder="Nhập hoặc chọn đại lý"

                />

                <datalist id={manualAgencyListId}>

                  {agencyOptions.map((item) => (

                    <option

                      key={`manual-agency-${item.value}`}

                      value={item.value}

                      label={item.hint ? `${item.value} – ${item.hint}` : item.value}

                    />

                  ))}

                </datalist>

              </div>

              <div className="flex items-center gap-2 text-sm">

                <label className="inline-flex items-center gap-2">

                  <input

                    type="checkbox"

                    checked={manualHasCO}

                    onChange={(event) => setManualHasCO(event.target.checked)}

                  />

                  Có C/O

                </label>

              </div>

              <div>

                <label className="text-sm text-gray-600">Số dòng áp C/O</label>

                <RuleNumberInput step="1" value={manualCoLines} onChange={setManualCoLines} />

                <div className="text-xs text-gray-500 mt-1">

                  Điểm C/O theo dòng = số dòng × điểm mỗi dòng.

                </div>

              </div>

            </div>

            <div>

              <b>KẾT QUẢ:</b> {kpiManual.toFixed(1)}

            </div>

            <div className="text-xs text-gray-500">

              * Kết quả = Điểm cơ bản + (số mục hàng × điểm mỗi mục) + điểm giấy phép (áp dụng loại trừ) + điểm C/O (nếu bật).

            </div>

          </div>

        </CardContent>

      </Card>

    </div>

  );

}

