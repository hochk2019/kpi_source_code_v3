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
    expect(
      screen.getByText(
        "Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản được cấp quyền để import, chỉnh sửa và lưu dữ liệu tờ khai.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("workflow-guide")).toBeInTheDocument();
    expect(screen.getByTestId("summary-cards")).toBeInTheDocument();
    expect(screen.getByTestId("updated-rows-banner")).toBeInTheDocument();
    expect(await screen.findByTestId("sync-config-panel")).toBeInTheDocument();
    expect(await screen.findByTestId("file-actions")).toBeInTheDocument();
    expect(await screen.findByTestId("import-preview-summary")).toBeInTheDocument();
    expect(await screen.findByTestId("list-controls-panel")).toBeInTheDocument();
    expect(await screen.findByTestId("results-panel")).toBeInTheDocument();
    const sourceStage = screen.getByRole("region", { name: "Bước 1: Nạp nguồn" });
    const reviewStage = screen.getByRole("region", { name: "Bước 2: Rà soát dữ liệu" });
    const saveStage = screen.getByRole("region", { name: "Bước 3: Lưu và theo dõi" });
    expect(sourceStage).toHaveAttribute("id", "data-importer-stage-1");
    expect(reviewStage).toHaveAttribute("id", "data-importer-stage-2");
    expect(saveStage).toHaveAttribute("id", "data-importer-stage-3");
    expect(within(sourceStage).getByTestId("sync-config-panel")).toBeInTheDocument();
    expect(within(sourceStage).getByTestId("file-actions")).toBeInTheDocument();
    expect(within(reviewStage).getByTestId("import-preview-summary")).toBeInTheDocument();
    expect(within(reviewStage).getByTestId("list-controls-panel")).toBeInTheDocument();
    expect(within(reviewStage).getByTestId("results-panel")).toBeInTheDocument();
    expect(within(saveStage).getByTestId("summary-cards")).toBeInTheDocument();
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
    const sourceStage = screen.getByRole("region", { name: "Bước 1: Nạp nguồn" });
    const saveStage = screen.getByRole("region", { name: "Bước 3: Lưu và theo dõi" });
    expect(await within(sourceStage).findByTestId("co-code-panel")).toBeInTheDocument();
    expect(await within(saveStage).findByTestId("results-panel")).toBeInTheDocument();
    expect(screen.getByTestId("co-code-panel")).toBeInTheDocument();
    expect(await screen.findByTestId("monitoring-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("import-preview-summary")).not.toBeInTheDocument();
  });
});
