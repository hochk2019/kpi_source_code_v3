import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import { InfoIcon } from "lucide-react";
import {
  loadRuleSets,
  loadRules,
  saveRules,
  setDefaultRule,
  createRuleTemplate,
  computeKPI,
  deleteRule,
  exportRuleCollection,
  restoreRuleCollection,
} from "@/lib/rules.js";
import { getData } from "@/lib/store.js";

function Num({ value, onChange, step = "0.1", disabled = false }) {
  const display = value === 0 ? 0 : value ?? "";
  return (
    <input
      type="number"
      step={step}
      value={display}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") {
          onChange("");
          return;
        }
        const parsed = Number(raw);
        onChange(Number.isFinite(parsed) ? parsed : 0);
      }}
      className="w-full rounded border p-2"
    />
  );
}

function TierEditor({ tiers = [], onChange, disabled = false, title = "Bậc cộng thêm" }) {
  const safeTiers = Array.isArray(tiers) ? tiers : [];

  const handleAdd = () => {
    onChange([...safeTiers, { from: 11, to: 20, add: 0.5 }]);
  };

  const handleDelete = (index) => {
    onChange(safeTiers.filter((_, idx) => idx !== index));
  };

  const handleChange = (index, key, value) => {
    onChange(
      safeTiers.map((tier, idx) =>
        idx === index
          ? { ...tier, [key]: value }
          : tier
      )
    );
  };

  if (!safeTiers.length && disabled) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="font-medium">{title}</div>
      <div className="grid grid-cols-12 gap-2 items-center text-sm font-medium">
        <div className="col-span-3">Từ</div>
        <div className="col-span-3">Đến</div>
        <div className="col-span-3">Cộng (+)</div>
        <div className="col-span-3" />
      </div>
      {safeTiers.map((tier, index) => (
        <div key={`${index}-${tier.from}-${tier.to}`} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-3">
            <Num step="1" value={tier.from} onChange={(val) => handleChange(index, "from", val)} disabled={disabled} />
          </div>
          <div className="col-span-3">
            <Num step="1" value={tier.to} onChange={(val) => handleChange(index, "to", val)} disabled={disabled} />
          </div>
          <div className="col-span-3">
            <Num value={tier.add} onChange={(val) => handleChange(index, "add", val)} disabled={disabled} />
          </div>
          <div className="col-span-3">
            {!disabled && (
              <Button variant="outline" onClick={() => handleDelete(index)}>
                Xóa
              </Button>
            )}
          </div>
        </div>
      ))}
      {!disabled && (
        <Button variant="outline" onClick={handleAdd}>
          Thêm bậc
        </Button>
      )}
    </div>
  );
}

