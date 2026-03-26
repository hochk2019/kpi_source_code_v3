import React, { useId } from "react";

import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import RuleNumberInput from "@/components/rules-editor/controls/RuleNumberInput.jsx";

export default function RulesTestWorkspacePanel({
  workspace,
  licenseOptions = [],
  agencyOptions = [],
}) {
  const manualLicenseListId = useId();
  const manualAgencyListId = useId();

  const {
    filteredTestList,
    handleSearchSubmit,
    kpiManual,
    kpiPicked,
    manualAgency,
    manualCoLines,
    manualHasCO,
    manualItems,
    manualLicenses,
    manualType,
    pickedKey,
    pickedRow,
    setManualAgency,
    setManualCoLines,
    setManualHasCO,
    setManualItems,
    setManualLicenses,
    setManualType,
    setPickedKey,
    setTestSearch,
    testList,
    testSearch,
  } = workspace;

  return (
    <>
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

      <div className="space-y-4 rounded border p-3">
        <div className="font-semibold">Test nhập tay</div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-gray-600">Loại hình</label>
            <Input
              value={manualType}
              onChange={(event) => setManualType(event.target.value.toUpperCase())}
            />
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
          * Kết quả = Điểm cơ bản + (số mục hàng × điểm mỗi mục) + điểm giấy phép (áp dụng loại
          trừ) + điểm C/O (nếu bật).
        </div>
      </div>
    </>
  );
}
