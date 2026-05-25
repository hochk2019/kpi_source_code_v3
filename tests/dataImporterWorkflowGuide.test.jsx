import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterWorkflowGuide from "@/components/dataImporter/DataImporterWorkflowGuide.jsx";

afterEach(() => {
  cleanup();
});

describe("DataImporterWorkflowGuide", () => {
  it("shows step 1 as current before an import source is selected", () => {
    const onOpenFilePicker = vi.fn();
    const onPreviewSync = vi.fn();
    const onLoadSavedRows = vi.fn();
    const user = userEvent.setup();

    render(
      <DataImporterWorkflowGuide
        mode="saved"
        canEdit={true}
        canUploadFiles={true}
        canManageSync={true}
        selectedFile=""
        previewRowCount={0}
        hasRows={false}
        hasUnsaved={false}
        onPreviewSync={onPreviewSync}
        onOpenFilePicker={onOpenFilePicker}
        onLoadSavedRows={onLoadSavedRows}
      />,
    );

    expect(screen.getByText(/GIAI ĐOẠN.*1\/3/)).toBeInTheDocument();
    expect(
      screen.getByText(/Chọn file XLSX hoặc chạy đồng bộ ECUS để bắt đầu\./i),
    ).toBeInTheDocument();

    return user.click(screen.getByRole("button", { name: "Xem trước ECUS" })).then(() => {
      expect(onPreviewSync).toHaveBeenCalledTimes(1);
      return user.click(screen.getByRole("button", { name: "Chọn file XLSX" }));
    }).then(() => {
      expect(onOpenFilePicker).toHaveBeenCalledTimes(1);
      return user.click(screen.getByRole("button", { name: "Hiển thị dữ liệu đã lưu" }));
    }).then(() => {
      expect(onLoadSavedRows).toHaveBeenCalledTimes(1);
    });
  });

  it("shows step 2 as current while preview rows are under review", () => {
    const onImport = vi.fn();
    const onOpenFilePicker = vi.fn();
    const user = userEvent.setup();

    render(
      <DataImporterWorkflowGuide
        mode="preview"
        canEdit={true}
        canUploadFiles={true}
        canManageSync={false}
        selectedFile="imports.xlsx"
        previewRowCount={24}
        hasRows={true}
        hasUnsaved={false}
        canImport={true}
        onImport={onImport}
        onOpenFilePicker={onOpenFilePicker}
      />,
    );

    expect(screen.getByText(/GIAI ĐOẠN.*2\/3/)).toBeInTheDocument();
    expect(screen.getByText(/24 dòng đang chờ rà soát trước khi lưu\./i)).toBeInTheDocument();

    return user.click(screen.getByRole("button", { name: "Import XLSX" })).then(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
      return user.click(screen.getByRole("button", { name: "Chọn file khác" }));
    }).then(() => {
      expect(onOpenFilePicker).toHaveBeenCalledTimes(1);
    });
  });

  it("shows sync review actions while ECUS preview rows are under review", () => {
    const onRunSync = vi.fn();
    const onPreviewSync = vi.fn();
    const onOpenFilePicker = vi.fn();
    const onLoadSavedRows = vi.fn();
    const user = userEvent.setup();

    render(
      <DataImporterWorkflowGuide
        mode="preview"
        canEdit={true}
        canImport={false}
        canUploadFiles={true}
        canManageSync={true}
        selectedFile=""
        previewRowCount={12}
        previewSource="sync"
        syncPreviewRowCount={12}
        hasRows={true}
        hasUnsaved={false}
        onRunSync={onRunSync}
        onPreviewSync={onPreviewSync}
        onOpenFilePicker={onOpenFilePicker}
        onLoadSavedRows={onLoadSavedRows}
      />,
    );

    expect(screen.getByText(/GIAI ĐOẠN.*2\/3/)).toBeInTheDocument();
    expect(screen.getByText(/12 dòng ECUS đang chờ rà soát trước khi đồng bộ\./i)).toBeInTheDocument();

    return user.click(screen.getByRole("button", { name: "Đồng bộ ngay" })).then(() => {
      expect(onRunSync).toHaveBeenCalledTimes(1);
      return user.click(screen.getByRole("button", { name: "Làm mới xem trước ECUS" }));
    }).then(() => {
      expect(onPreviewSync).toHaveBeenCalledTimes(1);
      return user.click(screen.getByRole("button", { name: "Chọn file XLSX" }));
    }).then(() => {
      expect(onOpenFilePicker).toHaveBeenCalledTimes(1);
      return user.click(screen.getByRole("button", { name: "Hiển thị dữ liệu đã lưu" }));
    }).then(() => {
      expect(onLoadSavedRows).toHaveBeenCalledTimes(1);
    });
  });

  it("shows step 3 as current and highlights unsaved work in saved mode", () => {
    const onSaveAll = vi.fn();
    const user = userEvent.setup();

    render(
      <DataImporterWorkflowGuide
        mode="saved"
        canEdit={true}
        canUploadFiles={true}
        canManageSync={false}
        selectedFile="imports.xlsx"
        previewRowCount={0}
        hasRows={true}
        hasUnsaved={true}
        canSave={true}
        onSaveAll={onSaveAll}
      />,
    );

    expect(screen.getByText(/GIAI ĐOẠN.*3\/3/)).toBeInTheDocument();
    expect(
      screen.getByText(/Bạn còn thay đổi chưa lưu trước khi chốt dữ liệu\./i),
    ).toBeInTheDocument();

    return user.click(screen.getByRole("button", { name: "Lưu dữ liệu" })).then(() => {
      expect(onSaveAll).toHaveBeenCalledTimes(1);
    });
  });

  it("promotes syncing when ECUS preview rows are already available", () => {
    const onRunSync = vi.fn();
    const onPreviewSync = vi.fn();
    const user = userEvent.setup();

    render(
      <DataImporterWorkflowGuide
        mode="saved"
        canEdit={true}
        canUploadFiles={true}
        canManageSync={true}
        selectedFile=""
        previewRowCount={0}
        syncPreviewRowCount={12}
        hasRows={false}
        hasUnsaved={false}
        syncRunning={false}
        previewLoading={false}
        onPreviewSync={onPreviewSync}
        onRunSync={onRunSync}
      />,
    );

    expect(
      screen.getByText(/12 dòng ECUS đã sẵn sàng để đồng bộ vào workspace\./i),
    ).toBeInTheDocument();

    return user.click(screen.getByRole("button", { name: "Đồng bộ ngay" })).then(() => {
      expect(onRunSync).toHaveBeenCalledTimes(1);
      return user.click(screen.getByRole("button", { name: "Làm mới xem trước ECUS" }));
    }).then(() => {
      expect(onPreviewSync).toHaveBeenCalledTimes(1);
    });
  });
});
