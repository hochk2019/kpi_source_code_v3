import { describe, expect, it } from 'vitest';

import { computeChecksum } from '../../server-v4/src/migration/migrationEngine.js';
import { allMigrations } from '../../server-v4/src/migration/files/index.js';

describe('Migration Files Registry', () => {
  it('exports a non-empty array of migrations', () => {
    expect(allMigrations.length).toBeGreaterThan(0);
  });

  it('all migrations have unique version numbers', () => {
    const versions = allMigrations.map((m) => m.version);
    const unique = new Set(versions);
    expect(unique.size).toBe(versions.length);
  });

  it('all migrations are sorted by version ascending', () => {
    for (let i = 1; i < allMigrations.length; i++) {
      expect(allMigrations[i]!.version).toBeGreaterThan(allMigrations[i - 1]!.version);
    }
  });

  it('all migrations have non-empty up and down SQL', () => {
    for (const m of allMigrations) {
      expect(m.up.trim().length).toBeGreaterThan(0);
      expect(m.down.trim().length).toBeGreaterThan(0);
    }
  });

  it('all migrations have correct checksums', () => {
    for (const m of allMigrations) {
      const expected = computeChecksum(m.up);
      expect(m.checksum).toBe(expected);
    }
  });

  it('all migrations have a non-empty name', () => {
    for (const m of allMigrations) {
      expect(m.name.length).toBeGreaterThan(0);
    }
  });
});

describe('Migration SQL Content', () => {
  it('migration 001 creates the update_updated_at function', () => {
    const m = allMigrations.find((m) => m.version === 1)!;
    expect(m.up).toContain('CREATE OR REPLACE FUNCTION update_updated_at()');
    expect(m.up).toContain('RETURNS TRIGGER');
    expect(m.up).toContain('NEW.updated_at = NOW()');
  });

  it('teams migration has FK from team_members to teams', () => {
    const m = allMigrations.find((m) => m.name === 'teams_schema')!;
    expect(m.up).toContain('REFERENCES teams(id) ON DELETE CASCADE');
  });

  it('declarations migration has created_at and updated_at columns', () => {
    const m = allMigrations.find((m) => m.name === 'declarations_schema')!;
    expect(m.up).toContain('created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    expect(m.up).toContain('updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    expect(m.up).toContain('trg_declarations_updated_at');
  });

  it('import_jobs migration adds FK from declarations.import_job_id to import_jobs', () => {
    const m = allMigrations.find((m) => m.name === 'import_jobs_schema')!;
    expect(m.up).toContain('fk_declarations_import_job_id');
    expect(m.up).toContain('REFERENCES import_jobs(id)');
  });

  it('kpi_adjustments migration has FK to team_members and teams', () => {
    const m = allMigrations.find((m) => m.name === 'kpi_adjustments_schema')!;
    expect(m.up).toContain('REFERENCES team_members(id) ON DELETE SET NULL');
    expect(m.up).toContain('REFERENCES teams(id) ON DELETE SET NULL');
  });

  it('mst_assignments migration has FK to team_members and teams', () => {
    const m = allMigrations.find((m) => m.name === 'mst_assignments_schema')!;
    expect(m.up).toContain('import_member_id TEXT NULL REFERENCES team_members(id)');
    expect(m.up).toContain('export_member_id TEXT NULL REFERENCES team_members(id)');
    expect(m.up).toContain('REFERENCES teams(id) ON DELETE SET NULL');
  });

  it('declaration_events migration has FK to declarations', () => {
    const m = allMigrations.find((m) => m.name === 'declaration_events_schema')!;
    expect(m.up).toContain('REFERENCES declarations(id) ON DELETE CASCADE');
  });

  it('all entity tables have updated_at triggers', () => {
    const triggerMigrations = allMigrations.filter(
      (m) => m.version >= 2 && m.name !== 'declaration_events_schema',
    );
    for (const m of triggerMigrations) {
      expect(m.up).toContain('EXECUTE FUNCTION update_updated_at()');
    }
  });

  it('all entity tables have indexes on WHERE/JOIN columns', () => {
    // teams: snapshot_key, sort_order
    const teams = allMigrations.find((m) => m.name === 'teams_schema')!;
    expect(teams.up).toContain('idx_teams_snapshot_key_sort_order');
    expect(teams.up).toContain('idx_team_members_team_id_sort_order');

    // declarations: declaration_no, branch_code, declared_at, tax_code, deleted_at
    const decl = allMigrations.find((m) => m.name === 'declarations_schema')!;
    expect(decl.up).toContain('idx_declarations_declaration_no_branch_code');
    expect(decl.up).toContain('idx_declarations_declared_at');
    expect(decl.up).toContain('idx_declarations_tax_code');
    expect(decl.up).toContain('idx_declarations_deleted_at');

    // kpi_adjustments: month_start, status
    const adj = allMigrations.find((m) => m.name === 'kpi_adjustments_schema')!;
    expect(adj.up).toContain('idx_kpi_adjustments_month_status');

    // mst_assignments: tax_code, status, valid_during
    const mst = allMigrations.find((m) => m.name === 'mst_assignments_schema')!;
    expect(mst.up).toContain('idx_mst_assignments_tax_code');
    expect(mst.up).toContain('idx_mst_assignments_status');
    expect(mst.up).toContain('idx_mst_assignments_valid_during');
  });
});
