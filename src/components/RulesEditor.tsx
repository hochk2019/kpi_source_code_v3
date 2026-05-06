import React, { useMemo } from "react";
import { t } from '@/lib/i18n.js';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";

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
        <div className="rounded border border-ds-warning/30 bg-ds-warning/10 p-3 text-sm text-ds-warning">
          Bạn đang xem quy tắc KPI ở chế độ chỉ xem. Các trường cấu hình bị khóa; vẫn có thể dùng khu vực test để kiểm tra điểm KPI.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quy tắc KPI</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
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
            onToggleCollapsed={() => setHistoryCollapsed((prev: boolean) => !prev)}
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
