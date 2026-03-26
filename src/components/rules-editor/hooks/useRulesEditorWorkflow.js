import { useCallback, useEffect, useMemo, useState } from "react";

import { toast } from "@/shared/toast";
import {
  createRuleTemplate,
  deleteRule,
  exportRuleCollection,
  fetchRulesHistoryFromServer,
  getRulesHistory,
  loadRuleSets,
  loadRules,
  restoreRuleCollection,
  restoreRuleVersion,
  saveRules,
  setDefaultRule,
  computeKPI,
} from "@/lib/rules.js";

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export default function useRulesEditorWorkflow({ canEdit = true, currentUser = null, data = [] }) {
  const actor = currentUser?.username || "guest";
  const isReadOnly = !canEdit;

  const [version, setVersion] = useState(0);
  const [collection, setCollection] = useState(() => loadRuleSets());
  const [activeTab, setActiveTab] = useState(collection.activeId);
  const [rule, setRule] = useState(() => loadRules(collection.activeId));
  const [applyNow, setApplyNow] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyReloadToken, setHistoryReloadToken] = useState(0);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [restoringId, setRestoringId] = useState("");

  const [configTab, setConfigTab] = useState("groups");

  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState("");
  const [simRunning, setSimRunning] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setHistoryLoading(true);

    fetchRulesHistoryFromServer({ signal: controller.signal })
      .then((entries) => {
        if (cancelled) return;
        const list = Array.isArray(entries) && entries.length > 0 ? entries : getRulesHistory();
        setHistoryEntries(list);
        setHistoryError("");
        setExpandedHistoryId(null);
      })
      .catch((error) => {
        if (cancelled) return;
        const fallback = getRulesHistory();
        setHistoryEntries(fallback);

        if (!controller.signal.aborted) {
          setHistoryError(error?.message || "Không thể tải lịch sử quy tắc KPI từ máy chủ.");
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

  const savedSnapshot = useMemo(() => {
    try {
      return rule?.id ? loadRules(rule.id) : null;
    } catch (error) {
      console.warn("Không thể đọc snapshot bộ quy tắc hiện tại", error);
      return null;
    }
  }, [rule?.id]);

  const currentVersion = Number.isFinite(Number(rule?.version)) ? Number(rule.version) : null;
  const savedVersion = Number.isFinite(Number(savedSnapshot?.version))
    ? Number(savedSnapshot.version)
    : null;

  const runSimulation = useCallback(() => {
    if (!data.length) {
      setSimError("Không có dữ liệu tờ khai để mô phỏng.");
      setSimResult(null);
      return;
    }

    setSimRunning(true);
    setSimError("");

    try {
      const summarize = (targetRule) => {
        if (!targetRule) return null;

        let total = 0;
        for (const row of data) {
          total += computeKPI(row, targetRule);
        }

        return {
          version: Number(targetRule.version) || 0,
          total,
          average: data.length ? total / data.length : 0,
          count: data.length,
          name: targetRule.name || targetRule.id || "Bộ quy tắc",
        };
      };

      const preview = summarize(rule);
      const baseline = savedSnapshot ? summarize(savedSnapshot) : null;

      setSimResult({
        preview,
        baseline,
        difference: baseline && preview ? preview.total - baseline.total : null,
      });
    } catch (error) {
      console.error("Không thể mô phỏng KPI", error);
      setSimError(error?.message || "Không thể mô phỏng KPI với bộ quy tắc hiện tại.");
      setSimResult(null);
    } finally {
      setSimRunning(false);
    }
  }, [data, rule, savedSnapshot]);

  const handleRestoreEntry = useCallback((entry) => {
    if (isReadOnly) {
      alert("Bạn không có quyền khôi phục phiên bản quy tắc.");
      return;
    }

    if (!entry?.snapshot) {
      alert("Phiên bản lịch sử không hợp lệ.");
      return;
    }

    const targetName = entry.snapshot.name || entry.snapshot.id || "Bộ quy tắc";
    const targetVersion = entry.snapshot.version || "—";
    const confirmMessage = `Khôi phục phiên bản ${targetVersion} của ${targetName}?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const identifier = entry.id || entry.snapshot.id || `${entry.updatedAt || ""}`;
      setRestoringId(identifier);

      const restored = restoreRuleVersion(entry.snapshot, {
        actor,
        setAsDefault: collection.activeId === (entry.snapshot.id || ""),
      });

      setVersion((prev) => prev + 1);
      setApplyNow(false);
      setDirty(false);
      setHistoryEntries(getRulesHistory());
      setExpandedHistoryId(null);
      toast.success(`Đã khôi phục phiên bản ${restored.version} của ${restored.name}.`);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Không thể khôi phục phiên bản đã chọn.");
    } finally {
      setRestoringId("");
    }
  }, [actor, collection.activeId, isReadOnly]);

  const handleSelectTab = useCallback((ruleId) => {
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
  }, [activeTab, dirty, isReadOnly]);

  const updateRule = useCallback((updater) => {
    setRule((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
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
  }, [actor, applyNow, collection.activeId, isReadOnly, rule]);

  const handleReset = useCallback(() => {
    if (isReadOnly) return;
    setRule(loadRules(activeTab));
    setApplyNow(false);
    setDirty(false);
  }, [activeTab, isReadOnly]);

  const handleSetDefault = useCallback((event) => {
    const nextId = event.target.value;
    const updated = setDefaultRule(nextId, { actor });
    setCollection(updated);
    setActiveTab(nextId);
    setRule(loadRules(nextId));
    setApplyNow(false);
    setDirty(false);
  }, [actor]);

  const handleSetDefaultButton = useCallback(() => {
    if (collection.activeId === rule.id) return;
    const updated = setDefaultRule(rule.id, { actor });
    setCollection(updated);
    alert(`Đã đặt "${rule.name}" làm bộ quy tắc mặc định.`);
  }, [actor, collection.activeId, rule.id, rule.name]);

  const handleDeleteRule = useCallback(() => {
    if (isReadOnly || !rule?.id) return;

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
    } catch (error) {
      console.error(error);
      alert(error?.message || "Không thể xóa bộ quy tắc.");
    }
  }, [actor, collection.sets.length, isReadOnly, rule]);

  const exportCurrentRule = useCallback(() => {
    downloadJson(`${rule.name || "kpi_rules"}.json`, rule);
  }, [rule]);

  const importCurrentRule = useCallback((event) => {
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
      } catch (error) {
        console.error(error);
        toast.error("File JSON không hợp lệ.");
      }

      input.value = "";
    };

    reader.onerror = () => {
      toast.error("Không thể đọc file JSON.");
      input.value = "";
    };

    reader.readAsText(file);
  }, [actor, isReadOnly, rule.id]);

  const exportAllRules = useCallback(() => {
    const exportedCollection = exportRuleCollection();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(`kpi-rules-backup-${timestamp}.json`, exportedCollection);
  }, []);

  const importAllRules = useCallback((event) => {
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
      } catch (error) {
        console.error(error);
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
  }, [actor, isReadOnly]);

  const handleAddRule = useCallback(() => {
    if (isReadOnly) return;

    const template = createRuleTemplate(rule, {
      name: `Rule mới ${collection.sets.length + 1}`,
    });
    const saved = saveRules(template, { actor, appendHistory: false });
    setActiveTab(saved.id);
    setVersion((prev) => prev + 1);
  }, [actor, collection.sets.length, isReadOnly, rule]);

  const isDefaultRule = collection.activeId === rule.id;

  return {
    activeTab,
    applyNow,
    collection,
    configTab,
    currentVersion,
    dirty,
    expandedHistoryId,
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
    savedSnapshot,
    savedVersion,
    setActiveTab,
    setApplyNow,
    setConfigTab,
    setExpandedHistoryId,
    setHistoryCollapsed,
    simError,
    simResult,
    simRunning,
    updateRule,
    exportAllRules,
    exportCurrentRule,
  };
}
