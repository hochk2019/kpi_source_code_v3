import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import {
  DEFAULT_RULES,
  loadRules,
  saveRules,
  computeKPI,
} from "@/lib/rules.js";
import { getData, setData, K_RULES } from "@/lib/store.js";

/* Input number an toàn */
function Num({ value, onChange, step = "0.1" }) {
  const v = value === 0 ? 0 : (value ?? "");
  return (
    <input
      type="number"
      step={step}
      value={v}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange("");
        const n = Number(raw);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      className="border rounded p-2 w-full"
    />
  );
}

/* ------- SỬA LỖI Ở ĐÂY: LUÔN TRẢ VỀ ARRAY, KHÔNG TRUYỀN FUNCTION ------- */
function TierEditor({ title, tiers = [], setTiers, hint, cumulative = false }) {
  const safeTiers = Array.isArray(tiers) ? tiers : [];

  const addRow = () =>
    setTiers([...safeTiers, { from: 11, to: 20, add: 0.5 }]);

  const delRow = (i) => {
    const arr = safeTiers.filter((_, j) => j !== i);
    setTiers(arr);
  };

  const updCell = (i, key, val) => {
    const arr = safeTiers.map((t, j) => (j === i ? { ...t, [key]: val } : t));
    setTiers(arr);
  };

  return (
    <div className="space-y-2">
      <div className="font-medium">{title}</div>
      {hint && <div className="text-xs text-gray-500">{hint}</div>}

      <div className="grid grid-cols-12 gap-2 items-center">
        <div className="col-span-3 font-medium">Từ</div>
        <div className="col-span-3 font-medium">Đến</div>
        <div className="col-span-3 font-medium">Cộng (+)</div>
        <div className="col-span-3" />

        {safeTiers.map((t, i) => (
          <React.Fragment key={i}>
            <div className="col-span-3">
              <Num step="1" value={t.from} onChange={(v) => updCell(i, "from", v)} />
            </div>
            <div className="col-span-3">
              <Num step="1" value={t.to} onChange={(v) => updCell(i, "to", v)} />
            </div>
            <div className="col-span-3">
              <Num value={t.add} onChange={(v) => updCell(i, "add", v)} />
            </div>
            <div className="col-span-3">
              <Button variant="outline" onClick={() => delRow(i)}>Xóa</Button>
            </div>
          </React.Fragment>
        ))}
      </div>

      <Button variant="outline" onClick={addRow}>Thêm bậc</Button>
      {cumulative && (
        <div className="text-xs text-emerald-700 mt-2">
          * Nhóm này <b>cộng dồn</b> theo từng bậc.
        </div>
      )}
    </div>
  );
}

