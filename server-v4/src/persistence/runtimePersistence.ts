import { Pool } from 'pg';

import type { ServerV4Config, ServerV4PersistenceMode } from '../config/server-v4-config.js';
import type { BusinessSnapshotSourceKind } from './businessSnapshotReader.js';
import {
  createAdjustmentAsyncReader,
  type AdjustmentAsyncReader,
} from '../modules/kpi-adjustments/adjustmentAsyncReader.js';
import type { KpiAdjustmentsStore } from '../modules/kpi-adjustments/kpiAdjustmentsStore.js';
import type { AuthStore } from '../modules/auth/authStore.js';
import { PostgresAuthStore } from '../modules/auth/postgresAuthStore.js';
import { SqliteAuthStore } from '../modules/auth/sqliteAuthStore.js';
import { PostgresAdjustmentAsyncReader } from '../modules/kpi-adjustments/postgresAdjustmentAsyncReader.js';
import { PostgresKpiAdjustmentsStore } from '../modules/kpi-adjustments/postgresKpiAdjustmentsStore.js';
import { SqliteKpiAdjustmentsStore } from '../modules/kpi-adjustments/sqliteKpiAdjustmentsStore.js';
import {
  createDeclarationAsyncReader,
  type DeclarationAsyncReader,
} from '../modules/declarations/declarationAsyncReader.js';
import type { DeclarationsStore } from '../modules/declarations/declarationsStore.js';
import { PostgresDeclarationAsyncReader } from '../modules/declarations/postgresDeclarationAsyncReader.js';
import { PostgresDeclarationsStore } from '../modules/declarations/postgresDeclarationsStore.js';
import { SqliteDeclarationsStore } from '../modules/declarations/sqliteDeclarationsStore.js';
import type { HqAgenciesAsyncReader } from '../modules/hq-agencies/hqAgenciesAsyncReader.js';
import { NoopHqAgenciesAsyncReader } from '../modules/hq-agencies/noopHqAgenciesAsyncReader.js';
import { PostgresHqAgenciesAsyncReader } from '../modules/hq-agencies/postgresHqAgenciesAsyncReader.js';
import type { HqAgenciesStore } from '../modules/hq-agencies/hqAgenciesStore.js';
import { PostgresHqAgenciesStore } from '../modules/hq-agencies/postgresHqAgenciesStore.js';
import { SqliteHqAgenciesAsyncReader } from '../modules/hq-agencies/sqliteHqAgenciesAsyncReader.js';
import { SqliteHqAgenciesStore } from '../modules/hq-agencies/sqliteHqAgenciesStore.js';
import {
  createKpiRulesAsyncReader,
  type KpiRulesAsyncReader,
} from '../modules/kpi-rules/kpiRulesAsyncReader.js';
import type { KpiRulesStore } from '../modules/kpi-rules/kpiRulesStore.js';
import { PostgresKpiRulesStore } from '../modules/kpi-rules/postgresKpiRulesStore.js';
import { PostgresKpiRulesAsyncReader } from '../modules/kpi-rules/postgresKpiRulesAsyncReader.js';
import { SqliteKpiRulesStore } from '../modules/kpi-rules/sqliteKpiRulesStore.js';
import {
  createMstAssignmentAsyncReader,
  type MstAssignmentAsyncReader,
} from '../modules/mst-assignments/mstAssignmentAsyncReader.js';
import { PostgresMstAssignmentAsyncReader } from '../modules/mst-assignments/postgresMstAssignmentAsyncReader.js';
import {
  createTeamRosterAsyncReader,
  type TeamRosterAsyncReader,
} from '../modules/teams/teamRosterAsyncReader.js';
import { PostgresTeamRosterAsyncReader } from '../modules/teams/postgresTeamRosterAsyncReader.js';
import { PostgresTeamsStore } from '../modules/teams/postgresTeamsStore.js';
import { SqliteTeamsStore } from '../modules/teams/sqliteTeamsStore.js';
import type { TeamsStore } from '../modules/teams/teamsStore.js';
import { createPostgresReportingProjectionPersistence } from './reportingProjectionPostgres.js';
import {
  createSqliteReportingProjectionPersistence,
  type ReportingProjectionPersistence,
} from './reportingProjectionPersistence.js';
import { NoopBusinessSnapshotReader } from './noopBusinessSnapshotReader.js';
import { SqliteBusinessSnapshotReader } from './sqliteBusinessSnapshotReader.js';

export interface RuntimePersistence {
  mode: ServerV4PersistenceMode;
  sourceKind: BusinessSnapshotSourceKind;
  adjustmentsReader: AdjustmentAsyncReader;
  adjustmentsStore: KpiAdjustmentsStore;
  authStore: AuthStore;
  declarationsReader: DeclarationAsyncReader;
  declarationsStore: DeclarationsStore;
  hqAgenciesReader: HqAgenciesAsyncReader;
  hqAgenciesStore: HqAgenciesStore;
  kpiRulesReader: KpiRulesAsyncReader;
  kpiRulesStore: KpiRulesStore;
  mstAssignmentsReader: MstAssignmentAsyncReader;
  teamsReader: TeamRosterAsyncReader;
  teamsStore: TeamsStore;
  projections: ReportingProjectionPersistence;
  dispose(): Promise<void>;
}

