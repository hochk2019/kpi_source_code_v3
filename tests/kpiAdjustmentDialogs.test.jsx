import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emitCommand } = vi.hoisted(() => ({
  emitCommand: vi.fn(),
}));

vi.mock("@/lib/commandBus.js", () => ({
  emitCommand,
}));

import KpiAdjustmentDetailDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentDetailDialog.jsx";
import KpiAdjustmentGuidanceDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentGuidanceDialog.jsx";
import KpiAdjustmentSettingsDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx";

beforeEach(() => {
  emitCommand.mockReset();
});

describe("kpi adjustment dialogs", () => {
  it("renders detail dialog content and reject actions", async () => {
    const onDecisionNoteChange = vi.fn();
    const onClearLicenseCode = vi.fn();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <KpiAdjustmentDetailDialog
        open
        detailLabel="Chi tiết mục điểm"
        detailData={{
          staffName: "Lan",
          teamName: "Team 1",
          category: "support_misc",
          status: "pending",
          companyName: "Công ty A",
          taxCode: "0101234567",
          quantity: 2,
          unitPoints: 0.5,
          totalPoints: 1,
          note: "Điểm cố định thử nghiệm",
          references: ["TK001"],
          history: [{ id: "h1", ts: "2025-01-01T08:00:00.000Z", actor: "seed" }],
          licenseCode: "ZB03",
        }}
        detailCategoryConfig={{ extraPointConfig: { quantityLabel: "SL bổ sung", unitLabel: "Điểm bổ sung" } }}
        detailExtraQuantity={1}
        detailExtraUnit={0.5}
        detailExtraTotal={0.5}
        detailIntent="reject"
        statusLabels={{ pending: "Chờ duyệt" }}
        formatDecimal={(value) => Number(value || 0).toFixed(1)}
        formatDateTime={(value) => String(value)}
        decisionNote="Thiếu chứng từ"
        onDecisionNoteChange={onDecisionNoteChange}
        showClearLicenseAction
        onClearLicenseCode={onClearLicenseCode}
        onClose={onClose}
        onConfirm={onConfirm}
        decisionNoteFieldId="decision-note"
      />
    );

    const dialog = screen.getByTestId("kpi-adjust-detail-dialog");
    const queries = within(dialog);

    expect(queries.getByText("Lan")).toBeInTheDocument();
    expect(queries.getByText("Điểm cố định thử nghiệm")).toBeInTheDocument();
    expect(queries.getByText("TK001")).toBeInTheDocument();
    expect(queries.getByText("ZB03")).toBeInTheDocument();
    expect(queries.getByDisplayValue("Thiếu chứng từ")).toBeInTheDocument();

    await userEvent.click(queries.getByRole("button", { name: "Mở MST" }));
    await userEvent.click(queries.getByRole("button", { name: "Mở tờ khai TK001" }));

    await userEvent.type(queries.getByLabelText("Lý do từ chối (tuỳ chọn)"), " cập nhật");
    expect(onDecisionNoteChange).toHaveBeenCalled();

    await userEvent.click(queries.getByRole("button", { name: "Xóa mã giấy phép" }));
    expect(onClearLicenseCode).toHaveBeenCalledTimes(1);

    await userEvent.click(queries.getByRole("button", { name: "Từ chối" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(queries.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(emitCommand).toHaveBeenNthCalledWith(1, "navigate:tab", { tab: "mst", focus: "review" });
    expect(emitCommand).toHaveBeenNthCalledWith(2, "navigate:tab", { tab: "import", focus: "review" });
  });

  it("renders guidance dialog actions and accordion content", async () => {
    const onOpenChange = vi.fn();
    const onToggleFullscreen = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <KpiAdjustmentGuidanceDialog
        open
        fullscreen={false}
        guidanceGroups={[
          {
            key: "support",
            label: "Nhóm hỗ trợ",
            description: "Mô tả nhóm",
            items: [
              {
                key: "support_misc",
                label: "Hỗ trợ khác",
                hasOverride: true,
                modeLabel: "Theo chế độ",
                defaultUnit: 0.5,
                extraUnit: 0.2,
                extraLabel: "Điểm bổ sung mỗi đơn",
                calculation: "Điểm = số lượng x điểm mỗi đơn vị",
                licensePoints: [{ code: "ZB03", points: 1.5 }],
                gradeOptions: [{ value: "A", label: "Loại A" }],
                notes: ["Đang áp dụng cấu hình tuỳ chỉnh của đơn vị."],
              },
            ],
          },
        ]}
        formatDecimal={(value) => Number(value || 0).toFixed(1)}
        onOpenChange={onOpenChange}
        onToggleFullscreen={onToggleFullscreen}
        onOpenSettings={onOpenSettings}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Hướng dẫn nhập điểm KPI +/-" });
    const queries = within(dialog);

    await userEvent.click(queries.getByRole("button", { name: "Mở toàn màn hình" }));
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);

    await userEvent.click(queries.getByRole("button", { name: /Nhóm hỗ trợ/i }));
    expect(await queries.findByText("Điểm = số lượng x điểm mỗi đơn vị")).toBeInTheDocument();
    expect(queries.getByText("Đang áp dụng cấu hình tuỳ chỉnh của đơn vị.")).toBeInTheDocument();

    await userEvent.click(queries.getByRole("button", { name: "Mở phần cấu hình" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    await userEvent.click(queries.getByRole("button", { name: "Đã rõ" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits settings dialog fields and reset action", async () => {
    const onOpenChange = vi.fn();
    const onClose = vi.fn();
    const onReset = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());
    const onUpdateDraft = vi.fn();

    render(
      <KpiAdjustmentSettingsDialog
        open
        focusCategory="license_support"
        settingsDraft={{
          support_misc: {
            defaultUnit: "0.2",
            defaultMode: "dynamic",
            modeUnits: { dynamic: "0.2", fixed: "12" },
          },
          license_support: {
            defaultUnit: "1.5",
            licensePoints: { ZB03: "2.8" },
          },
        }}
        settingsError="Loi demo"
        settingsSaving={false}
        onOpenChange={onOpenChange}
        onClose={onClose}
        onReset={onReset}
        onSubmit={onSubmit}
        onUpdateDraft={onUpdateDraft}
        buildSettingsFieldId={(category, field) => `${category}-${field}`}
        buildLicenseFieldId={(category, code) => `${category}-license-${code}`}
      />
    );

    expect(screen.getByTestId("kpi-adjust-settings-focus-banner")).toHaveTextContent(
      "Đang chỉnh nhanh cho: Hỗ trợ xin giấy phép"
    );
    expect(screen.getByText("Loi demo")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Điểm mặc định", { selector: "#support_misc-default-unit" }));
    await userEvent.type(screen.getByLabelText("Điểm mặc định", { selector: "#support_misc-default-unit" }), "0.4");
    expect(onUpdateDraft).toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText("Chế độ mặc định"), "fixed");
    expect(onUpdateDraft).toHaveBeenCalledWith("support_misc", "defaultMode", "fixed");

    await userEvent.clear(screen.getByLabelText("Mã ZB03"));
    await userEvent.type(screen.getByLabelText("Mã ZB03"), "3.1");
    expect(onUpdateDraft).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Khôi phục mặc định" }));
    expect(onReset).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
