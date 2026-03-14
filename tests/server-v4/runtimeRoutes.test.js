import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import {
  writeAdjustmentRowsSnapshot,
  writeDeclarationRowsSnapshot,
  writeMstAssignmentRowsSnapshot,
  writeRuleCollectionSnapshot,
} from '../../server/businessSnapshotSqlite.js';
import { writeReportingProjectionValue } from '../../server/reportingProjectionSqlite.js';
import { writeTeamRosterSnapshot } from '../../server/teamRosterSqlite.js';
import { buildV4App } from '../../server-v4/src/index.ts';

function createLegacyDb(seed = {}) {
  const dbFile = path.join(
    os.tmpdir(),
    `server-v4-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`
  );
  const db = new Database(dbFile);
  db.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

  const insert = db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(seed)) {
    insert.run(key, JSON.stringify(value));
  }

  materializeTypedBusinessSnapshots(db, seed);

  db.close();
  return dbFile;
}

function materializeTypedBusinessSnapshots(db, seed = {}) {
  if (Object.prototype.hasOwnProperty.call(seed, 'decl_rows_v1')) {
    writeDeclarationRowsSnapshot(db, Array.isArray(seed.decl_rows_v1) ? seed.decl_rows_v1 : []);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'mst_rows_v2')) {
    writeMstAssignmentRowsSnapshot(db, Array.isArray(seed.mst_rows_v2) ? seed.mst_rows_v2 : []);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'team_roster_v1')) {
    const roster =
      seed.team_roster_v1 && typeof seed.team_roster_v1 === 'object'
        ? seed.team_roster_v1
        : { version: 1, teams: [] };
    writeTeamRosterSnapshot(db, roster);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_rules_v2')) {
    const rules =
      seed.kpi_rules_v2 && typeof seed.kpi_rules_v2 === 'object'
        ? seed.kpi_rules_v2
        : { version: 2, activeId: 'default', sets: [] };
    writeRuleCollectionSnapshot(db, rules);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_adjustments_v1')) {
    writeAdjustmentRowsSnapshot(db, Array.isArray(seed.kpi_adjustments_v1) ? seed.kpi_adjustments_v1 : []);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_report_schedule_v1')) {
    writeReportingProjectionValue(
      db,
      'kpi_report_schedule_v1',
      Array.isArray(seed.kpi_report_schedule_v1) ? seed.kpi_report_schedule_v1 : [],
    );
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_reporting_monthly_aggregates_v1')) {
    const snapshot =
      seed.kpi_reporting_monthly_aggregates_v1 &&
      typeof seed.kpi_reporting_monthly_aggregates_v1 === 'object' &&
      !Array.isArray(seed.kpi_reporting_monthly_aggregates_v1)
        ? seed.kpi_reporting_monthly_aggregates_v1
        : null;
    if (snapshot) {
      writeReportingProjectionValue(db, 'kpi_reporting_monthly_aggregates_v1', snapshot);
    }
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_reporting_monthly_aggregates_default_v1')) {
    const snapshot =
      seed.kpi_reporting_monthly_aggregates_default_v1 &&
      typeof seed.kpi_reporting_monthly_aggregates_default_v1 === 'object' &&
      !Array.isArray(seed.kpi_reporting_monthly_aggregates_default_v1)
        ? seed.kpi_reporting_monthly_aggregates_default_v1
        : null;
    if (snapshot) {
      writeReportingProjectionValue(db, 'kpi_reporting_monthly_aggregates_default_v1', snapshot);
    }
  }
}

const tempFiles = [];

function registerTempDb(seed) {
  const dbFile = createLegacyDb(seed);
  tempFiles.push(dbFile);
  return dbFile;
}

function createReportingSeed() {
  return {
    decl_rows_v1: [
      {
        date: '2026-02-14',
        so_tk: 'TK1',
        loai_hinh: 'A11',
        nhan_vien: 'Lan',
        team: 'Blue Team',
        num_items: 1,
      },
      {
        date: '2026-02-15',
        so_tk: 'TK2',
        loai_hinh: 'A11',
        nhan_vien: 'Lan',
        team: 'Blue Team',
        num_items: 2,
      },
    ],
    team_roster_v1: {
      version: 1,
      teams: [
        {
          name: 'Blue Team',
          members: [{ name: 'Lan' }],
        },
      ],
    },
    kpi_rules_v2: {
      id: 'legacy-kpi',
      name: 'Legacy KPI',
      description: 'Rule set imported from legacy storage',
      groups: {
        group1: {
          key: 'group1',
          title: 'Nhóm 1',
          description: 'Legacy group',
          codes: ['A11'],
          base: 0.5,
          perItem: 0.2,
          tierMode: 'per_item',
          tiers: [],
        },
      },
      license: {
        defaultPoints: 0,
        codePoints: [],
        exclude: {
          codes: [],
          agencies: [],
        },
      },
      bonuses: {
        co: {
          enabled: false,
          label: 'C/O',
          points: 0,
          perLine: 0,
        },
      },
    },
    kpi_report_schedule_v1: [
      {
        id: 'weekly-blue',
        name: 'Weekly Blue',
        frequency: 'weekly',
        dayOfWeek: 1,
        time: '08:30',
        formats: ['pdf', 'excel', 'pdf'],
        recipients: ['ops@example.com', '', 'lead@example.com'],
        active: true,
        lastRun: '2026-03-02T01:30:00.000Z',
      },
      {
        id: 'monthly-finance',
        name: 'Monthly Finance',
        frequency: 'monthly',
        dayOfMonth: 20,
        time: '09:15',
        formats: ['pdf'],
        recipients: ['finance@example.com'],
        active: false,
        lastRun: '2026-02-20T02:15:00.000Z',
      },
    ],
  };
}