export function createRuntimePersistence(
  config: Pick<
    ServerV4Config,
    'dbFile' | 'persistenceMode' | 'postgresUrl' | 'postgresLegacySqliteFallback'
  >
): RuntimePersistence {
  if (config.persistenceMode === 'postgres') {
    if (!config.postgresUrl) {
      throw new Error('KPI_API_POSTGRES_URL is required when KPI_API_PERSISTENCE_MODE=postgres.');
    }
    const legacyDbFile = config.postgresLegacySqliteFallback
      ? requireDbFile(
          config.dbFile,
          'KPI_API_DB_FILE is required when KPI_API_POSTGRES_LEGACY_SQLITE_FALLBACK is enabled.',
        )
      : null;

    const reader = new NoopBusinessSnapshotReader({
      sourceKind: 'relational-store',
    });
    const pool = new Pool({ connectionString: config.postgresUrl });
    const authStore = new PostgresAuthStore(pool);
    const adjustmentsStore = new PostgresKpiAdjustmentsStore(pool);
    const declarationsStore = new PostgresDeclarationsStore(pool);
    const hqAgenciesStore = new PostgresHqAgenciesStore(pool);
    const kpiRulesStore = new PostgresKpiRulesStore(pool);
    const teamsStore = new PostgresTeamsStore(pool);
    const adjustmentsReader = createAdjustmentAsyncReader(reader);
    const declarationsReader = createDeclarationAsyncReader(reader);
    const kpiRulesReader = createKpiRulesAsyncReader(reader);
    const mstAssignmentsReader = createMstAssignmentAsyncReader(reader);
    const teamsReader = createTeamRosterAsyncReader(reader);
    const projections = createPostgresReportingProjectionPersistence(config.postgresUrl, {
      pool,
      managePool: false,
    });
    const postgresHqFallbackReader = legacyDbFile
      ? new SqliteHqAgenciesAsyncReader(legacyDbFile, {
          sourceKind: 'dual-write',
        })
      : new NoopHqAgenciesAsyncReader({
          sourceKind: 'relational-store',
        });
    const postgresAdjustmentsReader = new PostgresAdjustmentAsyncReader(adjustmentsReader, pool, {
      sourceKind: 'relational-store',
    });
    const postgresDeclarationsReader = new PostgresDeclarationAsyncReader(declarationsReader, pool, {
      sourceKind: 'relational-store',
    });
    const postgresHqAgenciesReader = new PostgresHqAgenciesAsyncReader(
      postgresHqFallbackReader,
      pool,
      {
        legacyDbFile,
        sourceKind: 'relational-store',
      },
    );
    const postgresKpiRulesReader = new PostgresKpiRulesAsyncReader(kpiRulesReader, pool, {
      sourceKind: 'relational-store',
    });
    const postgresMstAssignmentsReader = new PostgresMstAssignmentAsyncReader(
      mstAssignmentsReader,
      pool,
      { sourceKind: 'relational-store' },
    );
    const postgresTeamsReader = new PostgresTeamRosterAsyncReader(teamsReader, pool, {
      sourceKind: 'relational-store',
    });

    return {
      mode: config.persistenceMode,
      sourceKind: postgresKpiRulesReader.getSourceKind(),
      adjustmentsReader: postgresAdjustmentsReader,
      adjustmentsStore,
      authStore,
      declarationsReader: postgresDeclarationsReader,
      declarationsStore,
      hqAgenciesReader: postgresHqAgenciesReader,
      hqAgenciesStore,
      kpiRulesReader: postgresKpiRulesReader,
      kpiRulesStore,
      mstAssignmentsReader: postgresMstAssignmentsReader,
      teamsReader: postgresTeamsReader,
      teamsStore,
      projections,
      dispose: () => pool.end(),
    };
  }
  const dbFile = requireDbFile(
    config.dbFile,
    'KPI_API_DB_FILE is required when KPI_API_PERSISTENCE_MODE=sqlite-dual-write.',
  );

  const reader = new SqliteBusinessSnapshotReader(dbFile, {
    sourceKind: 'dual-write',
  });
  const authStore = new SqliteAuthStore(dbFile);
  const adjustmentsStore = new SqliteKpiAdjustmentsStore(dbFile);
  const declarationsStore = new SqliteDeclarationsStore(dbFile);
  const hqAgenciesStore = new SqliteHqAgenciesStore(dbFile);
  const kpiRulesStore = new SqliteKpiRulesStore(dbFile);
  const teamsStore = new SqliteTeamsStore(dbFile);
  const adjustmentsReader = createAdjustmentAsyncReader(reader);
  const declarationsReader = createDeclarationAsyncReader(reader);
  const hqAgenciesReader = new SqliteHqAgenciesAsyncReader(dbFile);
  const kpiRulesReader = createKpiRulesAsyncReader(reader);
  const mstAssignmentsReader = createMstAssignmentAsyncReader(reader);
  const teamsReader = createTeamRosterAsyncReader(reader);
  const projections = createSqliteReportingProjectionPersistence(dbFile);

  return {
    mode: config.persistenceMode,
    sourceKind: reader.getSourceKind(),
    adjustmentsReader,
    adjustmentsStore,
    authStore,
    declarationsReader,
    declarationsStore,
    hqAgenciesReader,
    hqAgenciesStore,
    kpiRulesReader,
    kpiRulesStore,
    mstAssignmentsReader,
    teamsReader,
    teamsStore,
    projections,
    dispose: async () => {},
  };
}

function requireDbFile(dbFile: string | null, errorMessage: string): string {
  if (typeof dbFile === 'string' && dbFile.trim()) {
    return dbFile;
  }

  throw new Error(errorMessage);
}
