import { describe, expect, it, vi } from "vitest";

import { createPostgresReportingProjectionPersistence } from "../../server-v4/src/persistence/reportingProjectionPostgres.ts";

describe("server-v4 postgres reporting projection persistence", () => {
  it("reads and writes reporting projection payloads through the postgres adapter", async () => {
    const pool = createFakePool();
    const persistence = createPostgresReportingProjectionPersistence("postgres://runtime/kpi", {
      pool,
    });
    const snapshot = {
      generatedAt: "2026-03-13T10:00:00.000Z",
      range: {
        from: "2026-02-01",
        to: "2026-02-28",
      },
      cache: {
        queryKey: '{"from":"2026-02-01","to":"2026-02-28","limit":0}',
      },
      total: 1,
      items: [{ period: "2026-02" }],
    };

    await persistence.writeValue("kpi_reporting_monthly_aggregates_v1", snapshot);

    await expect(
      persistence.readValue("kpi_reporting_monthly_aggregates_v1"),
    ).resolves.toEqual(snapshot);
    expect(pool.query).toHaveBeenCalled();
  });

  it("derives observability items from stored projection payloads", async () => {
    const pool = createFakePool({
      kpi_reporting_monthly_aggregates_v1: {
        generatedAt: "2026-03-13T10:00:00.000Z",
        total: 2,
        items: [{ period: "2026-02" }, { period: "2026-01" }],
      },
      kpi_reporting_job_runs_v1: [
        { id: "job-2", status: "success" },
        { id: "job-1", status: "error" },
      ],
    });
    const persistence = createPostgresReportingProjectionPersistence("postgres://runtime/kpi", {
      pool,
    });

    await expect(
      persistence.readMonthlyAggregateEntries("kpi_reporting_monthly_aggregates_v1"),
    ).resolves.toEqual([{ period: "2026-02" }, { period: "2026-01" }]);
    await expect(persistence.readJobRunEntries("kpi_reporting_job_runs_v1")).resolves.toEqual([
      { id: "job-2", status: "success" },
      { id: "job-1", status: "error" },
    ]);
  });

  it("deletes stored payloads and disposes the underlying pool", async () => {
    const pool = createFakePool({
      kpi_report_schedule_v1: [{ id: "schedule-1" }],
    });
    const persistence = createPostgresReportingProjectionPersistence("postgres://runtime/kpi", {
      pool,
    });

    await persistence.deleteValue("kpi_report_schedule_v1");

    await expect(persistence.readValue("kpi_report_schedule_v1")).resolves.toBeNull();
    await persistence.dispose();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it("allows callers to keep pool ownership when managePool is false", async () => {
    const pool = createFakePool();
    const persistence = createPostgresReportingProjectionPersistence("postgres://runtime/kpi", {
      pool,
      managePool: false,
    });

    await persistence.dispose();

    expect(pool.end).not.toHaveBeenCalled();
  });
});

function createFakePool(initialState = {}) {
  const rowsByKey = new Map(Object.entries(initialState));

  return {
    query: vi.fn(async (sql, values = []) => {
      if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
        return { rows: [] };
      }

      if (sql.includes("SELECT payload FROM reporting_projections WHERE projection_key =")) {
        const key = values[0];
        return {
          rows: rowsByKey.has(key) ? [{ payload: rowsByKey.get(key) }] : [],
        };
      }

      if (sql.includes("INSERT INTO reporting_projections")) {
        const key = values[0];
        const payload = values[7];
        rowsByKey.set(key, typeof payload === "string" ? JSON.parse(payload) : payload);
        return { rows: [] };
      }

      if (sql.includes("DELETE FROM reporting_projections WHERE projection_key =")) {
        rowsByKey.delete(values[0]);
        return { rows: [] };
      }

      throw new Error(`Unexpected SQL in fake pool: ${sql}`);
    }),
    end: vi.fn(async () => {}),
  };
}