function createReportingAggregateSeed() {
  const seed = createReportingSeed();
  seed.decl_rows_v1 = [
    {
      date: '2026-01-10',
      so_tk: 'TK0',
      loai_hinh: 'A11',
      nhan_vien: 'Lan',
      team: 'Blue Team',
      num_items: 1,
    },
    ...seed.decl_rows_v1,
  ];
  return seed;
}

function createMonthlyAggregateQueryKey(query = {}) {
  return JSON.stringify({
    from: typeof query.from === 'string' ? query.from.trim() : '',
    to: typeof query.to === 'string' ? query.to.trim() : '',
    limit: Number.isFinite(query.limit) && query.limit > 0 ? Math.trunc(query.limit) : 0,
  });
}

function createStoredMonthlyAggregateSnapshot() {
  return {
    range: {
      from: '2026-01-01',
      to: '2026-02-28',
    },
    ruleSet: {
      id: 'legacy-kpi',
      name: 'Legacy KPI',
    },
    generatedAt: '2026-03-09T09:00:00.000Z',
    total: 2,
    items: [
      {
        period: '2026-02',
        label: '02/2026',
        range: {
          from: '2026-02-01',
          to: '2026-02-28',
        },
        summary: {
          decls: 2,
          import: 0,
          export: 0,
          items: 3,
          licenses: 0,
          kpi: 1.6,
          co: 0,
          coLines: 0,
          companyCount: 0,
          licenseSummary: '—',
          adjustmentTotals: {},
          licenseCodes: [],
          licenseCount: 0,
        },
        topTeams: [
          {
            key: 'blue team',
            name: 'Blue Team',
            stats: {
              decls: 2,
              import: 0,
              export: 0,
              items: 3,
              licenses: 0,
              kpi: 1.6,
              co: 0,
              coLines: 0,
              companyCount: 0,
              licenseSummary: '—',
              adjustmentTotals: {},
              licenseCodes: [],
              licenseCount: 0,
            },
          },
        ],
        topStaff: [
          {
            key: 'lan',
            name: 'Lan',
            teamLabel: 'Blue Team',
            stats: {
              decls: 2,
              import: 0,
              export: 0,
              items: 3,
              licenses: 0,
              kpi: 1.6,
              co: 0,
              coLines: 0,
              companyCount: 0,
              licenseSummary: '—',
              adjustmentTotals: {},
              licenseCodes: [],
              licenseCount: 0,
            },
          },
        ],
      },
      {
        period: '2026-01',
        label: '01/2026',
        range: {
          from: '2026-01-01',
          to: '2026-01-31',
        },
        summary: {
          decls: 1,
          import: 0,
          export: 0,
          items: 1,
          licenses: 0,
          kpi: 0.7,
          co: 0,
          coLines: 0,
          companyCount: 0,
          licenseSummary: '—',
          adjustmentTotals: {},
          licenseCodes: [],
          licenseCount: 0,
        },
        topTeams: [],
        topStaff: [],
      },
    ],
    cache: {
      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),
      reused: false,
    },
  };
}