function LicensePointTable({ config, onChange, disabled }) {
  const entries = Array.isArray(config?.codePoints) ? config.codePoints : [];

  const updateEntry = (index, key, value) => {
    const next = entries.map((entry, idx) =>
      idx === index
        ? { ...entry, [key]: key === "code" ? value.toUpperCase() : value }
        : entry
    );
    onChange({ ...config, codePoints: next });
  };

  const addEntry = () => {
    onChange({
      ...config,
      codePoints: [...entries, { code: "", points: config?.defaultPoints ?? 0 }],
    });
  };

  const deleteEntry = (index) => {
    onChange({
      ...config,
      codePoints: entries.filter((_, idx) => idx !== index),
    });
  };

  return (
    <div className="space-y-2">
      <div className="font-medium">Điểm theo từng mã giấy phép</div>
      {entries.length === 0 && disabled ? (
        <div className="text-sm text-gray-500">Không có cấu hình riêng cho mã giấy phép.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={`${entry.code}-${index}`} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6">
                <Input
                  value={entry.code || ""}
                  disabled={disabled}
                  onChange={(event) => updateEntry(index, "code", event.target.value)}
                  placeholder="Ví dụ: ZB02"
                />
              </div>
              <div className="col-span-4">
                <Num
                  value={entry.points}
                  onChange={(val) => updateEntry(index, "points", val)}
                  disabled={disabled}
                />
              </div>
              <div className="col-span-2">
                {!disabled && (
                  <Button variant="outline" onClick={() => deleteEntry(index)}>
                    Xóa
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!disabled && (
        <Button variant="outline" onClick={addEntry}>
          Thêm mã giấy phép
        </Button>
      )}
    </div>
  );
}

function AgencyExcludeEditor({ agencies, onChange, disabled }) {
  const list = Array.isArray(agencies) ? agencies : [];

  const updateEntry = (index, key, value) => {
    const next = list.map((entry, idx) =>
      idx === index
        ? {
            ...entry,
            [key]: key === "codes"
              ? value
                  .split(",")
                  .map((code) => code.trim().toUpperCase())
                  .filter(Boolean)
              : value.toUpperCase(),
          }
        : entry
    );
    onChange(next);
  };

  const addEntry = () => {
    onChange([...list, { agency: "", codes: [] }]);
  };

  const deleteEntry = (index) => {
    onChange(list.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-2">
      <div className="font-medium">Loại trừ theo đại lý hải quan</div>
      <div className="text-xs text-gray-500">
        Khi đại lý khớp với tên trong danh sách, các mã giấy phép tương ứng sẽ không được cộng điểm.
      </div>
      {list.length === 0 && disabled ? (
        <div className="text-sm text-gray-500">Không có đại lý bị loại trừ.</div>
      ) : (
        <div className="space-y-3">
          {list.map((entry, index) => (
            <div key={`${entry.agency || "agency"}-${index}`} className="grid gap-2 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Tên đại lý</label>
                <Input
                  value={entry.agency || ""}
                  disabled={disabled}
                  onChange={(event) => updateEntry(index, "agency", event.target.value)}
                  placeholder="Ví dụ: G&B"
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-sm text-gray-600">Mã giấy phép (phẩy)</label>
                <Input
                  value={(entry.codes || []).join(",")}
                  disabled={disabled}
                  onChange={(event) => updateEntry(index, "codes", event.target.value)}
                  placeholder="Ví dụ: ZB02,ZB03"
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                {!disabled && (
                  <Button variant="outline" onClick={() => deleteEntry(index)} className="w-full">
                    Xóa
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!disabled && (
        <Button variant="outline" onClick={addEntry}>
          Thêm đại lý loại trừ
        </Button>
      )}
    </div>
  );
}

export default function RulesEditor({ canEdit = true, currentUser = null }) {
  const actor = currentUser?.username || "guest";
  const [version, setVersion] = useState(0);
  const [collection, setCollection] = useState(() => loadRuleSets());
  const [activeTab, setActiveTab] = useState(collection.activeId);
  const [rule, setRule] = useState(() => loadRules(collection.activeId));
  const [applyNow, setApplyNow] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const nextCollection = loadRuleSets();
    setCollection(nextCollection);
    const currentTabValid = nextCollection.sets.some((entry) => entry.id === activeTab);
    const tabId = currentTabValid ? activeTab : nextCollection.activeId;
    if (tabId !== activeTab) {
      setActiveTab(tabId);
    }
    setRule(loadRules(tabId));
    setApplyNow(false);
    setDirty(false);
  }, [version, activeTab]);

  const isReadOnly = !canEdit;

  const data = useMemo(() => getData(), []);
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

  const handleSelectTab = (ruleId) => {
    if (ruleId === activeTab) return;
    if (dirty && !isReadOnly) {
      const proceed = window.confirm(
        "Bạn có thay đổi chưa lưu. Chuyển sang bộ quy tắc khác sẽ bỏ các thay đổi này. Bạn có chắc chắn?"
      );
      if (!proceed) return;
    }
    setActiveTab(ruleId);
    setRule(loadRules(ruleId));
    setApplyNow(false);
    setDirty(false);
  };

  const updateRule = (updater) => {
    setRule((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
    setDirty(true);
  };

  const updateGroup = (groupKey, updater) => {
    updateRule((prev) => {
      const group = prev.groups?.[groupKey] || {};
      const nextGroup = typeof updater === "function" ? updater(group) : updater;
      return {
        ...prev,
        groups: {
          ...prev.groups,
          [groupKey]: nextGroup,
        },
      };
    });
  };

  const handleCodesChange = (groupKey, value) => {
    const codes = value
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    updateGroup(groupKey, (group) => ({ ...group, codes }));
  };

  const handleGroupNumber = (groupKey, key, value) => {
    updateGroup(groupKey, (group) => ({ ...group, [key]: value }));
  };

  const handleLicenseChange = (updater) => {
    updateRule((prev) => ({
      ...prev,
      license: typeof updater === "function" ? updater(prev.license || {}) : updater,
    }));
  };

  const handleAgencyChange = (nextList) => {
    handleLicenseChange((license) => ({
      ...license,
      exclude: {
        codes: license.exclude?.codes || [],
        agencies: nextList,
      },
    }));
  };

  const groups = rule?.groups || {};
  const licenseConfig = rule?.license || { defaultPoints: 0, codePoints: [], exclude: { codes: [], agencies: [] } };

  const handleSave = () => {
    if (isReadOnly) {
      alert("Bạn không có quyền chỉnh sửa quy tắc KPI.");
      return;
    }
    const recalcFrom = applyNow && rule.applyFrom ? rule.applyFrom : "";
    saveRules(rule, {
      actor,
      recalcFrom,
      setAsDefault: collection.activeId === rule.id,
    });
    setVersion((prev) => prev + 1);
    alert(
      `Đã lưu bộ quy tắc ${rule.name}${recalcFrom ? ` và tính lại KPI từ ${recalcFrom}` : ""}.`
    );
  };

  const handleReset = () => {
    if (isReadOnly) return;
    setRule(loadRules(activeTab));
    setApplyNow(false);
    setDirty(false);
  };

  const handleSetDefault = (event) => {
    const nextId = event.target.value;
    const updated = setDefaultRule(nextId, { actor });
    setCollection(updated);
    setActiveTab(nextId);
    setRule(loadRules(nextId));
    setApplyNow(false);
    setDirty(false);
  };

  const handleSetDefaultButton = () => {
    if (collection.activeId === rule.id) return;
    const updated = setDefaultRule(rule.id, { actor });
    setCollection(updated);
    alert(`Đã đặt "${rule.name}" làm bộ quy tắc mặc định.`);
  };

  const handleDeleteRule = () => {
    if (isReadOnly) return;
    if (!rule?.id) return;
    if (collection.sets.length <= 1) {
      alert("Không thể xóa bộ quy tắc cuối cùng.");
      return;
    }
    const confirmMessage = `Bạn chắc chắn muốn xóa bộ quy tắc "${rule.name || rule.id}"?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    const removedName = rule.name || rule.id;
    try {
      const updated = deleteRule(rule.id, { actor });
      setCollection(updated);
      const nextActiveId = updated.activeId || updated.sets[0]?.id || null;
      if (nextActiveId) {
        setActiveTab(nextActiveId);
        setRule(loadRules(nextActiveId));
      } else {
        setRule(loadRules());
      }
      setApplyNow(false);
      setDirty(false);
      setVersion((prev) => prev + 1);
      alert(`Đã xóa bộ quy tắc ${removedName}.`);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Không thể xóa bộ quy tắc.");
    }
  };

  const exportCurrentRule = () => {
    const blob = new Blob([JSON.stringify(rule, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${rule.name || "kpi_rules"}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const importCurrentRule = (event) => {
    if (isReadOnly) {
      alert("Bạn không có quyền import quy tắc.");
      return;
    }
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        saveRules({ ...parsed, id: rule.id }, { actor, appendHistory: false });
        setVersion((prev) => prev + 1);
        alert("Đã import và áp dụng dữ liệu cho bộ quy tắc hiện tại.");
      } catch (err) {
        console.error(err);
        alert("File JSON không hợp lệ.");
      }
      input.value = "";
    };
    reader.onerror = () => {
      alert("Không thể đọc file JSON.");
      input.value = "";
    };
    reader.readAsText(file);
  };

  const exportAllRules = () => {
    const collection = exportRuleCollection();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `kpi-rules-backup-${timestamp}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const importAllRules = (event) => {
    if (isReadOnly) {
      alert("Bạn không có quyền khôi phục quy tắc.");
      return;
    }
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const proceed = window.confirm(
          "Khôi phục toàn bộ bộ quy tắc từ file sẽ ghi đè dữ liệu hiện tại. Bạn có chắc chắn?"
        );
        if (!proceed) {
          return;
        }
        const restored = restoreRuleCollection(parsed, { actor });
        setCollection(restored);
        setActiveTab(restored.activeId);
        setRule(loadRules(restored.activeId));
        setApplyNow(false);
        setDirty(false);
        setVersion((prev) => prev + 1);
        alert("Đã khôi phục toàn bộ bộ quy tắc từ file sao lưu.");
      } catch (err) {
        console.error(err);
        alert("File sao lưu không hợp lệ.");
      } finally {
        input.value = "";
      }
    };
    reader.onerror = () => {
      alert("Không thể đọc file sao lưu.");
      input.value = "";
    };
    reader.readAsText(file);
  };

  const handleAddRule = () => {
    if (isReadOnly) return;
    const template = createRuleTemplate(rule, {
      name: `Rule mới ${collection.sets.length + 1}`,
    });
    const saved = saveRules(template, { actor, appendHistory: false });
    setActiveTab(saved.id);
    setVersion((prev) => prev + 1);
  };

  const isDefaultRule = collection.activeId === rule.id;

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

          <div className="grid gap-6 md:grid-cols-3">
            {Object.entries(groups).map(([groupKey, groupConfig]) => (
              <div key={groupKey} className="space-y-3 rounded border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{groupConfig.title || groupKey}</div>
                    {groupConfig.description && (
                      <div className="text-xs text-gray-500">{groupConfig.description}</div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Mã loại hình (phẩy)</label>
                  <Input
                    value={(groupConfig.codes || []).join(",")}
                    onChange={(event) => handleCodesChange(groupKey, event.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Điểm cơ bản mỗi tờ khai</label>
                  <Num
                    value={groupConfig.base}
                    onChange={(val) => handleGroupNumber(groupKey, "base", val)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Điểm cộng theo mỗi mục hàng</label>
                  <Num
                    value={groupConfig.perItem}
                    onChange={(val) => handleGroupNumber(groupKey, "perItem", val)}
                    disabled={isReadOnly}
                  />
                </div>
                {groupConfig.perItem === 0 && groupConfig.tiers?.length ? (
                  <div className="rounded border border-dashed p-2">
                    <div className="text-xs text-gray-500 mb-2">
                      Nhóm này đang sử dụng cấu hình bậc thay vì điểm theo mục hàng.
                    </div>
                    <TierEditor
                      tiers={groupConfig.tiers}
                      onChange={(nextTiers) => handleGroupNumber(groupKey, "tiers", nextTiers)}
                      disabled={isReadOnly}
                      title="Các bậc cộng thêm"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded border p-3">
            <div className="font-semibold">Cấu hình điểm giấy phép</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm text-gray-600">Điểm mặc định mỗi loại giấy phép</label>
                <Num
                  value={licenseConfig.defaultPoints}
                  onChange={(val) => handleLicenseChange({
                    ...licenseConfig,
                    defaultPoints: val,
                  })}
                  disabled={isReadOnly}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Các mã giấy phép bị loại trừ (phẩy)</label>
                <Input
                  value={(licenseConfig.exclude?.codes || []).join(",")}
                  onChange={(event) => handleLicenseChange({
                    ...licenseConfig,
                    exclude: {
                      ...licenseConfig.exclude,
                      codes: event.target.value
                        .split(",")
                        .map((code) => code.trim().toUpperCase())
                        .filter(Boolean),
                      agencies: licenseConfig.exclude?.agencies || [],
                    },
                  })}
                  disabled={isReadOnly}
                />
              </div>
            </div>
            <LicensePointTable
              config={licenseConfig}
              onChange={(next) => handleLicenseChange(next)}
              disabled={isReadOnly}
            />
            <AgencyExcludeEditor
              agencies={licenseConfig.exclude?.agencies || []}
              onChange={handleAgencyChange}
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-3 rounded border p-3">
            <div className="font-semibold">Điểm cộng thêm</div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rule?.bonuses?.co?.enabled ?? false}
                onChange={(event) =>
                  updateRule({
                    ...rule,
                    bonuses: {
                      ...rule.bonuses,
                      co: {
                        ...rule.bonuses?.co,
                        enabled: event.target.checked,
                      },
                    },
                  })
                }
                disabled={isReadOnly}
              />
              Cộng điểm khi tờ khai có C/O
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-gray-600">Điểm cộng mỗi tờ khai có C/O</label>
                <Num
                  value={rule?.bonuses?.co?.points ?? 0}
                  onChange={(val) =>
                    updateRule({
                      ...rule,
                      bonuses: {
                        ...rule.bonuses,
                        co: {
                          ...rule.bonuses?.co,
                          points: val,
                        },
                      },
                    })
                  }
                  disabled={isReadOnly || !(rule?.bonuses?.co?.enabled ?? false)}
                />
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <span>Điểm cộng mỗi dòng áp C/O</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:text-gray-700"
                        aria-label="Giải thích cách tính điểm C/O theo dòng"
                      >
                        <InfoIcon className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs leading-relaxed">
                      Điểm thưởng C/O = số dòng hàng áp C/O × giá trị cấu hình tại đây. Ví dụ: 5 dòng và mỗi dòng 0.05 điểm sẽ được cộng thêm 0.25 điểm.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Num
                  value={rule?.bonuses?.co?.perLine ?? 0}
                  onChange={(val) =>
                    updateRule({
                      ...rule,
                      bonuses: {
                        ...rule.bonuses,
                        co: {
                          ...rule.bonuses?.co,
                          perLine: val,
                        },
                      },
                    })
                  }
                  disabled={isReadOnly || !(rule?.bonuses?.co?.enabled ?? false)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Điểm này nhân với số dòng hàng áp C/O trong tờ khai.
                </div>
              </div>
            </div>
          </div>

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

          <div className="space-y-4 rounded border p-3">
            <div className="font-semibold">Test nhập tay</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-gray-600">Loại hình</label>
                <Input value={manualType} onChange={(event) => setManualType(event.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Tổng số mục hàng</label>
                <Num step="1" value={manualItems} onChange={setManualItems} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Mã giấy phép (phẩy)</label>
                <Input value={manualLicenses} onChange={(event) => setManualLicenses(event.target.value)} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Đại lý HQ</label>
                <Input value={manualAgency} onChange={(event) => setManualAgency(event.target.value)} />
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
                <Num step="1" value={manualCoLines} onChange={setManualCoLines} />
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
