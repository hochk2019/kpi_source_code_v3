import { describe, expect, it } from "vitest";

import {
  createScheduleDraft,
  toSchedulePayload,
} from "@/components/reporting/reportingScheduleDraft.js";

describe("reportingScheduleDraft", () => {
  it("normalizes raw schedule entries into editable draft state", () => {
    expect(
      createScheduleDraft({
        id: "weekly-kpi",
        name: "KPI tuần",
        recipients: ["ceo@company.vn", "ops@company.vn"],
        formats: [],
        active: true,
      }),
    ).toMatchObject({
      id: "weekly-kpi",
      name: "KPI tuần",
      recipientsInput: "ceo@company.vn, ops@company.vn",
      formats: ["excel"],
      active: true,
    });
  });

  it("serializes monthly drafts with fallback format and recipients", () => {
    expect(
      toSchedulePayload({
        id: "monthly-kpi",
        name: "KPI tháng",
        frequency: "monthly",
        dayOfWeek: 1,
        dayOfMonth: 15,
        time: "08:00",
        recipientsInput: "ceo@company.vn",
        formats: [],
        active: 1,
      }),
    ).toEqual({
      id: "monthly-kpi",
      name: "KPI tháng",
      frequency: "monthly",
      dayOfWeek: null,
      dayOfMonth: 15,
      time: "08:00",
      recipients: "ceo@company.vn",
      formats: ["excel"],
      deliveryChannels: ["email"],
      active: true,
    });
  });
});
