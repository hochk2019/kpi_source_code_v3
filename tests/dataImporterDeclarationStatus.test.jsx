import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { DeclarationStatusDisplay } from "@/components/dataImporter/DataImporterDeclarationStatus.jsx";
import { resolveDeclarationStatus } from "@/components/dataImporter/dataImporterDeclarationStatus.js";

afterEach(() => {
  cleanup();
});

describe("DataImporter declaration status", () => {
  it("đánh dấu trạng thái chờ gán khi thiếu nhân viên và tổ đội", () => {
    const status = resolveDeclarationStatus({
      so_tk: "TK-001",
      nhan_vien: "",
      team: "",
    });

    expect(status).toMatchObject({
      key: "pending-assignment",
      label: "Chờ gán",
      tone: "warning",
    });
    expect(status.detail).toBe("Thiếu nhân viên & tổ đội");
  });

  it("đánh dấu trạng thái cần xem lại cho bản ghi trùng đang chờ rà soát", () => {
    const status = resolveDeclarationStatus({
      so_tk: "TK-002",
      duplicate_review_pending: true,
      duplicate_review_note: "Gộp bản ghi trùng",
      duplicate_review_actor: "Người rà",
      duplicate_review_updated_at: "2025-07-05T08:15:00.000Z",
    });

    expect(status).toMatchObject({
      key: "needs-review",
      label: "Cần xem lại",
      tone: "danger",
    });
    expect(status.detail).toContain("Gộp bản ghi trùng");
    expect(status.detail).toContain("Bởi Người rà");
  });

  it("đánh dấu trạng thái đã rà soát khi bản ghi đã được review", () => {
    const status = resolveDeclarationStatus({
      so_tk: "TK-003",
      reviewed: true,
      reviewed_by: "Trưởng nhóm",
      reviewed_at: "2025-07-06T09:45:00.000Z",
    });

    expect(status).toMatchObject({
      key: "reviewed",
      label: "Đã rà soát",
      tone: "success",
    });
    expect(status.detail).toContain("Bởi Trưởng nhóm");
  });

  it("đánh dấu mới import khi bản ghi đã có gán và thời gian cập nhật", () => {
    const status = resolveDeclarationStatus({
      so_tk: "TK-004",
      nhan_vien: "Nhân viên A",
      team: "Tổ A",
      imported_at: "2025-07-07T01:00:00.000Z",
    });

    expect(status).toMatchObject({
      key: "new",
      label: "Mới import",
      tone: "info",
    });
    expect(status.detail.startsWith("Cập nhật ")).toBe(true);
  });

  it("render badge và detail đúng với size tùy chọn", () => {
    render(
      <DeclarationStatusDisplay
        row={{
          so_tk: "TK-005",
          duplicate_review_pending: true,
          duplicate_review_note: "Thiếu chứng từ",
          duplicate_review_actor: "Leader",
        }}
        withDetail
        size="xs"
        className="custom-wrapper"
      />,
    );

    const badge = screen.getByText(/Cần xem lại/i).closest(".ds-status-badge");

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("text-[10px]");
    expect(screen.getByText(/Cần xem lại/i).closest(".custom-wrapper")).toBeInTheDocument();
    expect(screen.getByText(/Thiếu chứng từ/)).toBeInTheDocument();
  });

  it("ẩn detail khi withDetail = false", () => {
    render(
      <DeclarationStatusDisplay
        row={{
          so_tk: "TK-006",
          nhan_vien: "",
          team: "",
        }}
      />,
    );

    expect(screen.getByText(/Chờ gán/i)).toBeInTheDocument();
    expect(screen.queryByText(/Thiếu nhân viên & tổ đội/i)).not.toBeInTheDocument();
  });
});
