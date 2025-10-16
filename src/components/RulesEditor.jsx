import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.jsx";
import { InfoIcon, Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { toast } from "@/shared/toast";
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
  restoreRuleVersion,
  getRulesHistory,
  fetchRulesHistoryFromServer,
} from "@/lib/rules.js";
import { getData, getHQAgencies, parseAgencyList } from "@/lib/store.js";
import { cn } from "@/lib/utils.js";

const EMPTY_GROUP_MAP = Object.freeze({});

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

function formatHistoryTimestamp(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN", { hour12: false });
  } catch (err) {
    console.warn("Không thể định dạng thời gian lịch sử quy tắc", value, err);
    return value;
  }
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

function CodeMultiSelect({
  value = [],
  onChange,
  options = [],
  disabled = false,
  placeholder = "Chọn mã loại hình",
  searchPlaceholder = "Tìm mã loại hình",
  listHeading = "Mã loại hình đã đồng bộ",
  emptyLabel = "Không tìm thấy mã phù hợp.",
  addLabel = "Thêm mã",
}) {
  const selected = useMemo(() => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean);
  }, [value]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const normalizedOptions = useMemo(() => {
    return options
      .map((item) => ({
        value: String(item?.value || "").trim().toUpperCase(),
        count: Number.isFinite(item?.count) ? Number(item.count) : 0,
        label: item?.label || "",
      }))
      .filter((item) => item.value)
      .reduce((list, item) => {
        if (list.some((entry) => entry.value === item.value)) return list;
        return [...list, item];
      }, [])
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.value.localeCompare(b.value);
      });
  }, [options]);

  const handleToggle = useCallback(
    (code) => {
      if (disabled) return;
      const upper = String(code || "").trim().toUpperCase();
      if (!upper) return;
      const next = selected.includes(upper)
        ? selected.filter((item) => item !== upper)
        : [...selected, upper];
      onChange?.(next.sort((a, b) => a.localeCompare(b)));
    },
    [disabled, onChange, selected]
  );

  const handleAddCustom = useCallback(() => {
    if (disabled) return;
    const upper = search.trim().toUpperCase();
    if (!upper) return;
    if (selected.includes(upper)) {
      setOpen(false);
      return;
    }
    onChange?.([...selected, upper].sort((a, b) => a.localeCompare(b)));
    setSearch("");
    setOpen(false);
  }, [disabled, onChange, search, selected]);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const canAddCustom = useMemo(() => {
    const upper = search.trim().toUpperCase();
    if (!upper) return false;
    if (selected.includes(upper)) return false;
    return !normalizedOptions.some((item) => item.value === upper);
  }, [normalizedOptions, search, selected]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate text-left">
              {selected.length
                ? `${selected.length} mã đã chọn`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
            />
            <CommandList className="max-h-64 overflow-y-auto">
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              {canAddCustom ? (
                <CommandGroup heading="Thêm mới">
                  <CommandItem value={search} onSelect={handleAddCustom}>
                    <Plus className="mr-2 size-4" />
                    {addLabel} "{search.trim().toUpperCase()}"
                  </CommandItem>
                </CommandGroup>
              ) : null}
              <CommandGroup heading={listHeading}>
                {normalizedOptions.map((item) => {
                  const isSelected = selected.includes(item.value);
                  return (
                    <CommandItem
                      key={item.value}
                      value={`${item.value} ${item.label}`.trim()}
                      onSelect={() => handleToggle(item.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="font-medium">{item.value}</span>
                        {item.label ? (
                          <span className="text-xs text-muted-foreground">
                            {item.label}
                          </span>
                        ) : null}
                      </div>
                      {item.count ? (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {item.count.toLocaleString("vi-VN")} tờ
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((code) => (
            <Badge key={code} variant="secondary" className="flex items-center gap-1">
              {code}
              {!disabled && (
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground transition hover:bg-white hover:text-red-600"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleToggle(code);
                  }}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Chưa chọn mã nào.</div>
      )}
    </div>
  );
}

function LicenseCodeInput({ value, onChange, options = [], placeholder = "Ví dụ: ZB02", disabled = false }) {
  const listId = useId();
  const normalizedOptions = useMemo(() => {
    return options
      .map((item) => ({
        value: String(item?.value || "").trim().toUpperCase(),
        count: Number.isFinite(item?.count) ? Number(item.count) : 0,
      }))
      .filter((item) => item.value);
  }, [options]);

  return (
    <>
      <Input
        value={value || ""}
        onChange={(event) => onChange?.(event.target.value.toUpperCase())}
        placeholder={placeholder}
        list={listId}
        disabled={disabled}
      />
      <datalist id={listId}>
        {normalizedOptions.map((item) => (
          <option
            key={item.value}
            value={item.value}
            label={
              item.count
                ? `${item.value} (${item.count.toLocaleString("vi-VN")})`
                : item.value
            }
          />
        ))}
      </datalist>
    </>
  );
}

function AgencyInput({ value, onChange, options = [], placeholder = "Ví dụ: G&B", disabled = false }) {
  const listId = useId();
  const normalizedOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    options.forEach((item) => {
      const valueStr = String(item?.value || item).trim();
      if (!valueStr || seen.has(valueStr)) return;
      seen.add(valueStr);
      list.push({
        value: valueStr,
        label: item?.label || valueStr,
        hint: item?.hint || '',
      });
    });
    return list;
  }, [options]);

  return (
    <>
      <Input
        value={value || ""}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        list={listId}
        disabled={disabled}
      />
      <datalist id={listId}>
        {normalizedOptions.map((item) => (
          <option
            key={item.value}
            value={item.value}
            label={item.hint ? `${item.label} – ${item.hint}` : item.label}
          />
        ))}
      </datalist>
    </>
  );
}

function LicensePointTable({ config, onChange, disabled, options = [] }) {
  const entries = Array.isArray(config?.codePoints) ? config.codePoints : [];

  const updateEntry = (index, key, value) => {
    const next = entries.map((entry, idx) =>
      idx === index
        ? {
            ...entry,
            [key]:
              key === "code"
                ? String(value || "")
                    .trim()
                    .toUpperCase()
                : value,
          }
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
                <LicenseCodeInput
                  value={entry.code || ""}
                  onChange={(nextValue) => updateEntry(index, "code", nextValue)}
                  options={options}
                  placeholder="Ví dụ: ZB02"
                  disabled={disabled}
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

function AgencyExcludeEditor({ agencies, onChange, disabled, agencyOptions = [], codeOptions = [] }) {
  const list = Array.isArray(agencies) ? agencies : [];

  const updateEntry = (index, key, value) => {
    const next = list.map((entry, idx) =>
      idx === index
        ? {
            ...entry,
            [key]: key === "codes"
              ? Array.isArray(value)
                ? value
                    .map((code) => String(code || "").trim().toUpperCase())
                    .filter(Boolean)
                : String(value || "")
                    .split(",")
                    .map((code) => code.trim().toUpperCase())
                    .filter(Boolean)
              : String(value || "").trim(),
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
                <AgencyInput
                  value={entry.agency || ""}
                  onChange={(val) => updateEntry(index, "agency", val)}
                  options={agencyOptions}
                  placeholder="Ví dụ: G&B"
                  disabled={disabled}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-sm text-gray-600">Mã giấy phép áp dụng</label>
                <CodeMultiSelect
                  value={Array.isArray(entry.codes) ? entry.codes : []}
                  onChange={(codes) => updateEntry(index, "codes", codes)}
                  options={codeOptions}
                  disabled={disabled}
                  placeholder="Chọn mã giấy phép"
                  searchPlaceholder="Tìm mã giấy phép"
                  listHeading="Mã giấy phép đã ghi nhận"
                  emptyLabel="Không tìm thấy mã giấy phép phù hợp."
                  addLabel="Thêm mã giấy phép"
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
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyReloadToken, setHistoryReloadToken] = useState(0);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [restoringId, setRestoringId] = useState('');
  const [configTab, setConfigTab] = useState('groups');
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState('');
  const [simRunning, setSimRunning] = useState(false);
  const manualLicenseListId = useId();
  const manualAgencyListId = useId();
  const hqAgencies = useMemo(() => getHQAgencies(), []);

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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setHistoryLoading(true);
    fetchRulesHistoryFromServer({ signal: controller.signal })
      .then((entries) => {
        if (cancelled) return;
        const list = Array.isArray(entries) && entries.length > 0 ? entries : getRulesHistory();
        setHistoryEntries(list);
        setHistoryError('');
        setExpandedHistoryId(null);
      })
      .catch((error) => {
        if (cancelled) return;
        const fallback = getRulesHistory();
        setHistoryEntries(fallback);
        if (!controller.signal.aborted) {
          setHistoryError(error?.message || 'Không thể tải lịch sử quy tắc KPI từ máy chủ.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [historyReloadToken, version]);

  const handleHistoryRefresh = useCallback(() => {
    setExpandedHistoryId(null);
    setHistoryReloadToken((token) => token + 1);
  }, []);

  const data = useMemo(() => getData(), []);
  const savedSnapshot = useMemo(() => {
    try {
      return rule?.id ? loadRules(rule.id) : null;
    } catch (error) {
      console.warn('Không thể đọc snapshot bộ quy tắc hiện tại', error);
      return null;
    }
  }, [rule?.id, version]);

  const licenseOptions = useMemo(() => {
    const counter = new Map();
    const pushCode = (value, weight = 1) => {
      const code = String(value || '')
        .trim()
        .toUpperCase();
      if (!code) return;
      const current = counter.get(code) || { value: code, count: 0 };
      current.count += weight;
      counter.set(code, current);
    };

    const extractCodes = (source) => {
      if (!source) return [];
      if (Array.isArray(source)) {
        return source;
      }
      if (typeof source === 'string') {
        return source
          .split(/[\s,;|]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return [];
    };

    data.forEach((row) => {
      const candidates = [
        row?.licenseCodes,
        row?.licenseSourceCodes,
        row?.licenseExcludedCodes,
        row?.licensesList,
      ];
      candidates.forEach((value) => {
        extractCodes(value).forEach((code) => pushCode(code));
      });
    });

    const licenseConfig = rule?.license || {};
    (licenseConfig.codePoints || []).forEach((entry) => pushCode(entry?.code));
    (licenseConfig.exclude?.codes || []).forEach((code) => pushCode(code));
    (licenseConfig.exclude?.agencies || []).forEach((entry) => {
      (entry?.codes || []).forEach((code) => pushCode(code));
    });

    return Array.from(counter.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    });
  }, [data, rule?.license]);

  const agencyOptions = useMemo(() => {
    const counter = new Map();
    const record = (value, hint = '') => {
      const key = String(value || '').trim();
      if (!key) return;
      const current = counter.get(key) || { value: key, count: 0, hint: '' };
      current.count += 1;
      if (!current.hint && hint) {
        current.hint = hint;
      }
      counter.set(key, current);
    };

    const recordList = (value, hint = '') => {
      if (Array.isArray(value)) {
        value.forEach((item) => record(item, hint));
        return;
      }
      parseAgencyList(value).forEach((item) => record(item, hint));
    };

    data.forEach((row) => {
      const hint = row?.company || row?.cong_ty || row?.customer || '';
      recordList(row?.agency, hint);
      recordList(row?.dai_ly, hint);
      recordList(row?.hqAgency, hint);
      recordList(row?.agent, hint);
    });

    hqAgencies.forEach((entry) => {
      const hint = entry?.company || '';
      record(entry?.agent, hint);
      recordList(entry?.agents, hint);
    });

    (rule?.license?.exclude?.agencies || []).forEach((entry) => record(entry?.agency));

    return Array.from(counter.values())
      .map((item) => ({
        value: item.value,
        label: item.value,
        hint: item.hint,
        count: item.count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.value.localeCompare(b.value, 'vi', { sensitivity: 'base' });
      });
  }, [data, hqAgencies, rule?.license?.exclude?.agencies]);
  const currentVersion = Number.isFinite(Number(rule?.version)) ? Number(rule.version) : null;
  const savedVersion = Number.isFinite(Number(savedSnapshot?.version)) ? Number(savedSnapshot.version) : null;
  const runSimulation = useCallback(() => {
    if (!data.length) {
      setSimError('Không có dữ liệu tờ khai để mô phỏng.');
      setSimResult(null);
      return;
    }
    setSimRunning(true);
    setSimError('');
    try {
      const dataset = data;
      const summarize = (targetRule) => {
        if (!targetRule) return null;
        let total = 0;
        for (const row of dataset) {
          total += computeKPI(row, targetRule);
        }
        const average = dataset.length ? total / dataset.length : 0;
        return {
          version: Number(targetRule.version) || 0,
          total,
          average,
          count: dataset.length,
          name: targetRule.name || targetRule.id || 'Bộ quy tắc',
        };
      };
      const preview = summarize(rule);
      const baseline = savedSnapshot ? summarize(savedSnapshot) : null;
      setSimResult({
        preview,
        baseline,
        difference:
          baseline && preview ? preview.total - baseline.total : null,
      });
    } catch (error) {
      console.error('Không thể mô phỏng KPI', error);
      setSimError(error?.message || 'Không thể mô phỏng KPI với bộ quy tắc hiện tại.');
      setSimResult(null);
    } finally {
      setSimRunning(false);
    }
  }, [data, rule, savedSnapshot]);

  const handleRestoreEntry = useCallback(
    (entry) => {
      if (isReadOnly) {
        alert('Bạn không có quyền khôi phục phiên bản quy tắc.');
        return;
      }
      if (!entry?.snapshot) {
        alert('Phiên bản lịch sử không hợp lệ.');
        return;
      }
      const targetName = entry.snapshot.name || entry.snapshot.id || 'Bộ quy tắc';
      const targetVersion = entry.snapshot.version || '—';
      const confirmMessage = `Khôi phục phiên bản ${targetVersion} của ${targetName}?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
      try {
        const identifier = entry.id || entry.snapshot.id || `${entry.updatedAt || ''}`;
        setRestoringId(identifier);
        const restored = restoreRuleVersion(entry.snapshot, {
          actor,
          setAsDefault: collection.activeId === (entry.snapshot.id || ''),
        });
        setVersion((prev) => prev + 1);
        setApplyNow(false);
        setDirty(false);
        setHistoryEntries(getRulesHistory());
        setExpandedHistoryId(null);
        toast.success(`Đã khôi phục phiên bản ${restored.version} của ${restored.name}.`);
      } catch (error) {
        console.error(error);
        alert(error?.message || 'Không thể khôi phục phiên bản đã chọn.');
      } finally {
        setRestoringId('');
      }
    },
    [actor, collection.activeId, isReadOnly]
  );
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

  const handleCodesChange = (groupKey, codes) => {
    const normalized = Array.isArray(codes)
      ? codes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean)
      : [];
    const unique = Array.from(new Set(normalized));
    updateGroup(groupKey, (group) => ({ ...group, codes: unique }));
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

  const groups = useMemo(() => {
    if (rule?.groups && typeof rule.groups === "object") {
      return rule.groups;
    }
    return EMPTY_GROUP_MAP;
  }, [rule]);
  const typeOptions = useMemo(() => {
    const counter = new Map();
    data.forEach((row) => {
      const raw =
        row?.loai_hinh ||
        row?.loaiHinh ||
        row?.ma_loai_hinh ||
        row?.maLoaiHinh ||
        row?.loai_hinh_tm ||
        "";
      const code = String(raw || "").trim().toUpperCase();
      if (!code) return;
      const current = counter.get(code) || { value: code, count: 0 };
      current.count += 1;
      counter.set(code, current);
    });
    Object.values(groups).forEach((group) => {
      (group?.codes || []).forEach((code) => {
        const upper = String(code || "").trim().toUpperCase();
        if (!upper || counter.has(upper)) return;
        counter.set(upper, { value: upper, count: 0 });
      });
    });
    return Array.from(counter.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    });
  }, [data, groups]);
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
    setHistoryEntries(getRulesHistory());
    setExpandedHistoryId(null);
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
      toast.error("Bạn không có quyền import quy tắc.");
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
        toast.success("Đã import và áp dụng dữ liệu cho bộ quy tắc hiện tại.");
      } catch (err) {
        console.error(err);
        toast.error("File JSON không hợp lệ.");
      }
      input.value = "";
    };
    reader.onerror = () => {
      toast.error("Không thể đọc file JSON.");
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
      toast.error("Bạn không có quyền khôi phục quy tắc.");
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
        setHistoryEntries(getRulesHistory());
        setExpandedHistoryId(null);
        toast.success("Đã khôi phục toàn bộ bộ quy tắc từ file sao lưu.");
      } catch (err) {
        console.error(err);
        toast.error("File sao lưu không hợp lệ.");
      } finally {
        input.value = "";
      }
    };
    reader.onerror = () => {
      toast.error("Không thể đọc file sao lưu.");
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

          <Tabs value={configTab} onValueChange={setConfigTab} className="space-y-4">
            <TabsList className="grid gap-2 sm:w-auto sm:grid-cols-3">
              <TabsTrigger value="groups">Nhóm loại hình</TabsTrigger>
              <TabsTrigger value="license">Giấy phép &amp; loại trừ</TabsTrigger>
              <TabsTrigger value="bonus">Điểm cộng thêm</TabsTrigger>
            </TabsList>
            <TabsContent value="groups">
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
                      <label className="text-sm text-gray-600">Mã loại hình</label>
                      <CodeMultiSelect
                        value={groupConfig.codes || []}
                        onChange={(codes) => handleCodesChange(groupKey, codes)}
                        options={typeOptions}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Điểm cơ bản mỗi tờ khai</label>
                      <Num
                        value={groupConfig.base}
                        onChange={(val) => handleGroupNumber(groupKey, 'base', val)}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Điểm cộng theo mỗi mục hàng</label>
                      <Num
                        value={groupConfig.perItem}
                        onChange={(val) => handleGroupNumber(groupKey, 'perItem', val)}
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
                          onChange={(nextTiers) => handleGroupNumber(groupKey, 'tiers', nextTiers)}
                          disabled={isReadOnly}
                          title="Các bậc cộng thêm"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="license">
              <div className="space-y-3 rounded border p-3">
                <div className="font-semibold">Cấu hình điểm giấy phép</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm text-gray-600">Điểm mặc định mỗi loại giấy phép</label>
                    <Num
                      value={licenseConfig.defaultPoints}
                      onChange={(val) =>
                        handleLicenseChange({
                          ...licenseConfig,
                          defaultPoints: val,
                        })
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-600">Các mã giấy phép bị loại trừ</label>
                    <CodeMultiSelect
                      value={licenseConfig.exclude?.codes || []}
                      onChange={(codes) =>
                        handleLicenseChange({
                          ...licenseConfig,
                          exclude: {
                            ...licenseConfig.exclude,
                            codes,
                            agencies: licenseConfig.exclude?.agencies || [],
                          },
                        })
                      }
                      options={licenseOptions}
                      disabled={isReadOnly}
                      placeholder="Chọn mã giấy phép"
                      searchPlaceholder="Tìm mã giấy phép"
                      listHeading="Mã giấy phép đã ghi nhận"
                      emptyLabel="Không tìm thấy mã giấy phép phù hợp."
                      addLabel="Thêm mã giấy phép"
                    />
                  </div>
                </div>
                <LicensePointTable
                  config={licenseConfig}
                  onChange={(next) => handleLicenseChange(next)}
                  disabled={isReadOnly}
                  options={licenseOptions}
                />
                <AgencyExcludeEditor
                  agencies={licenseConfig.exclude?.agencies || []}
                  onChange={handleAgencyChange}
                  disabled={isReadOnly}
                  agencyOptions={agencyOptions}
                  codeOptions={licenseOptions}
                />
              </div>
            </TabsContent>
            <TabsContent value="bonus">
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
            </TabsContent>
          </Tabs>

          <div className="space-y-3 rounded border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Mô phỏng KPI "Thu"</div>
                <p className="text-xs text-gray-500">
                  Ước tính tổng điểm dựa trên {data.length.toLocaleString('vi-VN')} tờ khai đang lưu bằng phiên bản quy tắc hiện tại và bản đã lưu gần nhất.
                </p>
              </div>
              <Button onClick={runSimulation} disabled={simRunning || !data.length} variant="outline">
                {simRunning ? 'Đang tính…' : 'Chạy mô phỏng'}
              </Button>
            </div>
            {simError ? <p className="text-xs text-red-500">{simError}</p> : null}
            {simResult ? (
              <div className="space-y-3 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  {simResult.preview ? (
                    <div className="rounded border p-3">
                      <div className="text-xs uppercase text-gray-500">Phiên bản đang chỉnh</div>
                      <div className="text-lg font-semibold text-gray-800">
                        {simResult.preview.total.toFixed(2)} điểm
                      </div>
                      <div>Trung bình / tờ khai: {simResult.preview.average.toFixed(2)}</div>
                      <div>Phiên bản: {simResult.preview.version}</div>
                    </div>
                  ) : null}
                  {simResult.baseline ? (
                    <div className="rounded border p-3">
                      <div className="text-xs uppercase text-gray-500">Phiên bản đã lưu</div>
                      <div className="text-lg font-semibold text-gray-800">
                        {simResult.baseline.total.toFixed(2)} điểm
                      </div>
                      <div>Trung bình / tờ khai: {simResult.baseline.average.toFixed(2)}</div>
                      <div>Phiên bản: {simResult.baseline.version}</div>
                    </div>
                  ) : null}
                </div>
                {simResult.difference !== null ? (
                  <div className="text-xs">
                    Chênh lệch tổng điểm so với bản đã lưu:{' '}
                    <span
                      className={simResult.difference >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'}
                    >
                      {simResult.difference >= 0 ? '+' : ''}
                      {simResult.difference.toFixed(2)}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Chưa có dữ liệu mô phỏng. Nhấn "Chạy mô phỏng" để xem kết quả.</p>
            )}
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

          <div className="space-y-2 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-700">Lịch sử cập nhật điểm KPI</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryCollapsed((prev) => !prev)}
                  className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
                >
                  {historyCollapsed ? "Mở rộng" : "Thu gọn"}
                </button>
                {historyError && !historyLoading && (
                  <span className="text-xs text-red-500">{historyError}</span>
                )}
                {historyLoading && (
                  <span className="text-xs text-[color:var(--ds-text-muted)]">Đang tải…</span>
                )}
                <button
                  type="button"
                  onClick={handleHistoryRefresh}
                  disabled={historyLoading}
                  className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {historyLoading ? 'Đang tải…' : 'Làm mới'}
                </button>
              </div>
            </div>
            {historyCollapsed ? (
              <p className="text-xs text-[color:var(--ds-text-muted)]">Đã thu gọn lịch sử. Nhấn “Mở rộng” để xem chi tiết.</p>
            ) : historyEntries.length === 0 ? (
              <p className="text-xs text-[color:var(--ds-text-muted)]">Chưa có ghi nhận lịch sử nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500">
                      <th className="px-2 py-2">Cập nhật</th>
                      <th className="px-2 py-2">Áp dụng từ</th>
                      <th className="px-2 py-2">Tên bộ quy tắc</th>
                      <th className="px-2 py-2 text-right">Phiên bản</th>
                      <th className="px-2 py-2 text-right">Điểm cơ bản</th>
                      <th className="px-2 py-2 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEntries.map((entry, index) => {
                      const rowId = entry.id || entry.snapshot?.id || `${entry.updatedAt || ''}-${index}`;
                      const basePoints = Number(entry.snapshot?.points?.base);
                      const baseLabel = Number.isFinite(basePoints) ? basePoints.toFixed(1) : '—';
                      const isExpanded = expandedHistoryId === rowId;
                      const versionValue = Number.isFinite(Number(entry.snapshot?.version))
                        ? Number(entry.snapshot.version)
                        : Number.isFinite(Number(entry.version))
                        ? Number(entry.version)
                        : null;
                      const versionLabel = versionValue !== null ? versionValue : '—';
                      return (
                        <React.Fragment key={rowId}>
                          <tr className="border-t border-gray-100">
                            <td className="px-2 py-2 text-xs text-gray-600">{formatHistoryTimestamp(entry.updatedAt)}</td>
                            <td className="px-2 py-2 text-xs text-gray-600">{entry.applyFrom || 'Áp dụng ngay'}</td>
                            <td className="px-2 py-2 text-sm text-gray-700">{entry.name || entry.snapshot?.name || rowId}</td>
                            <td className="px-2 py-2 text-right text-sm text-gray-700">{versionLabel}</td>
                            <td className="px-2 py-2 text-right text-sm font-medium text-gray-800">{baseLabel}</td>
                            <td className="px-2 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandedHistoryId(isExpanded ? null : rowId)}
                                  className="text-xs font-medium text-amber-600 hover:underline"
                                >
                                  {isExpanded ? 'Thu gọn' : 'Xem'}
                                </button>
                                {!isReadOnly ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreEntry(entry)}
                                    disabled={restoringId === rowId}
                                    className="text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {restoringId === rowId ? 'Đang khôi phục…' : 'Khôi phục'}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="px-2 pb-4 pt-1">
                                <div className="rounded bg-slate-900 p-3 text-xs text-slate-100">
                                  <div className="mb-2 font-semibold">Chi tiết điểm & cấu hình</div>
                                  <pre className="max-h-52 overflow-auto whitespace-pre-wrap text-xs">
{JSON.stringify(entry.snapshot?.points, null, 2)}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
