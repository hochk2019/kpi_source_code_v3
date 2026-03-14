import Database from 'better-sqlite3';

import { writeRuleCollectionSnapshot } from '../../../../server/businessSnapshotSqlite.js';
import type { KpiRuleCollection } from './kpiRuleDefaults.js';
import { cloneKpiRuleCollection, type KpiRulesStore } from './kpiRulesStore.js';

const LEGACY_RULES_KEY = 'kpi_rules_v2';

export class SqliteKpiRulesStore implements KpiRulesStore {
  constructor(private readonly dbFile: string) {}

  async writeRuleCollection(collection: KpiRuleCollection): Promise<KpiRuleCollection> {
    const normalized = cloneKpiRuleCollection(collection);

    return this.withDatabase((database) => {
      writeRuleCollectionSnapshot(database, normalized, {
        updatedAt: new Date().toISOString(),
      });
      this.ensureKvStore(database);
      database
        .prepare(
          'INSERT INTO kv_store (key, value) VALUES (?, ?) ' +
            'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        )
        .run(LEGACY_RULES_KEY, JSON.stringify(normalized));

      return cloneKpiRuleCollection(normalized);
    });
  }

  private ensureKvStore(database: Database): void {
    database.exec('CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }

  private withDatabase<T>(work: (database: Database) => T): T {
    const database = new Database(this.dbFile);

    try {
      return work(database);
    } finally {
      database.close();
    }
  }
}
