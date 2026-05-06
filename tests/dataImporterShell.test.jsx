import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import DataImporterShell from "@/components/dataImporter/DataImporterShell.jsx";

vi.mock("@/components/dataImporter/DataImporterDeletedRowsDialog.jsx", () => ({
  default: () => <div data-testid="deleted-dialog" />,
}));

vi.mock("@/components/dataImporter/DataImporterColumnConfigDialog.jsx", () => ({
  default: () => <div data-testid="column-config-dialog" />,
}));

vi.mock("@/components/dataImporter/DataImporterDuplicateDiffDialog.jsx", () => ({
  default: () => <div data-testid="duplicate-diff-dialog" />,
}));

vi.mock("@/components/dataImporter/DataImporterDuplicateReviewDialog.jsx", () => ({
  default: () => <div data-testid="duplicate-review-dialog" />,
}));

vi.mock("@/components/dataImporter/DataImporterSummaryCards.jsx", () => ({
  default: () => <div data-testid="summary-cards" />,
}));

vi.mock("@/components/dataImporter/DataImporterWorkflowGuide.jsx", () => ({
  default: () => <div data-testid="workflow-guide" />,
}));

vi.mock("@/components/dataImporter/DataImporterUpdatedRowsBanner.jsx", () => ({
  default: () => <div data-testid="updated-rows-banner" />,
}));

vi.mock("@/components/dataImporter/DataImporterSyncConfigPanel.jsx", () => ({
  default: () => <div data-testid="sync-config-panel" />,
}));

vi.mock("@/components/dataImporter/DataImporterCoCodeConfigPanel.jsx", () => ({
  default: () => <div data-testid="co-code-panel" />,
}));

vi.mock("@/components/dataImporter/DataImporterMonitoringPanel.jsx", () => ({
  default: () => <div data-testid="monitoring-panel" />,
}));

vi.mock("@/components/dataImporter/DataImporterFileActions.jsx", () => ({
  default: () => <div data-testid="file-actions" />,
}));

vi.mock("@/components/dataImporter/DataImporterImportPreviewSummary.jsx", () => ({
  default: () => <div data-testid="import-preview-summary" />,
}));

vi.mock("@/components/dataImporter/DataImporterListControlsPanel.jsx", () => ({
  default: () => <div data-testid="list-controls-panel" />,
}));

vi.mock("@/components/dataImporter/DataImporterResultsPanel.jsx", () => ({
  default: () => <div data-testid="results-panel" />,
}));

function createProps(overrides = {}) {
  return {
    rootRef: React.createRef(),
    canUploadFiles: true,
    isReadOnlyForEdits: false,
    canManageAlerts: false,
    isAdminRole: false,
    mode: "saved",
    deletedRowsDialogProps: {},
    columnConfigDialogProps: {},
    duplicateDiffDialogProps: {},
    duplicateReviewDialogProps: {},
    workflowGuideProps: {},
    summaryCardsProps: {},
    updatedRowsBannerProps: {},
    syncConfigPanelProps: {},
    coCodeConfigProps: {},
    monitoringPanelProps: {},
    fileActionsProps: {},
    importPreviewSummaryProps: {},
    listControlsPanelProps: {},
    resultsPanelProps: {},
    ...overrides,
  };
}

describe("DataImporterShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders shared shell sections and preview-specific content", async () => {
    render(
      <DataImporterShell
        {...createProps({
          canUploadFiles: false,
          isReadOnlyForEdits: true,
          mode: "preview",
        })}
      />,
    );

    expect(screen.getByText(/Bạn chưa được cấp quyền tải file Import Data\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bảng tờ khai/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xem trước/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đồng bộ ECUS/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lịch sử/i })).toBeInTheDocument();
    expect(screen.queryByTestId("co-code-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("monitoring-panel")).not.toBeInTheDocument();
  });

  it("renders admin monitoring surfaces and review-only banner", async () => {
    render(
      <DataImporterShell
        {...createProps({
          isReadOnlyForEdits: true,
          canManageAlerts: true,
          isAdminRole: true,
          mode: "saved",
        })}
      />,
    );

    expect(
      screen.getByText(
        "Bạn có thể rà soát và đánh dấu các tờ khai thiếu thông tin nhưng không thể chỉnh sửa dữ liệu tờ khai.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/rà soát và đánh dấu/i)).toBeInTheDocument();
    expect(await screen.findByTestId("co-code-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("import-preview-summary")).not.toBeInTheDocument();
  });
});
