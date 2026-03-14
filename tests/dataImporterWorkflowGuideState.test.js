import { describe, expect, it } from "vitest";

import {
  buildWorkflowGuideState,
  getWorkflowStageStatus,
} from "@/components/dataImporter/dataImporterWorkflowGuideState.js";

describe("dataImporterWorkflowGuideState", () => {
  it("builds step-1 guidance and actions before any rows are in the workspace", () => {
    const state = buildWorkflowGuideState({
      mode: "saved",
      canEdit: true,
      canImport: false,
      canSave: false,
      canUploadFiles: true,
      canManageSync: true,
      selectedFile: "",
      previewRowCount: 0,
      hasRows: false,
      hasUnsaved: false,
      onOpenFilePicker: () => {},
      onImport: () => {},
      onPreviewSync: () => {},
      onRunSync: () => {},
      onLoadSavedRows: () => {},
      onSaveAll: () => {},
    });

    expect(state.currentStep).toBe(1);
    expect(state.headline).toBe("Chọn file XLSX hoặc chạy đồng bộ ECUS để bắt đầu.");
    expect(state.actions.map((action) => action.label)).toEqual([
      "Xem trước ECUS",
      "Chọn file XLSX",
      "Hiển thị dữ liệu đã lưu",
    ]);
    expect(state.steps.map((step) => step.targetId)).toEqual([
      "data-importer-stage-1",
      "data-importer-stage-2",
      "data-importer-stage-3",
    ]);
    expect(getWorkflowStageStatus(1, state.currentStep).label).toBe("Đang xử lý");
    expect(getWorkflowStageStatus(2, state.currentStep).label).toBe("Đang chờ");
  });

  it("builds step-2 review guidance while preview rows are pending import", () => {
    const state = buildWorkflowGuideState({
      mode: "preview",
      canEdit: true,
      canImport: true,
      canSave: false,
      canUploadFiles: true,
      canManageSync: false,
      selectedFile: "imports.xlsx",
      previewRowCount: 24,
      hasRows: true,
      hasUnsaved: false,
      onOpenFilePicker: () => {},
      onImport: () => {},
      onPreviewSync: () => {},
      onRunSync: () => {},
      onLoadSavedRows: () => {},
      onSaveAll: () => {},
    });

    expect(state.currentStep).toBe(2);
    expect(state.headline).toBe("24 dòng đang chờ rà soát trước khi lưu.");
    expect(state.actions.map((action) => action.label)).toEqual([
      "Import XLSX",
      "Chọn file khác",
    ]);
    expect(getWorkflowStageStatus(1, state.currentStep).label).toBe("Đã xong");
    expect(getWorkflowStageStatus(2, state.currentStep).label).toBe("Đang xử lý");
  });

  it("builds sync-review guidance while ECUS preview rows are under review", () => {
    const state = buildWorkflowGuideState({
      mode: "preview",
      canEdit: true,
      canImport: false,
      canSave: false,
      canUploadFiles: true,
      canManageSync: true,
      selectedFile: "",
      previewRowCount: 12,
      previewSource: "sync",
      syncPreviewRowCount: 12,
      hasRows: true,
      hasUnsaved: false,
      onOpenFilePicker: () => {},
      onImport: () => {},
      onPreviewSync: () => {},
      onRunSync: () => {},
      onLoadSavedRows: () => {},
      onSaveAll: () => {},
    });

    expect(state.currentStep).toBe(2);
    expect(state.headline).toBe("12 dòng ECUS đang chờ rà soát trước khi đồng bộ.");
    expect(state.actions.map((action) => action.label)).toEqual([
      "Đồng bộ ngay",
      "Làm mới xem trước ECUS",
      "Chọn file XLSX",
      "Hiển thị dữ liệu đã lưu",
    ]);
    expect(state.steps[1].detail).toContain("12 dòng xem trước từ ECUS");
  });

  it("builds step-3 save guidance once rows are in the saved workspace", () => {
    const state = buildWorkflowGuideState({
      mode: "saved",
      canEdit: true,
      canImport: false,
      canSave: true,
      canUploadFiles: true,
      canManageSync: false,
      selectedFile: "imports.xlsx",
      previewRowCount: 0,
      hasRows: true,
      hasUnsaved: true,
      onOpenFilePicker: () => {},
      onImport: () => {},
      onPreviewSync: () => {},
      onRunSync: () => {},
      onLoadSavedRows: () => {},
      onSaveAll: () => {},
    });

    expect(state.currentStep).toBe(3);
    expect(state.headline).toBe("Bạn còn thay đổi chưa lưu trước khi chốt dữ liệu.");
    expect(state.actions.map((action) => action.label)).toEqual([
      "Lưu dữ liệu",
      "Hiển thị dữ liệu đã lưu",
    ]);
    expect(getWorkflowStageStatus(2, state.currentStep).label).toBe("Đã xong");
    expect(getWorkflowStageStatus(3, state.currentStep).label).toBe("Đang xử lý");
  });

  it("prioritizes syncing when ECUS preview rows are ready", () => {
    const state = buildWorkflowGuideState({
      mode: "saved",
      canEdit: true,
      canImport: false,
      canSave: false,
      canUploadFiles: true,
      canManageSync: true,
      selectedFile: "",
      previewRowCount: 0,
      syncPreviewRowCount: 12,
      hasRows: false,
      hasUnsaved: false,
      onOpenFilePicker: () => {},
      onImport: () => {},
      onPreviewSync: () => {},
      onRunSync: () => {},
      onLoadSavedRows: () => {},
      onSaveAll: () => {},
    });

    expect(state.currentStep).toBe(1);
    expect(state.headline).toBe("12 dòng ECUS đã sẵn sàng để đồng bộ vào workspace.");
    expect(state.actions.map((action) => action.label)).toEqual([
      "Đồng bộ ngay",
      "Làm mới xem trước ECUS",
      "Chọn file XLSX",
      "Hiển thị dữ liệu đã lưu",
    ]);
    expect(state.steps[0].detail).toContain("12 dòng ECUS");
  });
});
