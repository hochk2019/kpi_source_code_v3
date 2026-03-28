import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useReportViewerActions,
  validateReportExportPermission,
} from "@/components/reporting/useReportViewerActions.js";

const {
  saveReportingScheduleMock,
  deleteReportingScheduleMock,
  toastMock,
} = vi.hoisted(() => ({
  saveReportingScheduleMock: vi.fn(),
  deleteReportingScheduleMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../packages/api-client/src/reportingClient.js", () => ({
  saveReportingSchedule: saveReportingScheduleMock,
  deleteReportingSchedule: deleteReportingScheduleMock,
}));

vi.mock("@/shared/toast.js", () => ({
  toast: toastMock,
}));

describe("useReportViewerActions", () => {
  beforeEach(() => {
    saveReportingScheduleMock.mockReset();
    deleteReportingScheduleMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    toastMock.warning.mockReset();
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("validates export permission before invoking the exporter", async () => {
    expect(
      validateReportExportPermission({
        canExport: false,
        summary: { decls: 10 },
      }),
    ).toMatch(/khong duoc phep xuat bao cao/i);

    const { result } = renderHook(() =>
      useReportViewerActions({
        canExport: false,
        summary: { decls: 10 },
        report: { range: {}, rules: {} },
        exportColumns: {},
      }),
    );

    await act(async () => {
      await result.current.handleExportStaffAll();
    });

    expect(window.alert).toHaveBeenCalledWith(
      expect.stringMatching(/khong duoc phep xuat bao cao/i),
    );
    expect(result.current.exporting).toBe(false);
  });

  it("saves schedule drafts and rehydrates editor state from the saved payload", async () => {
    saveReportingScheduleMock.mockResolvedValue({
      id: "schedule-1",
      name: "Bao cao thu 2",
      frequency: "weekly",
      dayOfWeek: 1,
      time: "08:00",
      deliveryChannels: ["email", "report_center"],
      recipients: ["ops@example.com"],
      formats: ["excel", "csv"],
      active: true,
    });

    const { result } = renderHook(() =>
      useReportViewerActions({
        canExport: true,
        summary: { decls: 10 },
        report: { range: {}, rules: {} },
        exportColumns: {},
      }),
    );

    act(() => {
      result.current.handleScheduleFieldChange("name", "Bao cao thu 2");
      result.current.handleScheduleFieldChange("recipientsInput", "ops@example.com");
      result.current.handleToggleScheduleFormat("csv");
    });

    await act(async () => {
      await result.current.handleSaveSchedule({ preventDefault: vi.fn() });
    });

    expect(saveReportingScheduleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Bao cao thu 2",
        recipients: "ops@example.com",
        formats: ["excel", "csv"],
        deliveryChannels: ["email"],
      }),
      { actor: "ui.report" },
    );
    expect(result.current.editingScheduleId).toBe("schedule-1");
    expect(result.current.scheduleDraft.recipientsInput).toBe("ops@example.com");
    expect(result.current.scheduleDraft.formats).toEqual(["excel", "csv"]);
    expect(result.current.scheduleDraft.deliveryChannels).toEqual(["email", "report_center"]);
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringMatching(/da luu lich gui/i));
  });

  it("allows non-email delivery channels without requiring recipients", async () => {
    saveReportingScheduleMock.mockResolvedValue({
      id: "schedule-3",
      name: "Bao cao report center",
      frequency: "weekly",
      dayOfWeek: 1,
      time: "08:00",
      deliveryChannels: ["report_center"],
      recipients: [],
      formats: ["excel"],
      active: true,
    });

    const { result } = renderHook(() =>
      useReportViewerActions({
        canExport: true,
        summary: { decls: 10 },
        report: { range: {}, rules: {} },
        exportColumns: {},
      }),
    );

    act(() => {
      result.current.handleScheduleFieldChange("name", "Bao cao report center");
      result.current.handleToggleDeliveryChannel("email");
      result.current.handleToggleDeliveryChannel("report_center");
    });

    await act(async () => {
      await result.current.handleSaveSchedule({ preventDefault: vi.fn() });
    });

    expect(saveReportingScheduleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Bao cao report center",
        recipients: "",
        deliveryChannels: ["report_center"],
      }),
      { actor: "ui.report" },
    );
    expect(toastMock.warning).not.toHaveBeenCalled();
  });

  it("deletes the active schedule and resets the editor when the record is removed", async () => {
    deleteReportingScheduleMock.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useReportViewerActions({
        canExport: true,
        summary: { decls: 10 },
        report: { range: {}, rules: {} },
        exportColumns: {},
      }),
    );

    act(() => {
      result.current.handleEditSchedule({
        id: "schedule-2",
        name: "Bao cao toi",
        recipients: ["lead@example.com"],
      });
    });

    await act(async () => {
      await result.current.handleDeleteSchedule({
        id: "schedule-2",
        name: "Bao cao toi",
      });
    });

    expect(deleteReportingScheduleMock).toHaveBeenCalledWith("schedule-2", { actor: "ui.report" });
    expect(result.current.editingScheduleId).toBe("");
    expect(result.current.scheduleDraft.name).toBe("");
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringMatching(/da xoa lich gui/i));
  });
});
