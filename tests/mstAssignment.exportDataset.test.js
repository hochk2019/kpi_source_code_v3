import { describe, expect, it, vi } from "vitest";

import {
  buildAssignmentMetadataIndex,
  buildMSTAssignmentExportRows,
} from "@/components/mst-assignment/model/exportDataset.js";

describe("mstAssignment exportDataset", () => {
  it("keeps the latest tracked assignment metadata per row key", () => {
    const metadataIndex = buildAssignmentMetadataIndex([
      {
        rowKey: "031__2025-03-01__",
        field: "person_import",
        actor: "alpha",
        timestamp: "2026-03-26T08:00:00.000Z",
      },
      {
        rowKey: "031__2025-03-01__",
        field: "effective_from",
        actor: "beta",
        timestamp: "2026-03-26T09:00:00.000Z",
      },
      {
        rowKey: "031__2025-03-01__",
        field: "status",
        actor: "ignored",
        timestamp: "2026-03-26T10:00:00.000Z",
      },
    ]);

    expect(metadataIndex.get("031__2025-03-01__")).toEqual({
      actor: "beta",
      timestamp: "2026-03-26T09:00:00.000Z",
      field: "effective_from",
      type: "",
    });
  });

  it("builds export rows with assignee metadata derived from history", () => {
    const rows = [
      {
        mst: "0312345678",
        company: "Công ty A",
        person_import: "An",
        person_export: "Bình",
        team: "Alpha",
        effective_from: "2025-03-01",
        effective_to: "",
        status: "assigned",
      },
      {
        mst: "0999999999",
        company: "Công ty B",
        status: "pending",
      },
    ];

    const result = buildMSTAssignmentExportRows({
      rows,
      computeStatusDisplay: vi.fn((row) => (row.mst === "0312345678" ? "Đang gán" : "")),
      historyEntries: [
        {
          rowKey: "0312345678__2025-03-01__",
          field: "person_export",
          actor: "lead.alpha",
          timestamp: "2026-03-26T10:30:00.000Z",
          type: "update",
        },
      ],
    });

    expect(result).toEqual([
      {
        STT: 1,
        MST: "0312345678",
        "Công ty": "Công ty A",
        "Người phụ trách Nhập": "An",
        "Người phụ trách Xuất": "Bình",
        "Tổ đội": "Alpha",
        "Áp dụng từ ngày": "2025-03-01",
        "Đến hết ngày": "",
        "Trạng thái": "Đang gán",
        "Người gán gần nhất": "lead.alpha",
        "Cập nhật gần nhất": "2026-03-26T10:30:00.000Z",
      },
      {
        STT: 2,
        MST: "0999999999",
        "Công ty": "Công ty B",
        "Người phụ trách Nhập": "",
        "Người phụ trách Xuất": "",
        "Tổ đội": "",
        "Áp dụng từ ngày": "",
        "Đến hết ngày": "",
        "Trạng thái": "pending",
        "Người gán gần nhất": "",
        "Cập nhật gần nhất": "",
      },
    ]);
  });
});