afterEach(() => {
  while (tempFiles.length > 0) {
    const dbFile = tempFiles.pop();
    if (dbFile && fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
  }
});

describe('server-v4 runtime routes', () => {
  it('lists sanitized teams from the legacy kv_store snapshot', async () => {
    const dbFile = registerTempDb({
      team_roster_v1: {
        version: 7,
        teams: [
          {
            name: 'Blue Team',
            members: [{ name: 'Lan' }, { id: 'custom-member', name: 'Minh', notes: 'Lead' }],
          },
        ],
      },
    });

    const app = buildV4App({ dbFile });
    const response = await request(app).get('/api/v4/teams');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        version: 1,
        teams: [
          {
            id: 'team-blue-team',
            memberCount: 2,
            members: [
              { id: 'team-blue-team-lan', name: 'Lan' },
              { id: 'custom-member', name: 'Minh', notes: 'Lead' },
            ],
            name: 'Blue Team',
          },
        ],
      },
    });
  });

  it('prefers the typed team snapshot over the legacy blob when both exist', async () => {
    const dbFile = registerTempDb({
      team_roster_v1: {
        version: 1,
        teams: [{ name: 'Legacy Blob Team', members: [{ name: 'Blob User' }] }],
      },
    });
    const db = new Database(dbFile);
    writeTeamRosterSnapshot(db, {
      version: 1,
      teams: [
        {
          name: 'Typed Blue Team',
          members: [{ name: 'Lan' }, { id: 'custom-member', name: 'Minh', notes: 'Lead' }],
        },
      ],
    });
    db.close();

    const app = buildV4App({ dbFile });
    const response = await request(app).get('/api/v4/teams');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        version: 1,
        teams: [
          {
            id: 'team-typed-blue-team',
            memberCount: 2,
            members: [
              { id: 'team-typed-blue-team-lan', name: 'Lan' },
              { id: 'custom-member', name: 'Minh', notes: 'Lead' },
            ],
            name: 'Typed Blue Team',
          },
        ],
      },
    });
  });

  it('lists MST rows and resolves the active assignment for a target date', async () => {
    const dbFile = registerTempDb({
      mst_rows_v2: [
        {
          mst: '0101234567',
          company: 'Cong ty A',
          person_import: 'Lan',
          person_export: '',
          team: 'Blue Team',
          effective_from: '2026-01-01',
          effective_to: '2026-01-31',
        },
        {
          mst: '0101234567',
          company: 'Cong ty A',
          person_import: 'Minh',
          person_export: 'Bao',
          team: 'Blue Team',
          effective_from: '2026-02-01',
          effective_to: '',
        },
      ],
    });

    const app = buildV4App({ dbFile });

    const listResponse = await request(app).get('/api/v4/mst-assignments').query({ mst: '0101234567' });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.data.items).toEqual([
      {
        company: 'Cong ty A',
        effective_from: '2026-01-01',
        effective_to: '2026-01-31',
        mst: '0101234567',
        person_export: '',
        person_import: 'Lan',
        status: 'assigned',
        team: 'Blue Team',
      },
      {
        company: 'Cong ty A',
        effective_from: '2026-02-01',
        effective_to: '',
        mst: '0101234567',
        person_export: 'Bao',
        person_import: 'Minh',
        status: 'assigned',
        team: 'Blue Team',
      },
    ]);

    const resolveResponse = await request(app)
      .get('/api/v4/mst-assignments/resolve')
      .query({ mst: '0101234567', date: '2026-02-14' });

    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body).toEqual({
      ok: true,
      data: {
        assignment: {
          company: 'Cong ty A',
          effective_from: '2026-02-01',
          effective_to: '',
          mst: '0101234567',
          person_export: 'Bao',
          person_import: 'Minh',
          status: 'assigned',
          team: 'Blue Team',
        },
      },
    });
  });

  it('prefers the typed MST snapshot over the stale blob on /api/v4/mst-assignments', async () => {
    const dbFile = registerTempDb({
      mst_rows_v2: [{ mst: '0999999999', company: 'Blob Co', person_import: 'Blob User', team: 'Blob Team' }],
    });
    const db = new Database(dbFile);
    writeMstAssignmentRowsSnapshot(db, [
      {
        mst: '0101234567',
        company: 'Cong ty A',
        person_import: 'Lan',
        person_export: '',
        team: 'Blue Team',
        effective_from: '2026-01-01',
        effective_to: '',
      },
    ]);
    db.close();

    const app = buildV4App({ dbFile });
    const response = await request(app).get('/api/v4/mst-assignments').query({ mst: '0101234567' });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        mst: '0101234567',
        person_import: 'Lan',
        team: 'Blue Team',
      }),
    ]);
  });

  it('lists declarations with normalized identifiers and query filters', async () => {
    const dbFile = registerTempDb({
      decl_rows_v1: [
        {
          so_tk: '12345ABC',
          branch: 'Chi nhanh A',
          mst: '0101234567-1',
          date: '2026/02/14',
          ma_loai_hinh: 'A11',
        },
        {
          so_tk_full: '00000012346-X',
          nhanh: 'Chi nhanh B',
          mst: '0207654321',
          date: '2026-02-15',
          ma_loai_hinh: 'E11',
        },
      ],
    });

    const app = buildV4App({ dbFile });
    const response = await request(app)
      .get('/api/v4/declarations')
      .query({ mst: '0101234567', soTk: '12345', branch: 'nhanh a' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        total: 1,
        items: [
          expect.objectContaining({
            id: '00000012345-chi-nhanh-a',
            key: '00000012345_Chi nhanh A',
            so_tk: '00000012345',
            so_tk_full: '12345ABC',
            so_tk_suffix: '',
            nhanh: 'Chi nhanh A',
            branch: 'Chi nhanh A',
            mst: '01012345671',
            date: '2026-02-14',
            ma_loai_hinh: 'A11',
          }),
        ],
      },
    });
  });

  it('prefers the typed declarations snapshot over the stale blob on /api/v4/declarations', async () => {
    const dbFile = registerTempDb({
      decl_rows_v1: [{ so_tk: 'STALE-TK', nhanh: 'Stale Branch', mst: '0999999999', date: '2026-02-01' }],
    });
    const db = new Database(dbFile);
    writeDeclarationRowsSnapshot(db, [
      { so_tk: '12345ABC', branch: 'Chi nhanh A', mst: '0101234567-1', date: '2026/02/14', ma_loai_hinh: 'A11' },
    ]);
    db.close();

    const app = buildV4App({ dbFile });
    const response = await request(app).get('/api/v4/declarations').query({ mst: '0101234567' });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        so_tk: '00000012345',
        mst: '01012345671',
      }),
    ]);
  });

  it('wraps legacy KPI rules into a normalized collection response', async () => {
    const dbFile = registerTempDb({
      kpi_rules_v2: {
        id: 'legacy-kpi',
        name: 'Legacy KPI',
        description: 'Rule set imported from legacy storage',
        groups: {
          group1: {
            key: 'group1',
            title: 'Nhóm 1',
            description: 'Legacy group',
            codes: ['A11'],
            base: 0.5,
            perItem: 0.2,
            tierMode: 'per_item',
            tiers: [],
          },
        },
        license: {
          defaultPoints: 0.3,
          codePoints: [],
          exclude: {
            codes: [],
            agencies: [],
          },
        },
        bonuses: {
          co: {
            enabled: true,
            label: 'C/O',
            points: 0.1,
            perLine: 0.01,
          },
        },
      },
    });

    const app = buildV4App({ dbFile });
    const response = await request(app).get('/api/v4/kpi-rules');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        version: 2,
        activeId: 'legacy-kpi',
        ruleSetCount: 1,
        sets: [
          expect.objectContaining({
            id: 'legacy-kpi',
            name: 'Legacy KPI',
            groups: expect.objectContaining({
              group1: expect.objectContaining({
                codes: ['A11'],
              }),
            }),
            license: expect.objectContaining({
              defaultPoints: 0.3,
            }),
          }),
        ],
      },
    });
  });

  it('prefers the typed KPI rules snapshot over the stale blob on /api/v4/kpi-rules', async () => {
    const dbFile = registerTempDb({
      kpi_rules_v2: { id: 'blob-kpi', name: 'Blob KPI', groups: {} },
    });
    const db = new Database(dbFile);
    writeRuleCollectionSnapshot(db, {
      version: 2,
      activeId: 'typed-kpi',
      sets: [
        {
          id: 'typed-kpi',
          name: 'Typed KPI',
          groups: {
            group1: {
              key: 'group1',
              title: 'Nhóm 1',
              codes: ['A11'],
            },
          },
        },
      ],
    });
    db.close();

    const app = buildV4App({ dbFile });
    const response = await request(app).get('/api/v4/kpi-rules');

    expect(response.status).toBe(200);
    expect(response.body.data.activeId).toBe('typed-kpi');
    expect(response.body.data.sets).toEqual([
      expect.objectContaining({
        id: 'typed-kpi',
        name: 'Typed KPI',
      }),
    ]);
  });

  it('builds the unified reporting view read model from the legacy inputs', async () => {
    const dbFile = registerTempDb(createReportingSeed());
    const app = buildV4App({ dbFile });

    const response = await request(app).get('/api/v4/reporting/view').query({ from: '2026-02-01', to: '2026-02-28' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        meta: {
          servedAt: expect.any(String),
          aggregateStatus: {
            available: false,
            generatedAt: '',
            queryKey: '',
            total: 0,
            range: {
              from: '',
              to: '',
            },
          },
        },
        summary: {
          range: {
            from: '2026-02-01',
            to: '2026-02-28',
          },
          ruleSet: {
            id: 'legacy-kpi',
            name: 'Legacy KPI',
          },
          summary: expect.objectContaining({
            decls: 2,
            import: 2,
            export: 0,
            items: 3,
            kpi: 1.6,
            companyCount: 0,
            licenseSummary: '—',
          }),
          trend: {
            series: [
              {
                period: '02/2026',
                kpi: 1.6,
                decls: 2,
                items: 3,
                licenses: 0,
              },
            ],
            teamSeries: [
              {
                period: '02/2026',
                'Blue Team': 1.6,
                Tổng: 1.6,
              },
            ],
            comparison: expect.objectContaining({
              delta: expect.objectContaining({
                kpi: 1.6,
                decls: 2,
              }),
            }),
            topTeams: ['Blue Team'],
          },
          adjustments: expect.objectContaining({
            list: [],
            applied: [],
            totalPoints: 0,
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            appliedCount: 0,
            totalsByCategory: expect.any(Object),
          }),
          companies: {
            staff: [
              expect.objectContaining({
                staff: 'Lan',
                decls: 2,
                items: 3,
                kpi: 1.6,
              }),
            ],
            teams: [
              expect.objectContaining({
                team: 'Blue Team',
                staff: 'Lan',
                decls: 2,
                items: 3,
                kpi: 1.6,
              }),
            ],
          },
        },
        staff: {
          range: {
            from: '2026-02-01',
            to: '2026-02-28',
          },
          ruleSet: {
            id: 'legacy-kpi',
            name: 'Legacy KPI',
          },
          total: 1,
          keysHash: 'lan',
          items: [
            expect.objectContaining({
              key: 'lan',
              name: 'Lan',
              teamLabel: 'Blue Team',
              teamNames: ['Blue Team'],
              companies: [
                expect.objectContaining({
                  decls: 2,
                  items: 3,
                  kpi: 1.6,
                }),
              ],
              stats: expect.objectContaining({
                decls: 2,
                items: 3,
                kpi: 1.6,
              }),
            }),
          ],
        },
        teams: {
          range: {
            from: '2026-02-01',
            to: '2026-02-28',
          },
          ruleSet: {
            id: 'legacy-kpi',
            name: 'Legacy KPI',
          },
          total: 1,
          keysHash: 'blue team',
          items: [
            expect.objectContaining({
              key: 'blue team',
              name: 'Blue Team',
              memberNames: ['Lan'],
              companies: [
                expect.objectContaining({
                  staff: 'Lan',
                  decls: 2,
                  items: 3,
                  kpi: 1.6,
                }),
              ],
              stats: expect.objectContaining({
                decls: 2,
                items: 3,
                kpi: 1.6,
              }),
              members: [
                expect.objectContaining({
                  key: 'lan',
                  name: 'Lan',
                  stats: expect.objectContaining({
                    decls: 2,
                    kpi: 1.6,
                  }),
                }),
              ],
            }),
          ],
        },
      },
    });
  });

  it('supports ruleId overrides for reporting reads and returns normalized adjustment metadata', async () => {
    const seed = createReportingSeed();
    seed.kpi_rules_v2 = {
      version: 2,
      activeId: 'legacy-kpi',
      sets: [
        seed.kpi_rules_v2,
        {
          ...seed.kpi_rules_v2,
          id: 'boosted-kpi',
          name: 'Boosted KPI',
          groups: {
            ...seed.kpi_rules_v2.groups,
            group1: {
              ...seed.kpi_rules_v2.groups.group1,
              base: 1,
              perItem: 0.5,
            },
          },
        },
      ],
    };
    seed.kpi_adjustments_v1 = [
      {
        id: 'adj-reporting-1',
        category: 'support_fixed',
        month: '2026-02',
        staffName: 'Lan',
        teamName: 'Blue Team',
        quantity: 1,
        unitPoints: 2,
        totalPoints: 2,
        status: 'approved',
      },
    ];

    const dbFile = registerTempDb(seed);
    const app = buildV4App({ dbFile });

    const response = await request(app).get('/api/v4/reporting/view').query({ from: '2026-02-01', to: '2026-02-28', ruleId: 'boosted-kpi' });

    expect(response.status).toBe(200);
    expect(response.body.data.summary.ruleSet).toEqual({
      id: 'boosted-kpi',
      name: 'Boosted KPI',
    });
    expect(response.body.data.summary.summary).toEqual(
      expect.objectContaining({
        decls: 2,
        items: 3,
        kpi: 5.5,
      })
    );
    expect(response.body.data.summary.adjustments).toEqual(
      expect.objectContaining({
        totalPoints: 2,
        approvedCount: 1,
        appliedCount: 1,
        pendingCount: 0,
        rejectedCount: 0,
      })
    );
    expect(response.body.data.summary.adjustments.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'adj-reporting-1',
          category: 'support_fixed',
          status: 'approved',
        }),
      ])
    );
    expect(response.body.data.summary.adjustments.applied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          so_tk: expect.stringContaining('Điểm bổ sung'),
          nhan_vien: 'Lan',
          team: 'Blue Team',
          kpi: 2,
        }),
      ])
    );
    expect(response.body.data.summary.adjustments.totalsByCategory).toEqual(
      expect.objectContaining({
        support: expect.objectContaining({
          points: 2,
          quantity: 1,
        }),
      })
    );
    expect(response.body.data.summary.adjustments.byStaff).toBeUndefined();
    expect(response.body.data.summary.adjustments.byTeam).toBeUndefined();

    expect(response.body.data.staff.ruleSet).toEqual({
      id: 'boosted-kpi',
      name: 'Boosted KPI',
    });
    expect(response.body.data.staff.items).toEqual([
      expect.objectContaining({
        key: 'lan',
        stats: expect.objectContaining({
          kpi: 5.5,
        }),
      }),
    ]);

    expect(response.body.data.teams.ruleSet).toEqual({
      id: 'boosted-kpi',
      name: 'Boosted KPI',
    });
    expect(response.body.data.teams.items).toEqual([
      expect.objectContaining({
        key: 'blue team',
        stats: expect.objectContaining({
          kpi: 5.5,
        }),
      }),
    ]);
  });

  it('prefers typed declaration, rule, and adjustment snapshots inside the reporting view model', async () => {
    const seed = createReportingSeed();
    seed.decl_rows_v1 = [
      { so_tk: 'STALE-TK', date: '2026-02-14', loai_hinh: 'A11', nhan_vien: 'Blob', team: 'Blob Team', num_items: 1 },
    ];
    seed.kpi_rules_v2 = { id: 'blob-kpi', name: 'Blob KPI', groups: {} };
    seed.kpi_adjustments_v1 = [{ id: 'adj-blob', totalPoints: 0, status: 'rejected' }];

    const dbFile = registerTempDb(seed);
    const db = new Database(dbFile);
    writeDeclarationRowsSnapshot(db, [
      {
        date: '2026-02-14',
        so_tk: 'TK1',
        loai_hinh: 'A11',
        nhan_vien: 'Lan',
        team: 'Blue Team',
        num_items: 2,
      },
    ]);
    writeRuleCollectionSnapshot(db, {
      version: 2,
      activeId: 'typed-kpi',
      sets: [
        {
          id: 'typed-kpi',
          name: 'Typed KPI',
          groups: {
            group1: {
              key: 'group1',
              title: 'Nhóm 1',
              description: 'Typed group',
              codes: ['A11'],
              base: 1,
              perItem: 0.5,
              tierMode: 'per_item',
              tiers: [],
            },
          },
          license: {
            defaultPoints: 0,
            codePoints: [],
            exclude: {
              codes: [],
              agencies: [],
            },
          },
          bonuses: {
            co: {
              enabled: false,
              label: 'C/O',
              points: 0,
              perLine: 0,
            },
          },
        },
      ],
    });
    writeAdjustmentRowsSnapshot(db, [
      {
        id: 'adj-typed',
        category: 'support_fixed',
        month: '2026-02',
        staffName: 'Lan',
        teamName: 'Blue Team',
        quantity: 1,
        unitPoints: 2,
        totalPoints: 2,
        status: 'approved',
      },
    ]);
    db.close();

    const app = buildV4App({ dbFile });
    const response = await request(app).get('/api/v4/reporting/view').query({ from: '2026-02-01', to: '2026-02-28' });

    expect(response.status).toBe(200);
    expect(response.body.data.summary.ruleSet).toEqual({
      id: 'typed-kpi',
      name: 'Typed KPI',
    });
    expect(response.body.data.summary.summary).toEqual(
      expect.objectContaining({
        decls: 1,
        items: 2,
        kpi: 4,
      })
    );
    expect(response.body.data.summary.adjustments).toEqual(
      expect.objectContaining({
        totalPoints: 2,
        appliedCount: 1,
      })
    );
  });

  it('returns the combined reporting view bundle from a single reporting endpoint', async () => {
    const dbFile = registerTempDb(createReportingAggregateSeed());
    const app = buildV4App({ dbFile });

    const response = await request(app)
      .get('/api/v4/reporting/view')
      .query({ from: '2026-01-01', to: '2026-02-28' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        meta: expect.objectContaining({
          servedAt: expect.any(String),
          aggregateStatus: expect.objectContaining({
            available: false,
          }),
        }),
        summary: expect.objectContaining({
          range: {
            from: '2026-01-01',
            to: '2026-02-28',
          },
          ruleSet: {
            id: 'legacy-kpi',
            name: 'Legacy KPI',
          },
        }),
        staff: expect.objectContaining({
          total: 1,
          items: [expect.objectContaining({ key: 'lan' })],
        }),
        teams: expect.objectContaining({
          total: 1,
          items: [expect.objectContaining({ key: 'blue team' })],
        }),
      },
    });
  });

  it('surfaces stored monthly aggregate freshness on the reporting view response', async () => {
    const seed = createReportingAggregateSeed();
    seed.kpi_reporting_monthly_aggregates_v1 = createStoredMonthlyAggregateSnapshot();

    const dbFile = registerTempDb(seed);
    const app = buildV4App({ dbFile });

    const response = await request(app)
      .get('/api/v4/reporting/view')
      .query({ from: '2026-01-01', to: '2026-02-28' });

    expect(response.status).toBe(200);
    expect(response.body.data.meta).toEqual({
      servedAt: expect.any(String),
      aggregateStatus: {
        available: true,
        generatedAt: '2026-03-09T09:00:00.000Z',
        queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),
        total: 2,
        range: {
          from: '2026-01-01',
          to: '2026-02-28',
        },
      },
    });
  });

  it('retires legacy reporting slice endpoints in favor of /view', async () => {
    const dbFile = registerTempDb(createReportingAggregateSeed());
    const app = buildV4App({ dbFile });
    const query = { from: '2026-01-01', to: '2026-02-28', ruleId: 'legacy-kpi' };

    const [summaryResponse, staffResponse, teamsResponse] = await Promise.all([
      request(app).get('/api/v4/reporting/summary').query(query),
      request(app).get('/api/v4/reporting/staff').query(query),
      request(app).get('/api/v4/reporting/teams').query(query),
    ]);

    expect(summaryResponse.status).toBe(404);
    expect(staffResponse.status).toBe(404);
    expect(teamsResponse.status).toBe(404);
  });

  it('lists normalized report schedules with deterministic next-run calculation', async () => {
    const dbFile = registerTempDb(createReportingSeed());
    const app = buildV4App({ dbFile });
    const asOf = '2026-03-09T07:00:00.000Z';

    const response = await request(app).get('/api/v4/reporting/schedules').query({ asOf });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.total).toBe(2);
    expect(response.body.data.aggregateStatus).toEqual({
      available: true,
      generatedAt: expect.any(String),
      queryKey: createMonthlyAggregateQueryKey({ from: '2026-02-01', to: '2026-02-28' }),
      total: 1,
      range: {
        from: '2026-02-01',
        to: '2026-02-28',
      },
    });
    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        id: 'weekly-blue',
        name: 'Weekly Blue',
        frequency: 'weekly',
        time: '08:30',
        dayOfWeek: 1,
        dayOfMonth: null,
        formats: ['pdf', 'excel'],
        recipients: ['ops@example.com', 'lead@example.com'],
        active: true,
        lastRun: '2026-03-02T01:30:00.000Z',
      }),
      expect.objectContaining({
        id: 'monthly-finance',
        name: 'Monthly Finance',
        frequency: 'monthly',
        time: '09:15',
        dayOfWeek: null,
        dayOfMonth: 20,
        formats: ['pdf'],
        recipients: ['finance@example.com'],
        active: false,
        lastRun: '2026-02-20T02:15:00.000Z',
        nextRun: '',
      }),
    ]);

    expect(response.body.data.items[0].nextRun).not.toBe('');
    expect(new Date(response.body.data.items[0].nextRun).getTime()).toBeGreaterThan(new Date(asOf).getTime());
  });

  it('saves and deletes report schedules through the server-v4 reporting boundary', async () => {
    const dbFile = registerTempDb(createReportingSeed());
    const app = buildV4App({ dbFile });

    const saveResponse = await request(app).post('/api/v4/reporting/schedules').send({
      name: 'Monthly Red',
      frequency: 'monthly',
      dayOfMonth: 20,
      time: '09:45',
      formats: ['pdf', 'excel', 'pdf'],
      recipients: ['ops@example.com', 'lead@example.com', 'ops@example.com'],
      active: true,
    });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.ok).toBe(true);
    expect(saveResponse.body.data.item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: 'Monthly Red',
        frequency: 'monthly',
        dayOfMonth: 20,
        dayOfWeek: null,
        time: '09:45',
        formats: ['pdf', 'excel'],
        recipients: ['ops@example.com', 'lead@example.com'],
        active: true,
      })
    );

    const createdId = saveResponse.body.data.item.id;
    const db = new Database(dbFile);

    try {
      const storedProjection = db
        .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
        .get('kpi_report_schedule_v1');

      const listAfterSave = await request(app).get('/api/v4/reporting/schedules').query({ asOf: '2026-03-09T07:00:00.000Z' });
      expect(listAfterSave.status).toBe(200);
      expect(listAfterSave.body.data.total).toBe(3);
      expect(listAfterSave.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: createdId,
            name: 'Monthly Red',
            formats: ['pdf', 'excel'],
            recipients: ['ops@example.com', 'lead@example.com'],
          }),
        ])
      );
      expect(storedProjection).toBeTruthy();
      expect(JSON.parse(storedProjection.payload)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: createdId,
            name: 'Monthly Red',
          }),
        ])
      );
      expect(
        db
          .prepare(
            'SELECT position, schedule_id, name FROM reporting_schedule_projection_entries WHERE projection_key = ? ORDER BY position ASC, schedule_id ASC'
          )
          .all('kpi_report_schedule_v1')
      ).toEqual([
        { position: 0, schedule_id: 'weekly-blue', name: 'Weekly Blue' },
        { position: 1, schedule_id: 'monthly-finance', name: 'Monthly Finance' },
        { position: 2, schedule_id: createdId, name: 'Monthly Red' },
      ]);

      const deleteResponse = await request(app).delete(`/api/v4/reporting/schedules/${createdId}`);
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toEqual({
        ok: true,
        data: {
          deleted: true,
          total: 2,
        },
      });

      const listAfterDelete = await request(app).get('/api/v4/reporting/schedules').query({ asOf: '2026-03-09T07:00:00.000Z' });
      expect(listAfterDelete.status).toBe(200);
      expect(listAfterDelete.body.data.total).toBe(2);
      expect(listAfterDelete.body.data.items.find((item) => item.id === createdId)).toBeUndefined();
      const storedAfterDelete = db
        .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
        .get('kpi_report_schedule_v1');
      expect(JSON.parse(storedAfterDelete.payload)).toHaveLength(2);
      expect(
        db
          .prepare(
            'SELECT position, schedule_id, name FROM reporting_schedule_projection_entries WHERE projection_key = ? ORDER BY position ASC, schedule_id ASC'
          )
          .all('kpi_report_schedule_v1')
      ).toEqual([
        { position: 0, schedule_id: 'weekly-blue', name: 'Weekly Blue' },
        { position: 1, schedule_id: 'monthly-finance', name: 'Monthly Finance' },
      ]);
    } finally {
      db.close();
    }
  });

  it('surfaces stored monthly aggregate status on the schedules route', async () => {
    const seededDefaultSnapshot = createStoredMonthlyAggregateSnapshot();
    const dbFile = registerTempDb({
      ...createReportingSeed(),
      kpi_reporting_monthly_aggregates_default_v1: {
        ...seededDefaultSnapshot,
        range: {
          from: '2026-02-01',
          to: '2026-02-28',
        },
        total: 1,
        items: [seededDefaultSnapshot.items[0]],
        cache: {
          queryKey: createMonthlyAggregateQueryKey({ from: '2026-02-01', to: '2026-02-28' }),
          reused: false,
        },
      },
    });
    const app = buildV4App({ dbFile });

    const response = await request(app).get('/api/v4/reporting/schedules').query({ asOf: '2026-03-09T07:00:00.000Z' });

    expect(response.status).toBe(200);
    expect(response.body.data.aggregateStatus).toEqual({
      available: true,
      generatedAt: '2026-03-09T09:00:00.000Z',
      queryKey: createMonthlyAggregateQueryKey({ from: '2026-02-01', to: '2026-02-28' }),
      total: 1,
      range: {
        from: '2026-02-01',
        to: '2026-02-28',
      },
    });
  });

  it('builds monthly reporting aggregates for the selected range', async () => {
    const dbFile = registerTempDb(createReportingAggregateSeed());
    const app = buildV4App({ dbFile });

    const response = await request(app)
      .get('/api/v4/reporting/aggregates/monthly')
      .query({ from: '2026-01-01', to: '2026-02-28' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        range: {
          from: '2026-01-01',
          to: '2026-02-28',
        },
        ruleSet: {
          id: 'legacy-kpi',
          name: 'Legacy KPI',
        },
        generatedAt: expect.any(String),
        cache: {
          queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),
          reused: false,
        },
        total: 2,
        items: [
          {
            period: '2026-02',
            label: '02/2026',
            range: {
              from: '2026-02-01',
              to: '2026-02-28',
            },
            summary: expect.objectContaining({
              decls: 2,
              items: 3,
              kpi: 1.6,
              licenseSummary: '—',
            }),
            topTeams: [
              expect.objectContaining({
                key: 'blue team',
                name: 'Blue Team',
                stats: expect.objectContaining({
                  decls: 2,
                  kpi: 1.6,
                }),
              }),
            ],
            topStaff: [
              expect.objectContaining({
                key: 'lan',
                name: 'Lan',
                teamLabel: 'Blue Team',
                stats: expect.objectContaining({
                  decls: 2,
                  kpi: 1.6,
                }),
              }),
            ],
          },
          {
            period: '2026-01',
            label: '01/2026',
            range: {
              from: '2026-01-01',
              to: '2026-01-31',
            },
            summary: expect.objectContaining({
              decls: 1,
              items: 1,
              kpi: 0.7,
              licenseSummary: '—',
            }),
            topTeams: [
              expect.objectContaining({
                key: 'blue team',
                name: 'Blue Team',
              }),
            ],
            topStaff: [
              expect.objectContaining({
                key: 'lan',
                name: 'Lan',
              }),
            ],
          },
        ],
      },
    });
  });

  it('persists active monthly aggregate freshness for subsequent view reads', async () => {
    const dbFile = registerTempDb(createReportingAggregateSeed());
    const app = buildV4App({ dbFile });
    const query = { from: '2026-01-01', to: '2026-02-28' };

    const aggregateResponse = await request(app)
      .get('/api/v4/reporting/aggregates/monthly')
      .query(query);
    const viewResponse = await request(app).get('/api/v4/reporting/view').query(query);
    const observabilityResponse = await request(app).get('/api/v4/reporting/observability');

    expect(aggregateResponse.status).toBe(200);
    expect(viewResponse.status).toBe(200);
    expect(viewResponse.body.data.meta.aggregateStatus).toEqual({
      available: true,
      generatedAt: aggregateResponse.body.data.generatedAt,
      queryKey: createMonthlyAggregateQueryKey(query),
      total: aggregateResponse.body.data.total,
      range: {
        from: '2026-01-01',
        to: '2026-02-28',
      },
    });

    expect(observabilityResponse.status).toBe(200);
    expect(observabilityResponse.body.data.aggregates.active).toEqual({
      available: true,
      generatedAt: aggregateResponse.body.data.generatedAt,
      queryKey: createMonthlyAggregateQueryKey(query),
      total: aggregateResponse.body.data.total,
      range: {
        from: '2026-01-01',
        to: '2026-02-28',
      },
    });
    expect(observabilityResponse.body.data.jobs).toEqual(
      expect.objectContaining({
        total: 1,
        successCount: 1,
        failureCount: 0,
        lastSuccessAt: aggregateResponse.body.data.generatedAt,
        lastFailureAt: null,
        items: [
          expect.objectContaining({
            job: 'reporting-monthly-aggregate-materialize',
            status: 'success',
            source: 'reporting-monthly-aggregates',
            snapshotKey: 'kpi_reporting_monthly_aggregates_v1',
            queryKey: createMonthlyAggregateQueryKey(query),
            total: aggregateResponse.body.data.total,
          }),
        ],
      })
    );
  });

  it('supports reporting observability search and pagination for jobs and periods', async () => {
    const dbFile = registerTempDb(createReportingAggregateSeed());
    const app = buildV4App({ dbFile });
    const janQuery = { from: '2026-01-01', to: '2026-01-31' };
    const fullQuery = { from: '2026-01-01', to: '2026-02-28' };

    const janResponse = await request(app).get('/api/v4/reporting/aggregates/monthly').query(janQuery);
    const fullResponse = await request(app).get('/api/v4/reporting/aggregates/monthly').query(fullQuery);
    const observabilityResponse = await request(app).get('/api/v4/reporting/observability').query({
      jobSearch: 'aggregate',
      jobStatus: 'success',
      jobPageSize: 1,
      periodSearch: '02/2026',
      periodPageSize: 1,
    });

    expect(janResponse.status).toBe(200);
    expect(fullResponse.status).toBe(200);
    expect(observabilityResponse.status).toBe(200);
    expect(observabilityResponse.body.data.jobs).toEqual(
      expect.objectContaining({
        total: 2,
        filteredTotal: 2,
        successCount: 2,
        failureCount: 0,
        lastSuccessAt: fullResponse.body.data.generatedAt,
        lastFailureAt: null,
        search: 'aggregate',
        status: 'success',
        page: 1,
        pageSize: 1,
        pageCount: 2,
        items: [
          expect.objectContaining({
            job: 'reporting-monthly-aggregate-materialize',
            status: 'success',
            queryKey: createMonthlyAggregateQueryKey(fullQuery),
            total: fullResponse.body.data.total,
          }),
        ],
      })
    );
    expect(observabilityResponse.body.data.monthlyStats.active).toEqual(
      expect.objectContaining({
        total: 2,
        filteredTotal: 1,
        totalDecls: 2,
        totalItems: 3,
        totalCompanies: 0,
        averageKpi: 1.6,
        search: '02/2026',
        page: 1,
        pageSize: 1,
        pageCount: 1,
        peakPeriod: expect.objectContaining({
          period: '2026-02',
          kpi: 1.6,
        }),
        items: [
          expect.objectContaining({
            period: '2026-02',
            label: '02/2026',
            decls: 2,
            itemCount: 3,
            companyCount: 0,
            kpi: 1.6,
          }),
        ],
      })
    );
  });

  it('uses the default monthly aggregate preset when the query is omitted', async () => {
    const dbFile = registerTempDb(createReportingAggregateSeed());
    const app = buildV4App({ dbFile });

    const first = await request(app).get('/api/v4/reporting/aggregates/monthly');
    const second = await request(app).get('/api/v4/reporting/aggregates/monthly');

    expect(first.status).toBe(200);
    expect(first.body.data.range).toEqual({
      from: '2026-01-01',
      to: '2026-02-28',
    });
    expect(first.body.data.cache.queryKey).toBe(
      createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' })
    );

    expect(second.status).toBe(200);
    expect(second.body.data.generatedAt).toBe(first.body.data.generatedAt);
    expect(second.body.data.cache).toEqual({
      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),
      reused: true,
    });
  });

  it('reuses a stored monthly aggregate snapshot when the query matches', async () => {
    const dbFile = registerTempDb({
      ...createReportingAggregateSeed(),
      kpi_reporting_monthly_aggregates_v1: createStoredMonthlyAggregateSnapshot(),
    });
    const app = buildV4App({ dbFile });

    const response = await request(app)
      .get('/api/v4/reporting/aggregates/monthly')
      .query({ from: '2026-01-01', to: '2026-02-28' });

    expect(response.status).toBe(200);
    expect(response.body.data.generatedAt).toBe('2026-03-09T09:00:00.000Z');
    expect(response.body.data.cache).toEqual({
      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),
      reused: true,
    });
    expect(response.body.data.total).toBe(2);
  });
});
