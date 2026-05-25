import { describe, expect, it } from "vitest";

import {
  applyMergeField,
  clearDuplicateReviewFlags,
  compareDuplicateCandidates,
  describeRowStatus,
  extractRowTimestampDetail,
  formatDeclarationLabel,
  formatDuplicateGroupLabel,
  formatHistoryTimestamp,
  inferRowSource,
} from "@/components/dataImporter/dataImporterDuplicateReviewUtils.js";

describe("dataImporterDuplicateReviewUtils", () => {
  it("chon moc thoi gian moi nhat va gan nhan tuong ung", () => {
    const detail = extractRowTimestampDetail({
      created_at: "2025-03-01T00:00:00.000Z",
      reviewed_at: "2025-03-02T00:00:00.000Z",
      updatedAt: "2025-03-03T08:30:00.000Z",
    });

    expect(detail.field).toBe("updatedAt");
    expect(detail.label).toBe("Cập nhật gần nhất");
    expect(detail.timestamp).toBe(Date.parse("2025-03-03T08:30:00.000Z"));
    expect(detail.iso).toBe("2025-03-03T08:30:00.000Z");
  });

  it("suy ra source va status cho khai bao chua du thong tin", () => {
    expect(
      inferRowSource({
        synced_at: "2025-03-01T00:00:00.000Z",
      }),
    ).toEqual({ label: "Đồng bộ ECUS", code: "ecus" });

    expect(
      inferRowSource({
        sourceLabel: "Import đối soát",
      }),
    ).toEqual({ label: "Import đối soát", code: "Import đối soát" });

    expect(
      describeRowStatus({
        nhan_vien: "A",
        duplicate_review_pending: true,
      }),
    ).toBe("Cần xem lại trùng");

    expect(
      describeRowStatus({
        nhan_vien: "",
        team: "",
      }),
    ).toBe("Thiếu nhân viên & tổ đội");
  });

  it("sap xep duplicate theo timestamp roi den trong so bo sung", () => {
    const newer = {
      so_tk: "10203040506",
      updated_at: "2025-03-03T10:00:00.000Z",
      reviewed: false,
    };
    const olderButRicher = {
      so_tk: "10203040506",
      updated_at: "2025-03-01T10:00:00.000Z",
      reviewed: true,
      nhan_vien: "An",
      team: "OPS",
      licenseManualCount: 3,
    };

    expect(compareDuplicateCandidates(newer, olderButRicher)).toBeLessThan(0);
    expect(compareDuplicateCandidates(olderButRicher, newer)).toBeGreaterThan(0);
  });

  it("merge duoc field duplicate review va xoa co review pending", () => {
    const keeper = {
      so_tk: "10203040506",
      licenses: 1,
      so_luong_gp: 1,
      duplicate_review_pending: true,
      duplicate_review_note: "pending",
      duplicate_review_actor: "lead",
      duplicate_review_updated_at: "2025-03-01T00:00:00.000Z",
    };
    const source = {
      licenses: 4,
      reviewed: true,
      reviewed_at: "2025-03-02T00:00:00.000Z",
      reviewed_by: "manager",
    };

    applyMergeField(keeper, source, "licenses");
    applyMergeField(keeper, source, "reviewed");
    clearDuplicateReviewFlags(keeper);

    expect(keeper.licenses).toBe(4);
    expect(keeper.so_luong_gp).toBe(4);
    expect(keeper.reviewed).toBe(true);
    expect(keeper.reviewed_at).toBe("2025-03-02T00:00:00.000Z");
    expect(keeper.reviewed_by).toBe("manager");
    expect(keeper).not.toHaveProperty("duplicate_review_pending");
    expect(keeper).not.toHaveProperty("duplicate_review_note");
    expect(keeper).not.toHaveProperty("duplicate_review_actor");
    expect(keeper).not.toHaveProperty("duplicate_review_updated_at");
  });

  it("format nhan declaration, duplicate group va lich su theo mat do doc duoc", () => {
    expect(
      formatDeclarationLabel({
        so_tk_full: "1020304050601",
        nhanh: "HCM",
      }),
    ).toBe("1020304050601 (HCM)");

    expect(
      formatDuplicateGroupLabel({
        so_tk_full: "1020304050601",
        branch: "HN",
      }),
    ).toBe("10203040506 - HN");

    expect(formatHistoryTimestamp("2026-03-10T05:15:00.000Z")).toContain("10/03/2026");
  });
});
