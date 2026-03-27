import { describe, expect, it } from "vitest";

import {
  MST_HISTORY_FIELD_LABELS,
  formatTeamManagerHistoryTimestamp,
} from "@/components/team-manager/teamManagerHistoryModel.js";

describe("teamManagerHistoryModel", () => {
  it("exposes stable MST field labels", () => {
    expect(MST_HISTORY_FIELD_LABELS.person_import).toBe("Người phụ trách Nhập");
    expect(MST_HISTORY_FIELD_LABELS.person_export).toBe("Người phụ trách Xuất");
    expect(MST_HISTORY_FIELD_LABELS.effective_from).toBe("Áp dụng từ ngày");
  });

  it("formats timestamps and keeps empty values blank", () => {
    expect(formatTeamManagerHistoryTimestamp("2025-03-01T10:15:00Z")).toMatch(
      /2025|01\/03\/2025|03\/01\/2025/,
    );
    expect(formatTeamManagerHistoryTimestamp("")).toBe("");
    expect(formatTeamManagerHistoryTimestamp(null)).toBe("");
  });
});
