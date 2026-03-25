# Frontend Wave-1 Decomposition

## Goal
Chot backlog tach nho wave 1 cho 4 fat component lon nhat de giam kich thuoc module, giam coupling state, va giu duong refactor an toan bang test muc tieu.

## Target Files
- `src/components/MSTAssignment.jsx` (3170 lines)
- `src/components/KPIAdjustments.jsx` (2950 lines)
- `src/components/AiAssistant.jsx` (2872 lines)
- `src/components/RulesEditor.jsx` (1761 lines)

## Tasks
- [x] MSTAssignment slice A: tach helper UI dang nam trong file sang `src/components/mst-assignment/timeline/HistoryDetails.jsx`, `src/components/mst-assignment/timeline/StageTimelinePreview.jsx`, `src/components/mst-assignment/timeline/StageTimelineGroups.jsx`, va `src/components/mst-assignment/table/ColumnResizeHandle.jsx` -> Verify: `tests/mstAssignment.timeline.test.jsx`, `tests/mstAssignment.column-widths.test.jsx`, `tests/mstAssignment.column-visibility.test.jsx` da pass.
- [x] MSTAssignment slice B: tach state/layout logic sang `src/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js` va `src/components/mst-assignment/hooks/useMSTAssignmentPageSize.js` -> Verify: `tests/mstAssignment.column-widths.test.jsx`, `tests/mstAssignment.column-visibility.test.jsx`, `tests/mstAssignment.pagination.test.jsx`, `tests/mstAssignment.layout-hooks.test.jsx`, `tests/mstAssignment.person-columns.test.jsx`, `tests/e2e.admin-flows.test.jsx` da pass.
- [x] KPIAdjustments slice A: tach pure builder/model logic sang `src/components/kpi-adjustments/model/businessDirectory.js`, `src/components/kpi-adjustments/model/calculationInfo.js`, `src/components/kpi-adjustments/model/guidanceGroups.js`, va `src/components/kpi-adjustments/model/settingsDraft.js` -> Verify: `tests/kpiAdjustments.model.test.js` da cover `buildBusinessDirectory`, `buildCalculationInfo`, `buildGuidanceGroups`, `buildSettingsDraft`.
- [x] KPIAdjustments slice B: tach form/settings state sang `src/components/kpi-adjustments/hooks/useKpiAdjustmentForm.js` va `src/components/kpi-adjustments/hooks/useKpiAdjustmentFilters.js` -> Verify: `tests/kpiAdjustments.test.jsx` tiep tuc cover save/edit/filter flow, va them `tests/kpiAdjustments.hooks.test.jsx` cho form/filter hooks.
- [x] AiAssistant slice A: tach helper cache/provider/history sang `src/components/ai-assistant/snapshotCache.js`, `src/components/ai-assistant/providerConfig.js`, va `src/components/ai-assistant/historyStore.js` -> Verify: `tests/aiAssistant.config.test.jsx`, `tests/aiAssistant.snapshotCache.test.js`, `tests/aiAssistant.providerHelpers.test.js`, va `tests/aiAssistant.historyStore.test.js` da pass.
- [x] AiAssistant slice B: tach panel va orchestration hook sang `src/components/ai-assistant/panels/AiAssistantConfigPanel.jsx`, `src/components/ai-assistant/panels/AiAssistantHistoryPanel.jsx`, `src/components/ai-assistant/panels/AiAssistantChatPanel.jsx`, `src/components/ai-assistant/panels/AiAssistantStatusSidebar.jsx`, `src/components/ai-assistant/hooks/useAiAssistantConfig.js`, va `src/components/ai-assistant/hooks/useAiConversation.js` -> Verify: `tests/aiAssistant.config.test.jsx`, `tests/aiAssistant.panels.test.jsx`, `tests/useAiConversation.test.jsx`, va `tests/useAiAssistantConfig.test.jsx` da pass.
- [x] RulesEditor slice A: dat baseline test truoc khi tach code, sau do tach cac control dang co san sang `src/components/rules-editor/controls/TierEditor.jsx`, `CodeMultiSelect.jsx`, `LicenseCodeInput.jsx`, `AgencyInput.jsx`, `LicensePointTable.jsx`, va `AgencyExcludeEditor.jsx` (bo sung them `RuleNumberInput.jsx` de tach input so dung chung) -> Verify: `tests/rulesEditor.controls.test.jsx` da cover nhap lieu, multi-select, uppercase code, va license point rows.
- [x] RulesEditor slice B: dat baseline test truc tiep cho `RulesEditor`, sau do tach `RulesSimulationPanel.jsx` va `RulesHistoryPanel.jsx` ra khoi file chinh -> Verify: `tests/rulesEditor.test.jsx`, `tests/rulesEditorSimulationPanel.test.jsx`, va `tests/rulesEditorHistoryPanel.test.jsx` da pass cho flow simulation/history refresh/restore.

## Done When
- [ ] Moi component co it nhat 1 slice pure/presentational truoc khi cham vao stateful orchestration.
- [ ] Co danh sach module dich ro rang cho wave 1, theo thu tu refactor an toan.
- [ ] Da xac dinh test can bo sung truoc khi tach state hoac history flow.

## Notes
- Thu tu uu tien an toan: `MSTAssignment helpers -> KPIAdjustments pure model -> AiAssistant pure helpers -> RulesEditor baseline tests -> cac slice hook/panel stateful`.
- `cng-xyq.12` da dong sau khi tach xong column layout + page-size hooks.
- `cng-xyq.9` da hoan tat; bead tiep theo de tiep tuc wave-1 la `cng-xyq.10` cho `AiAssistant`.
- `RulesEditor` da co baseline test truc tiep cho flow simulation/history; gap con lai cua file nay la cac control/editor nho va phan config tabs chua tach.
- `cng-xyq.13` da dong sau khi tach xong controls cua `RulesEditor`; file chinh giam tiep tu 1625 dong xuong 1143 dong.
- `cng-xyq.14` da dong sau khi tach xong panel/hook cho `AiAssistant`; file chinh giam xuong orchestration layer va da co regression coverage cho config/panel/conversation hooks.
- Wave 1 uu tien tach pure helper va panel nho; cac state machine lon chi tach sau khi da co regression coverage khoa hanh vi.
