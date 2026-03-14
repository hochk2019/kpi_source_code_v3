import { describe, expect, it } from "vitest";

import {
  createEmptyReportingViewModel,
  normalizeStoredReportingScheduleItems,
} from "../packages/api-client/src/index.js";

describe("packages/api-client", () => {
  it("exposes the reporting view-model fallback builder through the package boundary", () => {
    const report = createEmptyReportingViewModel({ from: "2026-03-01", to: "2026-03-31" });

    expect(report.range).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect(report.rules).toEqual({ id: "default", name: "Default KPI" });
    expect(report.staff.list).toEqual([]);
    expect(report.teams.list).toEqual([]);
  });

  it("normalizes stored schedule rows through the package boundary", () => {
    const schedules = normalizeStoredReportingScheduleItems([
      {
        id: "weekly-blue",
        name: "Weekly Blue",
        frequency: "weekly",
        time: "08:30",
        dayOfWeek: 1,
        formats: [" pdf ", "excel"],
        recipients: ["ops@example.com", " lead@example.com "],
        active: true,
      },
    ]);

    expect(schedules).toEqual([
      expect.objectContaining({
        id: "weekly-blue",
        formats: ["pdf", "excel"],
        recipients: ["ops@example.com", "lead@example.com"],
        formatsSummary: "PDF, EXCEL",
      }),
    ]);
  });
});
