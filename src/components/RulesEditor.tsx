import React, { useMemo, useState } from "react";
import { t } from '@/lib/i18n.js';

import { Card, CardContent } from "@/components/ui/card.tsx";

import RulesApplyActionsPanel from "@/components/rules-editor/RulesApplyActionsPanel.jsx";
import RulesConfigTabsPanel from "@/components/rules-editor/RulesConfigTabsPanel.jsx";
import RulesGeneralInfoPanel from "@/components/rules-editor/RulesGeneralInfoPanel.jsx";
import RulesHistoryPanel from "@/components/rules-editor/RulesHistoryPanel.jsx";
import RulesSimulationPanel from "@/components/rules-editor/RulesSimulationPanel.jsx";
import RulesTestWorkspacePanel from "@/components/rules-editor/RulesTestWorkspacePanel.jsx";

import { getData, getHQAgencies } from "@/lib/store.js";
import useRulesConfigState from "@/components/rules-editor/hooks/useRulesConfigState.js";
import useRulesEditorWorkflow from "@/components/rules-editor/hooks/useRulesEditorWorkflow.js";
import useRulesTestWorkspace from "@/components/rules-editor/hooks/useRulesTestWorkspace.js";
import type { AuthAccountView } from '@/types';
import { PageHeader } from "@/components/designSystem/PageHeader";
import { PermissionBanner } from "@/components/designSystem/primitives";
import { FileText, History, TestTube } from "lucide-react";

function formatHistoryTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN", { hour12: false });
  } catch (err) {
    console.warn(t('rules.error.formatHistory'), value, err);
    return value;
  }
}

interface RulesEditorProps {
  canEdit?: boolean;
  currentUser?: AuthAccountView | null;
}

export default function RulesEditor({ canEdit = true, currentUser = null }: RulesEditorProps) {
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

  const [mainTab, setMainTab] = useState<"active" | "history" | "test">("active");

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

  const tabs = [
    { id: "active", label: "Đang áp dụng", icon: FileText },
    { id: "history", label: "Lịch sử phiên bản", icon: History },
    { id: "test", label: "Kiểm thử", icon: TestTube },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Page Header */}
      <PageHeader
        eyebrow="CẤU HÌNH"
        title="Quy tắc KPI"
        info="Cấu hình và quản lý quy tắc tính điểm KPI cho tờ khai"
        meta={[
          `${collection.sets.length} quy tắc`,
          isDefaultRule ? "Đang dùng mặc định" : `Quy tắc: ${rule.name}`,
        ]}
      />

      {/* Permission Banner */}
      {isReadOnly && (
        <PermissionBanner
          level="warning"
          title={t('rules.readOnly.title') || "Chế độ chỉ đọc"}
          description={
            t('rules.readOnly.desc') ||
            "Bạn không có quyền chỉnh sửa quy tắc KPI. Chỉ có thể xem và kiểm thử."
          }
        />
      )}

      {/* Main Tabs */}
      <div className="border-b border-ds-border-subtle">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id as typeof mainTab)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                  mainTab === tab.id
                    ? 'border-ds-accent text-ds-accent'
                    : 'border-transparent text-ds-text-secondary hover:text-ds-text-primary'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {mainTab === "active" && (
          <Card className="border-ds-border-subtle">
            <CardContent className="space-y-6 p-6">
              <RulesGeneralInfoPanel
                collection={collection}
                activeTab={activeTab}
                isReadOnly={isReadOnly}
                isDefaultRule={isDefaultRule}
                currentVersion={currentVersion}
                savedVersion={savedVersion}
                rule={rule}
                formatTimestamp={formatHistoryTimestamp}
                onSelectTab={handleSelectTab}
                onAddRule={handleAddRule}
                onSetDefault={handleSetDefault}
                onSetDefaultButton={handleSetDefaultButton}
                onRuleChange={updateRule}
              />

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

              <RulesApplyActionsPanel
                rule={rule}
                applyNow={applyNow}
                isReadOnly={isReadOnly}
                canDeleteRule={collection.sets.length > 1}
                onRuleChange={updateRule}
                onApplyNowChange={setApplyNow}
                onSave={handleSave}
                onReset={handleReset}
                onExportCurrentRule={exportCurrentRule}
                onImportCurrentRule={importCurrentRule}
                onExportAllRules={exportAllRules}
                onImportAllRules={importAllRules}
                onDeleteRule={handleDeleteRule}
              />
            </CardContent>
          </Card>
        )}

        {mainTab === "history" && (
          <Card className="border-ds-border-subtle">
            <CardContent className="p-6">
              <RulesHistoryPanel
                entries={historyEntries}
                loading={historyLoading}
                error={historyError}
                collapsed={false}
                expandedId={expandedHistoryId}
                isReadOnly={isReadOnly}
                restoringId={restoringId}
                onToggleCollapsed={() => {}}
                onRefresh={handleHistoryRefresh}
                onToggleExpanded={setExpandedHistoryId}
                onRestoreEntry={handleRestoreEntry}
                formatTimestamp={formatHistoryTimestamp}
              />
            </CardContent>
          </Card>
        )}

        {mainTab === "test" && (
          <Card className="border-ds-border-subtle">
            <CardContent className="p-6">
              <RulesTestWorkspacePanel
                workspace={testWorkspace}
                licenseOptions={licenseOptions}
                agencyOptions={agencyOptions}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