export default function RulesEditor() {
  const [rules, setRules] = useState(loadRules());
  const [applyFrom, setApplyFrom] = useState(rules.applyFrom || "");
  const [applyNow, setApplyNow] = useState(false);

  // Test nhanh từ dữ liệu đã import
  const data = getData();
  const testList = useMemo(() => {
    return data.map((r) => ({
      key: `${r.date || ""} || ${r.soToKhai || ""} || ${r.customer || ""} || ${r.loaiHinh || ""}`,
      row: r,
    })).slice(0, 300);
  }, [data]);

  const [pickedIdx, setPickedIdx] = useState(-1);
  const picked = pickedIdx >= 0 ? testList[pickedIdx]?.row : null;
  const kpiPicked = picked ? computeKPI(picked, rules) : 0;

  // Test nhập tay
  const [testLH, setTestLH] = useState("A11");
  const [testItems, setTestItems] = useState(10);
  const [testLicenses, setTestLicenses] = useState("QC, HN, HOACHAT");
  const testRowManual = useMemo(() => {
    const codes = testLicenses.split(",").map((s) => s.trim()).filter(Boolean);
    return { loaiHinh: testLH, num_items: Number(testItems || 0), licenseCodes: codes };
  }, [testLH, testItems, testLicenses]);
  const kpiManual = computeKPI(testRowManual, rules);

  // Helper cập nhật sâu
  const upd = (path, val) => {
    setRules((r) => {
      const cloned = structuredClone(r);
      const seg = path.split(".");
      let ref = cloned;
      for (let i = 0; i < seg.length - 1; i++) ref = ref[seg[i]];
      ref[seg.at(-1)] = val;
      return cloned;
    });
  };

  const onSave = () => {
    const newRules = { ...rules, applyFrom: (applyFrom || "").trim() };
    // Lưu + tùy chọn tính lại từ ngày applyFrom
    saveRules(newRules, {
      appendHistory: true,
      recalcFrom: applyNow && applyFrom ? applyFrom : ""
    });
    alert(`Đã lưu quy tắc${applyNow && applyFrom ? ` và tính lại KPI từ ${applyFrom}` : ""}.`);
  };

  const onReset = () => {
    setRules(DEFAULT_RULES);
    setApplyFrom(DEFAULT_RULES.applyFrom || "");
    setApplyNow(false);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kpi_rules.json";
    a.click();
  };

  const importJSON = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const obj = JSON.parse(ev.target.result);
        setRules(obj);
        setApplyFrom(obj.applyFrom || "");
      } catch {
        alert("File JSON không hợp lệ.");
      }
    };
    reader.readAsText(f);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quy tắc KPI (chuẩn + có thể điều chỉnh)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Nhóm 1 */}
          <div className="space-y-3 border rounded p-3">
            <div className="font-semibold">Nhóm 1</div>
            <label className="text-sm">Mã loại hình (phẩy):</label>
            <Input
              value={(rules.groups.group1.codes || []).join(",")}
              onChange={(e) =>
                upd("groups.group1.codes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
              }
            />
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm">Điểm cơ bản</label>
                <Num value={rules.groups.group1.base} onChange={(v) => upd("groups.group1.base", v)} />
              </div>
            </div>
            <TierEditor
              title="Bậc cộng theo mục hàng (tuỳ chọn)"
              tiers={rules.groups.group1.tiers}
              setTiers={(arr) => upd("groups.group1.tiers", arr)}
              hint="Mặc định để trống (đúng quy tắc cũ). Nếu thêm bậc, hệ thống áp dụng bậc cao nhất thỏa (không cộng dồn)."
            />
          </div>

          {/* Nhóm 2 */}
          <div className="space-y-3 border rounded p-3">
            <div className="font-semibold">Nhóm 2</div>
            <label className="text-sm">Mã loại hình (phẩy):</label>
            <Input
              value={(rules.groups.group2.codes || []).join(",")}
              onChange={(e) =>
                upd("groups.group2.codes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
              }
            />
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm">Điểm cơ bản</label>
                <Num value={rules.groups.group2.base} onChange={(v) => upd("groups.group2.base", v)} />
              </div>
            </div>
            <TierEditor
              title="Bậc cộng theo mục hàng"
              tiers={rules.groups.group2.tiers}
              setTiers={(arr) => upd("groups.group2.tiers", arr)}
              hint="Mặc định: +0.5 cho 31–50 (không cộng dồn). Bạn có thể sửa các bậc này."
            />
          </div>

          {/* Nhóm 3 & 4 (cộng dồn) */}
          <div className="space-y-3 border rounded p-3">
            <div className="font-semibold">Nhóm 3 & 4</div>
            <label className="text-sm">Mã loại hình (phẩy):</label>
            <Input
              value={(rules.groups.group34.codes || []).join(",")}
              onChange={(e) =>
                upd("groups.group34.codes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
              }
            />
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm">Điểm cơ bản (1–10 mục hàng)</label>
                <Num value={rules.groups.group34.base} onChange={(v) => upd("groups.group34.base", v)} />
              </div>
            </div>
            <TierEditor
              title="Bậc cộng dồn theo mục hàng"
              tiers={rules.groups.group34.tiers}
              setTiers={(arr) => upd("groups.group34.tiers", arr)}
              hint="Chuẩn: +0.5 cho mỗi bậc 11–20, 21–30, 31–40, 41–50 (CỘNG DỒN)."
              cumulative
            />
          </div>

          {/* Điểm giấy phép */}
          <div className="space-y-3 border rounded p-3">
            <div className="font-semibold">Điểm giấy phép</div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm">Mỗi LOẠI giấy phép (+)</label>
                <Num value={rules.license.perType} onChange={(v) => upd("license.perType", v)} />
              </div>
              <div>
                <label className="text-sm">Tối đa số LOẠI tính điểm</label>
                <Num value={rules.license.maxTypes} onChange={(v) => upd("license.maxTypes", v)} step="1" />
              </div>
              <div className="md:col-span-3">
                <label className="text-sm">Mã giấy phép KHÔNG tính (phẩy) — ví dụ: ZN02, HDGC</label>
                <Input
                  value={(rules.license.excludeCodes || []).join(",")}
                  onChange={(e) =>
                    upd(
                      "license.excludeCodes",
                      e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    )
                  }
                />
              </div>
            </div>
          </div>

          {/* Áp dụng từ ngày… + Lưu */}
          <div className="space-y-2 border rounded p-3">
            <div className="font-semibold">Áp dụng</div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm">Áp dụng từ ngày (yyyy-mm-dd)</label>
                <Input
                  value={applyFrom}
                  onChange={(e) => setApplyFrom(e.target.value)}
                  placeholder="yyyy-mm-dd"
                />
              </div>
              <label className="inline-flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={applyNow}
                  onChange={(e) => setApplyNow(e.target.checked)}
                />
                Tính lại KPI cho dữ liệu từ ngày này sau khi Lưu
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={onSave}>Lưu</Button>
              <Button variant="outline" onClick={onReset}>Khôi phục mặc định</Button>
              <Button variant="outline" onClick={exportJSON}>Export JSON</Button>
              <label className="inline-flex items-center gap-2">
                <input id="impjson" className="hidden" type="file" accept=".json" onChange={importJSON} />
                <Button variant="outline" onClick={() => document.getElementById("impjson").click()}>
                  Import JSON
                </Button>
              </label>
            </div>
          </div>

          {/* Test nhanh */}
          <div className="space-y-4 border rounded p-3">
            <div className="font-semibold">Test nhanh 1 tờ khai đã import</div>
            <select
              className="border rounded p-2 w-full h-40"
              size={8}
              value={pickedIdx}
              onChange={(e) => setPickedIdx(Number(e.target.value))}
            >
              {testList.map((x, i) => (
                <option key={i} value={i}>{x.key}</option>
              ))}
            </select>
            <div className="text-sm">
              {picked ? (
                <>
                  <div>
                    <b>Loại hình:</b> {picked.loaiHinh} &nbsp;
                    <b>Mục hàng:</b> {picked.num_items || 0} &nbsp;
                    <b>MST:</b> {picked.mst || ""} &nbsp;
                    <b>Cty:</b> {picked.customer || ""}
                  </div>
                  <div className="mt-1"><b>KẾT QUẢ:</b> {kpiPicked}</div>
                </>
              ) : <i>Chọn 1 dòng để test…</i>}
            </div>
          </div>

          {/* Test nhập tay */}
          <div className="space-y-4 border rounded p-3">
            <div className="font-semibold">Test nhập tay</div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm">Loại hình</label>
                <Input value={testLH} onChange={(e) => setTestLH(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Tổng số mục hàng</label>
                <Num step="1" value={testItems} onChange={setTestItems} />
              </div>
              <div>
                <label className="text-sm">Mã giấy phép (phẩy) – ví dụ: QC, VN, HOACHAT</label>
                <Input value={testLicenses} onChange={(e) => setTestLicenses(e.target.value)} />
              </div>
            </div>
            <div><b>KẾT QUẢ:</b> {kpiManual}</div>
            <div className="text-xs text-gray-500">
              * Kết quả = Điểm cơ bản + cộng theo bậc + (số LOẠI GP hợp lệ × điểm mỗi LOẠI).
              Áp dụng danh sách loại trừ & giới hạn tối đa.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
