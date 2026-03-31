/* eslint-env node */

/* @vitest-environment node */

import process from 'node:process';

import path from 'node:path';

import { Buffer } from 'node:buffer';

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import request from 'supertest';
import { installTestBootstrapAuthEnv } from './helpers/bootstrapAuth.js';

import { AUDIT_KEY, saveDeclRows, markDeclRowsReviewed, updateDeclRowFields, getAuditLogs } from '../src/lib/store.js';

import { clearStorageCache, setItem } from '../src/lib/storageClient.js';

import { resetSqlMonitor, getSqlTimeoutEvents } from '../server/sqlMonitor.js';
import {
  writeAdjustmentRowsSnapshot,
  readAdjustmentRowsSnapshot,
  readDeclarationRowsSnapshot,
  readMstAssignmentRowsSnapshot,
  readRuleCollectionSnapshot,
  writeDeclarationRowsSnapshot,
  writeMstAssignmentRowsSnapshot,
  writeRuleCollectionSnapshot,
} from '../server/businessSnapshotSqlite.js';
import { readTeamRosterSnapshot, writeTeamRosterSnapshot } from '../server/teamRosterSqlite.js';
import { writeReportingProjectionValue } from '../server/reportingProjectionSqlite.js';



process.env.NODE_ENV = 'test';

process.env.VITEST = 'true';

process.env.KPI_DB_FILE = ':memory:';

process.env.KPI_DISABLE_CRON = '1';

process.env.KPI_SKIP_LISTEN = '1';

process.env.ECUS_SQL_SERVER = 'MOCK-SERVER';

installTestBootstrapAuthEnv(process.env);



const skipExternalTests = ['1', 'true', 'yes'].includes(
  String(process.env.KPI_SKIP_EXTERNAL_TESTS || '').toLowerCase()
);

const describeExternal = skipExternalTests ? describe.skip : describe;



const mockState = {

  result: [],

  connectError: null,

  queryError: null,

  requests: [],

  lastConfig: null,

  lastQuery: null,

  closed: false,

};



class FakeStatement {

  constructor(database, sql) {

    this.database = database;

    this.sql = sql;

  }



  run(...params) {
    if (this.sql.includes('INSERT INTO export_audit')) {

      const payload = params[0] && typeof params[0] === 'object' ? params[0] : {};

      const entry = {

        id: ++this.database.exportAuditSeq,

        created_at: payload.created_at ?? new Date().toISOString(),

        issued_at: payload.issued_at ?? null,

        username: payload.username ?? 'unknown',

        display_name: payload.display_name ?? null,

        role: payload.role ?? null,

        report_kind: payload.report_kind ?? 'unknown',

        filename: payload.filename ?? null,

        signature: payload.signature ?? null,

        short_signature: payload.short_signature ?? null,

        filter_summary: payload.filter_summary ?? null,

        filters: payload.filters ?? null,

        ip_address: payload.ip_address ?? null,

        request_id: payload.request_id ?? null,

        user_agent: payload.user_agent ?? null,

      };

      this.database.exportAudit.push(entry);

      return { changes: 1, lastInsertRowid: entry.id };

    }

    if (this.sql.includes('INSERT INTO kv_store')) {

      const [key, value] = params;

      if (value === null || value === undefined) {

        this.database.store.delete(String(key));

        return { changes: 1 };

      }

      this.database.store.set(String(key), String(value));

      return { changes: 1 };

    }

    if (this.sql.includes('INSERT INTO reporting_projections')) {

      const [
        projectionKey,
        projectionType,
        scopeKey,
        rangeFrom,
        rangeTo,
        queryKey,
        entryCount,
        payload,
        updatedAt,
      ] = params;

      this.database.reportingProjections.set(String(projectionKey), {

        projection_key: String(projectionKey),

        projection_type: String(projectionType),

        scope_key: String(scopeKey ?? ''),

        range_from: String(rangeFrom ?? ''),

        range_to: String(rangeTo ?? ''),

        query_key: String(queryKey ?? ''),

        entry_count: Number(entryCount ?? 0),

        payload: String(payload),

        updated_at: String(updatedAt),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('INSERT INTO business_snapshot_state')) {

      const [domainKey, snapshotKey, version, rowCount, payload, updatedAt] = params;
      const compositeKey = `${String(domainKey)}::${String(snapshotKey)}`;

      this.database.businessSnapshotState.set(compositeKey, {

        domain_key: String(domainKey),

        snapshot_key: String(snapshotKey),

        version: Number(version ?? 1),

        row_count: Number(rowCount ?? 0),

        payload: payload === null || payload === undefined ? null : String(payload),

        updated_at: String(updatedAt ?? ''),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('INSERT INTO declaration_snapshot_rows')) {

      const [
        snapshotKey,
        sortOrder,
        declarationKey,
        soTk,
        soTkFull,
        branch,
        mst,
        registeredAt,
        company,
        status,
        staffName,
        teamName,
        deletedAt,
        coCount,
        duplicatePrefix,
        agencySearch,
        payload,
      ] = params;
      const compositeKey = `${String(snapshotKey)}::${Number(sortOrder ?? 0)}`;

      this.database.declarationSnapshotRows.set(compositeKey, {

        snapshot_key: String(snapshotKey),

        sort_order: Number(sortOrder ?? 0),

        declaration_key: String(declarationKey ?? ''),

        so_tk: String(soTk ?? ''),

        so_tk_full: String(soTkFull ?? ''),

        branch: String(branch ?? ''),

        mst: String(mst ?? ''),

        registered_at: String(registeredAt ?? ''),

        company: String(company ?? ''),

        status: String(status ?? ''),

        staff_name: String(staffName ?? ''),

        team_name: String(teamName ?? ''),

        deleted_at: String(deletedAt ?? ''),

        co_count: Number(coCount ?? 0),

        duplicate_prefix: String(duplicatePrefix ?? ''),

        agency_search: String(agencySearch ?? ''),

        payload: String(payload ?? ''),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('INSERT INTO mst_assignment_snapshot_rows')) {

      const [snapshotKey, sortOrder, mst, company, personImport, personExport, team, effectiveFrom, effectiveTo, payload] = params;
      const compositeKey = `${String(snapshotKey)}::${Number(sortOrder ?? 0)}`;

      this.database.mstAssignmentSnapshotRows.set(compositeKey, {

        snapshot_key: String(snapshotKey),

        sort_order: Number(sortOrder ?? 0),

        mst: String(mst ?? ''),

        company: String(company ?? ''),

        person_import: String(personImport ?? ''),

        person_export: String(personExport ?? ''),

        team: String(team ?? ''),

        effective_from: String(effectiveFrom ?? ''),

        effective_to: String(effectiveTo ?? ''),

        payload: String(payload ?? ''),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('INSERT INTO adjustment_snapshot_rows')) {

      const [snapshotKey, sortOrder, adjustmentId, month, category, staffName, teamName, status, totalPoints, payload] = params;
      const compositeKey = `${String(snapshotKey)}::${Number(sortOrder ?? 0)}`;

      this.database.adjustmentSnapshotRows.set(compositeKey, {

        snapshot_key: String(snapshotKey),

        sort_order: Number(sortOrder ?? 0),

        adjustment_id: String(adjustmentId ?? ''),

        month: String(month ?? ''),

        category: String(category ?? ''),

        staff_name: String(staffName ?? ''),

        team_name: String(teamName ?? ''),

        status: String(status ?? ''),

        total_points: Number(totalPoints ?? 0),

        payload: String(payload ?? ''),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('INSERT INTO team_roster_state')) {

      const [snapshotKey, version, teamCount, memberCount, updatedAt] = params;

      this.database.teamRosterState.set(String(snapshotKey), {

        snapshot_key: String(snapshotKey),

        version: Number(version),

        team_count: Number(teamCount),

        member_count: Number(memberCount),

        updated_at: String(updatedAt),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('INSERT INTO teams')) {

      const [id, snapshotKey, legacyTeamId, name, sortOrder, active, updatedAt] = params;

      this.database.teams.set(String(id), {

        id: String(id),

        snapshot_key: String(snapshotKey),

        legacy_team_id: String(legacyTeamId ?? ''),

        name: String(name ?? ''),

        sort_order: Number(sortOrder ?? 0),

        active: Number(active ?? 0),

        updated_at: String(updatedAt ?? ''),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('INSERT INTO team_members')) {

      const [id, teamId, snapshotKey, legacyMemberId, fullName, notes, sortOrder, active, updatedAt] = params;

      this.database.teamMembers.set(String(id), {

        id: String(id),

        team_id: String(teamId),

        snapshot_key: String(snapshotKey),

        legacy_member_id: String(legacyMemberId ?? ''),

        full_name: String(fullName ?? ''),

        notes: String(notes ?? ''),

        sort_order: Number(sortOrder ?? 0),

        active: Number(active ?? 0),

        updated_at: String(updatedAt ?? ''),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('DELETE FROM kv_store')) {

      const [key] = params;

      const deleted = this.database.store.delete(String(key));

      return { changes: deleted ? 1 : 0 };

    }

    if (this.sql.includes('DELETE FROM declaration_snapshot_rows WHERE snapshot_key')) {

      const [snapshotKey] = params;
      let changes = 0;

      for (const [id, row] of Array.from(this.database.declarationSnapshotRows.entries())) {

        if (row.snapshot_key === String(snapshotKey)) {

          this.database.declarationSnapshotRows.delete(id);

          changes += 1;

        }

      }

      return { changes };

    }

    if (this.sql.includes('DELETE FROM mst_assignment_snapshot_rows WHERE snapshot_key')) {

      const [snapshotKey] = params;
      let changes = 0;

      for (const [id, row] of Array.from(this.database.mstAssignmentSnapshotRows.entries())) {

        if (row.snapshot_key === String(snapshotKey)) {

          this.database.mstAssignmentSnapshotRows.delete(id);

          changes += 1;

        }

      }

      return { changes };

    }

    if (this.sql.includes('DELETE FROM adjustment_snapshot_rows WHERE snapshot_key')) {

      const [snapshotKey] = params;
      let changes = 0;

      for (const [id, row] of Array.from(this.database.adjustmentSnapshotRows.entries())) {

        if (row.snapshot_key === String(snapshotKey)) {

          this.database.adjustmentSnapshotRows.delete(id);

          changes += 1;

        }

      }

      return { changes };

    }

    if (this.sql.includes('DELETE FROM business_snapshot_state WHERE domain_key')) {

      const [domainKey, snapshotKey] = params;
      const compositeKey = `${String(domainKey)}::${String(snapshotKey)}`;
      const deleted = this.database.businessSnapshotState.delete(compositeKey);

      return { changes: deleted ? 1 : 0 };

    }

    if (this.sql.includes('DELETE FROM team_members WHERE snapshot_key')) {

      const [snapshotKey] = params;

      let changes = 0;

      for (const [id, row] of Array.from(this.database.teamMembers.entries())) {

        if (row.snapshot_key === String(snapshotKey)) {

          this.database.teamMembers.delete(id);

          changes += 1;

        }

      }

      return { changes };

    }

    if (this.sql.includes('DELETE FROM teams WHERE snapshot_key')) {

      const [snapshotKey] = params;

      let changes = 0;

      for (const [id, row] of Array.from(this.database.teams.entries())) {

        if (row.snapshot_key === String(snapshotKey)) {

          this.database.teams.delete(id);

          changes += 1;

        }

      }

      return { changes };

    }

    if (this.sql.includes('DELETE FROM team_roster_state WHERE snapshot_key')) {

      const [snapshotKey] = params;

      const deleted = this.database.teamRosterState.delete(String(snapshotKey));

      return { changes: deleted ? 1 : 0 };

    }

    if (this.sql.includes('DELETE FROM reporting_projections')) {

      const [projectionKey] = params;

      const deleted = this.database.reportingProjections.delete(String(projectionKey));

      return { changes: deleted ? 1 : 0 };

    }

    if (this.sql.includes('INSERT INTO auth_sessions')) {

      const [token, username, createdAt, expiresAt] = params;

      this.database.sessions.set(String(token), {

        token: String(token),

        username: String(username),

        created_at: Number(createdAt),

        expires_at: Number(expiresAt),

      });

      return { changes: 1 };

    }

    if (this.sql.includes('DELETE FROM auth_sessions WHERE token')) {

      const [token] = params;

      const deleted = this.database.sessions.delete(String(token));

      return { changes: deleted ? 1 : 0 };

    }

    if (this.sql.includes('DELETE FROM auth_sessions WHERE username')) {

      const [username] = params;

      let changes = 0;

      for (const [token, session] of Array.from(this.database.sessions.entries())) {

        if (session.username === String(username)) {

          this.database.sessions.delete(token);

          changes += 1;

        }

      }

      return { changes };

    }

    if (this.sql.includes('DELETE FROM auth_sessions WHERE expires_at')) {

      const [expiresAt] = params;

      let changes = 0;

      for (const [token, session] of Array.from(this.database.sessions.entries())) {

        if (session.expires_at <= Number(expiresAt)) {

          this.database.sessions.delete(token);

          changes += 1;

        }

      }

      return { changes };

    }

    return { changes: 0 };

  }



  filterExportAudit(params = {}) {

    const baseParams = params && typeof params === 'object' ? params : {};

    const fromIso = baseParams.from || baseParams['@from'];

    const toIso = baseParams.to || baseParams['@to'];

    const kind = (baseParams.kind || baseParams['@kind'] || '').toString().toLowerCase();

    const searchRaw = (baseParams.search || baseParams['@search'] || '').toString().toLowerCase();

    const search = searchRaw.replace(/%/g, '');

    const fromTs = fromIso ? new Date(fromIso).getTime() : Number.NaN;

    const toTs = toIso ? new Date(toIso).getTime() : Number.NaN;



    return this.database.exportAudit.filter((entry) => {

      const createdTs = new Date(entry.created_at).getTime();

      if (Number.isFinite(fromTs) && createdTs < fromTs) {

        return false;

      }

      if (Number.isFinite(toTs) && createdTs > toTs) {

        return false;

      }

      if (kind && entry.report_kind.toString().toLowerCase() !== kind) {

        return false;

      }

      if (search) {

        const haystack = [

          entry.username,

          entry.display_name,

          entry.role,

          entry.report_kind,

          entry.filename,

          entry.signature,

          entry.short_signature,

          entry.filter_summary,

          entry.request_id,

          entry.ip_address,

        ]

          .map((value) => (value ?? '').toString().toLowerCase())

          .join(' ');

        if (!haystack.includes(search)) {

          return false;

        }

      }

      return true;

    });

  }



  get(...params) {

    if (this.sql.includes('SELECT value FROM kv_store WHERE key')) {

      const [key] = params;

      if (this.database.store.has(String(key))) {

        return { value: this.database.store.get(String(key)) };

      }

      return undefined;

    }

    if (this.sql.includes('SELECT version FROM team_roster_state WHERE snapshot_key = ?')) {

      const [snapshotKey] = params;

      const row = this.database.teamRosterState.get(String(snapshotKey));

      return row ? { version: row.version } : undefined;

    }

    if (this.sql.includes('FROM business_snapshot_state') && this.sql.includes('WHERE domain_key = ? AND snapshot_key = ?')) {

      const [domainKey, snapshotKey] = params;
      const compositeKey = `${String(domainKey)}::${String(snapshotKey)}`;
      const row = this.database.businessSnapshotState.get(compositeKey);

      return row ? { ...row } : undefined;

    }

    if (this.sql.includes('SELECT payload FROM reporting_projections WHERE projection_key = ?')) {

      const [projectionKey] = params;

      const row = this.database.reportingProjections.get(String(projectionKey));

      if (!row) {

        return undefined;

      }

      return { payload: row.payload };

    }

    if (this.sql.includes("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")) {

      const [tableName] = params;

      if (String(tableName) === 'reporting_projections') {

        return { name: 'reporting_projections' };

      }

      return undefined;

    }

    if (this.sql.includes('SELECT token, username, created_at, expires_at FROM auth_sessions WHERE token = ?')) {

      const [token] = params;

      const session = this.database.sessions.get(String(token));

      if (!session) {

        return undefined;

      }

      return { ...session };

    }

    if (this.sql.includes('SELECT COUNT(*) AS total FROM export_audit')) {

      const [arg] = params;

      const rows = this.filterExportAudit(arg);

      return { total: rows.length };

    }

    if (this.sql.includes('SELECT COUNT(*) AS total FROM teams')) {

      return { total: this.database.teams.size };

    }

    if (this.sql.includes('SELECT COUNT(*) AS total FROM team_members')) {

      return { total: this.database.teamMembers.size };

    }

    return undefined;

  }



  all() {

    if (this.sql.includes('PRAGMA table_info(reporting_projections)')) {

      return [
        { name: 'projection_key' },
        { name: 'projection_type' },
        { name: 'scope_key' },
        { name: 'range_from' },
        { name: 'range_to' },
        { name: 'query_key' },
        { name: 'entry_count' },
        { name: 'payload' },
        { name: 'updated_at' },
      ];

    }

    if (this.sql.includes('SELECT key FROM kv_store') && !this.sql.includes('value')) {

      return Array.from(this.database.store.keys()).map((key) => ({ key }));

    }

    if (this.sql.includes('SELECT key, value FROM kv_store')) {

      return Array.from(this.database.store.entries()).map(([key, value]) => ({ key, value }));

    }

    if (this.sql.includes('SELECT projection_key, payload FROM reporting_projections')) {

      return Array.from(this.database.reportingProjections.values()).map((row) => ({

        projection_key: row.projection_key,

        payload: row.payload,

      }));

    }

    if (this.sql.includes('SELECT token, username FROM auth_sessions')) {

      return Array.from(this.database.sessions.values()).map((session) => ({

        token: session.token,

        username: session.username,

      }));

    }

    if (this.sql.includes('SELECT token FROM auth_sessions')) {

      return Array.from(this.database.sessions.keys()).map((token) => ({ token }));

    }

    if (this.sql.includes('FROM teams')) {

      if (this.sql.includes('WHERE snapshot_key = ? AND active = 1')) {

        const [snapshotKey] = arguments;

        return Array.from(this.database.teams.values())
          .filter((row) => row.snapshot_key === String(snapshotKey) && row.active === 1)
          .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
          .map((row) => ({ ...row }));

      }

      return Array.from(this.database.teams.values())
        .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
        .map((row) => ({ ...row }));

    }

    if (this.sql.includes('FROM team_members')) {

      if (this.sql.includes('WHERE snapshot_key = ? AND active = 1')) {

        const [snapshotKey] = arguments;

        return Array.from(this.database.teamMembers.values())
          .filter((row) => row.snapshot_key === String(snapshotKey) && row.active === 1)
          .sort(
            (left, right) =>
              left.team_id.localeCompare(right.team_id) ||
              left.sort_order - right.sort_order ||
              left.full_name.localeCompare(right.full_name)
          )
          .map((row) => ({ ...row }));

      }

      return Array.from(this.database.teamMembers.values())
        .sort((left, right) => left.sort_order - right.sort_order || left.full_name.localeCompare(right.full_name))
        .map((row) => ({ ...row }));

    }

    if (this.sql.includes('FROM export_audit')) {

      const [arg] = arguments;

      const rows = this.filterExportAudit(arg);



      if (this.sql.includes('GROUP BY report_kind')) {

        const byKind = new Map();

        for (const row of rows) {

          const key = row.report_kind;

          byKind.set(key, (byKind.get(key) || 0) + 1);

        }

        const result = Array.from(byKind.entries()).map(([kind, total]) => ({ kind, total }));

        return result.sort((a, b) => b.total - a.total);

      }



      if (this.sql.includes('GROUP BY username')) {

        const summary = new Map();

        for (const row of rows) {

          const key = row.username || 'unknown';

          const current = summary.get(key) || { username: key, display_name: row.display_name, role: row.role, total: 0 };

          current.total += 1;

          current.display_name = current.display_name || row.display_name;

          current.role = current.role || row.role;

          summary.set(key, current);

        }

        return Array.from(summary.values()).sort((a, b) => b.total - a.total).slice(0, 5);

      }



      if (this.sql.includes('SELECT DISTINCT report_kind')) {

        const kinds = Array.from(new Set(rows.map((row) => row.report_kind)));

        return kinds.sort((a, b) => a.localeCompare(b)).map((report_kind) => ({ report_kind }));

      }



      let sorted = rows.slice();

      if (this.sql.includes('ORDER BY datetime(created_at) DESC')) {

        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      }



      const limit = arg?.limit ?? sorted.length;

      const offset = arg?.offset ?? 0;

      return sorted.slice(offset, offset + limit).map((row) => ({ ...row }));

    }

    if (this.sql.includes('FROM declaration_snapshot_rows')) {

      const [snapshotKey] = arguments;

      return Array.from(this.database.declarationSnapshotRows.values())
        .filter((row) => row.snapshot_key === String(snapshotKey))
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((row) => ({ payload: row.payload }));

    }

    if (this.sql.includes('FROM mst_assignment_snapshot_rows')) {

      const [snapshotKey] = arguments;

      return Array.from(this.database.mstAssignmentSnapshotRows.values())
        .filter((row) => row.snapshot_key === String(snapshotKey))
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((row) => ({ payload: row.payload }));

    }

    if (this.sql.includes('FROM adjustment_snapshot_rows')) {

      const [snapshotKey] = arguments;

      return Array.from(this.database.adjustmentSnapshotRows.values())
        .filter((row) => row.snapshot_key === String(snapshotKey))
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((row) => ({ payload: row.payload }));

    }

    return [];

  }

}



class FakeDatabase {

  constructor() {

    this.store = new Map();

    this.businessSnapshotState = new Map();
    this.declarationSnapshotRows = new Map();
    this.mstAssignmentSnapshotRows = new Map();
    this.adjustmentSnapshotRows = new Map();
    this.reportingProjections = new Map();

    this.teamRosterState = new Map();

    this.teams = new Map();

    this.teamMembers = new Map();

    this.sessions = new Map();

    this.exportAudit = [];

    this.exportAuditSeq = 0;

  }



  pragma() {}



  exec(sql) {

    if (sql.includes('DELETE FROM kv_store')) {

      this.store.clear();

    }

    if (sql.includes('DELETE FROM declaration_snapshot_rows')) {

      this.declarationSnapshotRows.clear();

    }

    if (sql.includes('DELETE FROM mst_assignment_snapshot_rows')) {

      this.mstAssignmentSnapshotRows.clear();

    }

    if (sql.includes('DELETE FROM adjustment_snapshot_rows')) {

      this.adjustmentSnapshotRows.clear();

    }

    if (sql.includes('DELETE FROM business_snapshot_state')) {

      this.businessSnapshotState.clear();

    }

    if (sql.includes('DELETE FROM reporting_projections')) {

      this.reportingProjections.clear();

    }

    if (sql.includes('DELETE FROM team_members')) {

      this.teamMembers.clear();

    }

    if (sql.includes('DELETE FROM teams')) {

      this.teams.clear();

    }

    if (sql.includes('DELETE FROM team_roster_state')) {

      this.teamRosterState.clear();

    }

    if (sql.includes('DELETE FROM auth_sessions')) {

      this.sessions.clear();

    }

    if (sql.includes('DELETE FROM export_audit')) {

      this.exportAudit = [];

      this.exportAuditSeq = 0;

    }

  }



  prepare(sql) {

    return new FakeStatement(this, sql);

  }



  transaction(fn) {

    return (...args) => fn(...args);

  }



  close() {

    this.store.clear();

    this.businessSnapshotState.clear();
    this.declarationSnapshotRows.clear();
    this.mstAssignmentSnapshotRows.clear();
    this.adjustmentSnapshotRows.clear();
    this.reportingProjections.clear();

    this.teamRosterState.clear();

    this.teams.clear();

    this.teamMembers.clear();

    this.sessions.clear();

  }

}



class MockRequest {

  constructor() {

    this.inputs = {};

  }



  input(name, _type, value) {

    this.inputs[name] = value;

    return this;

  }



  async query(sqlText) {

    mockState.lastQuery = sqlText;

    if (mockState.queryError) {

      throw mockState.queryError;

    }

    return { recordset: mockState.result };

  }

}



class MockConnectionPool {

  constructor(config) {

    this.config = config;

    mockState.lastConfig = config;

  }



  async connect() {

    if (mockState.connectError) {

      throw mockState.connectError;

    }

    return this;

  }



  request() {

    const req = new MockRequest();

    mockState.requests.push(req);

    return req;

  }



  async close() {

    mockState.closed = true;

  }

}



class MockTransaction {

  constructor(pool) {

    this.pool = pool;

    this.active = false;

  }



  async begin() {

    this.active = true;

  }



  async commit() {

    this.active = false;

  }



  async rollback() {

    this.active = false;

  }

}



class MockPreparedStatement {

  constructor(transaction) {

    this.transaction = transaction;

    this.inputs = {};

    this.prepared = false;

  }



  input(name) {

    this.inputs[name] = true;

    return this;

  }



  async prepare() {

    this.prepared = true;

  }



  async execute(parameters) {

    mockState.requests.push({

      type: 'prepared-execute',

      params: parameters,

    });

    return { rowsAffected: [1] };

  }



  async unprepare() {

    this.prepared = false;

  }

}



const DateTimeToken = Symbol.for('mssql.DateTime');



function resetMockState() {

  mockState.result = [];

  mockState.connectError = null;

  mockState.queryError = null;

  mockState.requests = [];

  mockState.lastConfig = null;

  mockState.lastQuery = null;

  mockState.closed = false;

}



function binaryParser(res, callback) {

  res.setEncoding('binary');

  let data = '';

  res.on('data', (chunk) => {

    data += chunk;

  });

  res.on('end', () => {

    try {

      callback(null, Buffer.from(data, 'binary'));

    } catch (err) {

      callback(err);

    }

  });

}



vi.mock('mssql', () => ({

  __esModule: true,

  default: {

    ConnectionPool: MockConnectionPool,

    DateTime: DateTimeToken,

    Request: MockRequest,

    Transaction: MockTransaction,

    PreparedStatement: MockPreparedStatement,

    __setMockResult(rows) {

      mockState.result = Array.isArray(rows) ? rows : [];

    },

    __setMockErrors({ connectError = null, queryError = null } = {}) {

      mockState.connectError = connectError;

      mockState.queryError = queryError;

    },

    __resetMock: resetMockState,

    __getState() {

      return mockState;

    },

  },

  ConnectionPool: MockConnectionPool,

  DateTime: DateTimeToken,

  Request: MockRequest,

  Transaction: MockTransaction,

  PreparedStatement: MockPreparedStatement,

  __setMockResult(rows) {

    mockState.result = Array.isArray(rows) ? rows : [];

  },

  __setMockErrors({ connectError = null, queryError = null } = {}) {

    mockState.connectError = connectError;

    mockState.queryError = queryError;

  },

  __resetMock: resetMockState,

  __getState() {

    return mockState;

  },

}));



vi.mock('better-sqlite3', () => ({

  __esModule: true,

  default: FakeDatabase,

}));



vi.mock('bcryptjs', () => ({

  __esModule: true,

  default: {

    hashSync: (value) => `$2a$${value}`,

    compare: async (input, hash) => hash === `$2a$${input}` || hash === input,

  },

}));



vi.mock('exceljs', () => {

  class MockCell {

    constructor() {

      this.value = null;

      this.font = {};

      this.alignment = {};

      this.border = {};

    }

  }



  class MockRow {

    constructor() {

      this.cells = new Map();

      this.height = 0;

    }



    getCell(index) {

      const key = Number(index) || 1;

      if (!this.cells.has(key)) {

        this.cells.set(key, new MockCell());

      }

      return this.cells.get(key);

    }



    commit() {}

  }



  function columnToIndex(column) {

    return column

      .toUpperCase()

      .split('')

      .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0);

  }



  class MockWorksheet {

    constructor(name = 'Sheet1') {

      this.name = name;

      this.rows = new Map();

      this.pageSetup = {};

      this.columns = [];

      this.images = [];

      this.headerFooter = {};

      this.properties = { outlineProperties: {} };

      this.state = 'visible';

      this.rowCount = 0;

    }



    mergeCells() {}



    getRow(index) {

      const key = Number(index) || 1;

      if (!this.rows.has(key)) {

        this.rows.set(key, new MockRow());

      }

      return this.rows.get(key);

    }



    getCell(ref, colIndex) {

      if (typeof ref === 'string') {

        const match = ref.match(/^([A-Z]+)(\d+)$/i);

        if (match) {

          const [, column, row] = match;

          return this.getRow(Number(row)).getCell(columnToIndex(column));

        }

        return this.getRow(1).getCell(1);

      }

      if (typeof ref === 'number') {

        return this.getRow(ref).getCell(colIndex || 1);

      }

      return this.getRow(1).getCell(1);

    }



    addImage(imageId, placement) {

      this.images.push({ imageId, placement });

    }



    getColumn(index) {

      const idx = (Number(index) || 1) - 1;

      if (!this.columns[idx]) {

        this.columns[idx] = {};

      }

      return this.columns[idx];

    }



    spliceRows(start, deleteCount, ...rows) {

      for (let i = 0; i < deleteCount; i += 1) {

        this.rows.delete(start + i);

      }

      rows.forEach((cells, offset) => {

        const rowIndex = start + offset;

        const row = this.getRow(rowIndex);

        row.values = cells;

        cells.forEach((value, cellIdx) => {

          if (cellIdx === 0) return;

          row.getCell(cellIdx).value = value;

        });

      });

      this.rowCount = Math.max(this.rowCount, start + rows.length - 1);

    }

  }



  let workbookCreateCount = 0;



  class MockWorkbook {

    constructor() {

      workbookCreateCount += 1;

      this.worksheets = [];

      this.images = [];

      this.xlsx = {

        writeBuffer: async () => Buffer.from('excel-mock'),

      };

    }



    addWorksheet(name) {

      const sheet = new MockWorksheet(name);

      this.worksheets.push(sheet);

      return sheet;

    }



    addImage(config) {

      const id = this.images.length + 1;

      this.images.push({ id, config });

      return id;

    }



    getWorksheet(name) {

      return this.worksheets.find((sheet) => sheet.name === name);

    }

  }



  const excelNamespace = {

    Workbook: MockWorkbook,

    __getWorkbookCreateCount: () => workbookCreateCount,

    __resetWorkbookCreateCount: () => {

      workbookCreateCount = 0;

    },

  };



  return {

    __esModule: true,

    default: excelNamespace,

    Workbook: MockWorkbook,

  };

});



const sqlModule = await import('mssql');

const sqlMock = sqlModule.default;

const excelModule = await import('exceljs');

const excelMock = excelModule.default;

const reportExportModule = await import('../server/reportExport.js');

const { clearReportCache } = reportExportModule;



let app;

let resetDb;

let getDb;

let stopServer;

let waitAccountSync;



beforeAll(async () => {

  const serverModule = await import('../server/index.js');

  app = serverModule.app;

  resetDb = serverModule.resetDatabaseForTests;

  getDb = serverModule.getDatabaseHandle;

  stopServer = serverModule.stopServer;

  waitAccountSync = serverModule.waitForAccountSqlSyncIdle;

});


function upsertKvValue(key, value) {

  getDb()

    .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')

    .run(key, JSON.stringify(value));

  const database = getDb();

  if (!database) {

    return;

  }

  if (key === 'decl_rows_v1') {

    writeDeclarationRowsSnapshot(database, value, { updatedAt: '2026-03-12T00:00:00.000Z' });

    return;

  }

  if (key === 'mst_rows_v2') {

    writeMstAssignmentRowsSnapshot(database, value, { updatedAt: '2026-03-12T00:00:00.000Z' });

    return;

  }

  if (key === 'kpi_rules_v2') {

    writeRuleCollectionSnapshot(database, value, { updatedAt: '2026-03-12T00:00:00.000Z' });

    return;

  }

  if (key === 'kpi_adjustments_v1') {

    writeAdjustmentRowsSnapshot(database, value, { updatedAt: '2026-03-12T00:00:00.000Z' });

    return;

  }

  if (key === 'team_roster_v1') {

    writeTeamRosterSnapshot(database, value, { updatedAt: '2026-03-12T00:00:00.000Z' });

    return;

  }

  if (
    key === 'kpi_report_schedule_v1' ||
    key === 'kpi_reporting_monthly_aggregates_v1' ||
    key === 'kpi_reporting_monthly_aggregates_default_v1'
  ) {

    writeReportingProjectionValue(database, key, value, { updatedAt: '2026-03-12T00:00:00.000Z' });

  }

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

          title: 'NhÃƒÆ’Ã‚Â³m 1',

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

          licenseSummary: 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â',

          adjustmentTotals: {},

          licenseCodes: [],

          licenseCount: 0,

        },

        topTeams: [],

        topStaff: [],

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

          licenseSummary: 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â',

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



function seedReportingReadModelData() {

  const seed = createReportingSeed();

  for (const [key, value] of Object.entries(seed)) {

    upsertKvValue(key, value);

  }

}



function seedReportingAggregateData() {

  const seed = createReportingAggregateSeed();

  for (const [key, value] of Object.entries(seed)) {

    upsertKvValue(key, value);

  }

}



describe('API xÃƒÆ’Ã‚Â¡c thÃƒÂ¡Ã‚Â»Ã‚Â±c & bootstrap', () => {

  beforeEach(() => {

    resetDb();

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi bootstrap khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const response = await request(app).get('/api/bootstrap');

    expect(response.status).toBe(401);

    expect(response.body?.ok).toBe(false);

  });



  it('bootstrap trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ khÃƒÂ¡Ã‚Â»Ã‚Â­ mÃƒÂ¡Ã‚ÂºÃ‚Â­t khÃƒÂ¡Ã‚ÂºÃ‚Â©u vÃƒÆ’Ã‚Â  cÃƒÆ’Ã‚Â³ cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh HQ mÃƒÂ¡Ã‚ÂºÃ‚Â·c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh', async () => {

    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const response = await agent.get('/api/bootstrap');

    expect(response.status).toBe(200);

    const payload = response.body?.data;

    expect(payload).toBeTruthy();

    expect(payload).toHaveProperty('hq_agencies_v1', '[]');

    expect(payload).toHaveProperty('hq_history_v1', '[]');

    const accounts = JSON.parse(payload.kpi_users_v1 || '[]');

    expect(Array.isArray(accounts)).toBe(true);

    expect(accounts.length).toBeGreaterThan(0);

    const usernames = accounts.map((account) => account.username).sort();

    expect(usernames).toEqual(

      expect.arrayContaining([

        'admin',

        'nhanvien',

        'lead.hoc',

        'lead.phuong',

        'lead.tuan',

        'manager.hoangkimhoa',

        'manager.thuyha',

        'manager.hoainam',

      ])

    );

    const teamLead = accounts.find((account) => account.username === 'lead.hoc');

    expect(teamLead).toMatchObject({ role: 'lead' });

    expect(teamLead?.permissions?.teamsEdit).toBe(true);

    expect(teamLead?.permissions?.accountManage).toBe(false);

    expect(teamLead?.permissions?.importUpload).toBe(false);

    const manager = accounts.find((account) => account.username === 'manager.hoangkimhoa');

    expect(manager).toMatchObject({ role: 'manager' });

    expect(manager?.permissions?.rulesEdit).toBe(true);

    expect(manager?.permissions?.accountManage).toBe(false);

    expect(manager?.permissions?.importUpload).toBe(true);

    for (const account of accounts) {

      expect(account).not.toHaveProperty('password');

      expect(account).not.toHaveProperty('passwordHash');

    }

  });



  it('Ãƒâ€ Ã‚Â°u tiÃƒÆ’Ã‚Âªn dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n tÃƒÂ¡Ã‚Â»Ã‚Â« SQL Server khi Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ bootstrap', async () => {

    const updatedAt = new Date('2099-05-15T08:00:00Z');

    sqlMock.__setMockResult([

      {

        username: 'admin',

        password_hash: '$2a$AdminSql',

        role: 'manager',

        name: 'QuÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ SQL',

        permissions: JSON.stringify({

          importEdit: false,

          importUpload: false,

          mstEdit: true,

          reportsExport: true,

          accountManage: false,

        }),

        updated_at: updatedAt,

      },

    ]);



    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'AdminSql' });

    expect(loginRes.status).toBe(200);

    const response = await agent.get('/api/bootstrap');

    expect(response.status).toBe(200);

    const payload = response.body?.data;

    expect(payload).toBeTruthy();

    const accounts = JSON.parse(payload?.kpi_users_v1 || '[]');

    const admin = accounts.find((account) => account.username === 'admin');

    expect(admin).toBeTruthy();

    expect(admin?.role).toBe('manager');

    expect(admin?.name).toBe('QuÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ SQL');

    expect(admin?.permissions?.mstEdit).toBe(true);

    expect(admin?.permissions?.importEdit).toBe(false);

    expect(admin?.permissions?.importUpload).toBe(false);



    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('kpi_users_v1');

    expect(row?.value).toBeTruthy();

    const storedAccounts = JSON.parse(row.value);

    const storedAdmin = storedAccounts.find((account) => account.username === 'admin');

    expect(storedAdmin?.role).toBe('manager');

    expect(storedAdmin?.passwordHash).toBe('$2a$AdminSql');

    expect(storedAdmin?.updatedAt).toBe('2099-05-15T08:00:00.000Z');

  });



  it('cho phÃƒÆ’Ã‚Â©p Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p bÃƒÂ¡Ã‚ÂºÃ‚Â±ng tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n mÃƒÂ¡Ã‚ÂºÃ‚Â·c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh', async () => {

    const response = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(response.status).toBe(200);

    expect(response.body?.ok).toBe(true);

    expect(response.body?.user).toMatchObject({ username: 'admin', role: 'admin' });

    expect(response.body?.user).not.toHaveProperty('passwordHash');

    expect(response.body).not.toHaveProperty('token');

    expect(typeof response.body?.expiresAt).toBe('number');

    expect(response.headers['set-cookie']).toBeDefined();

  });



  it('dùng mật khẩu bootstrap từ biến môi trường thay vì seed cứng', async () => {

    const previousAlias = process.env.KPI_BOOTSTRAP_ADMIN_PASSWORD;

    const previousGeneric = process.env.KPI_BOOTSTRAP_PASSWORD_ADMIN;

    process.env.KPI_BOOTSTRAP_ADMIN_PASSWORD = 'AdminEnv#2026';

    delete process.env.KPI_BOOTSTRAP_PASSWORD_ADMIN;

    resetDb();

    try {

      const legacyResponse = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

      expect(legacyResponse.status).toBe(401);

      const response = await request(app)

        .post('/api/auth/login')

        .send({ username: 'admin', password: 'AdminEnv#2026' });

      expect(response.status).toBe(200);

      expect(response.body?.user).toMatchObject({ username: 'admin', role: 'admin' });

    } finally {

      process.env.KPI_BOOTSTRAP_ADMIN_PASSWORD = previousAlias;

      if (previousGeneric) {

        process.env.KPI_BOOTSTRAP_PASSWORD_ADMIN = previousGeneric;

      } else {

        delete process.env.KPI_BOOTSTRAP_PASSWORD_ADMIN;

      }

      resetDb();

    }

  });



  it('trả lỗi cấu hình rõ ràng khi DB rỗng và thiếu mật khẩu bootstrap admin', async () => {

    const previousAlias = process.env.KPI_BOOTSTRAP_ADMIN_PASSWORD;

    const previousGeneric = process.env.KPI_BOOTSTRAP_PASSWORD_ADMIN;

    delete process.env.KPI_BOOTSTRAP_ADMIN_PASSWORD;

    delete process.env.KPI_BOOTSTRAP_PASSWORD_ADMIN;

    resetDb();

    try {

      const response = await request(app)

        .post('/api/auth/login')

        .send({ username: 'admin', password: 'whatever' });

      expect(response.status).toBe(500);

      expect(response.body?.error || '').toContain('KPI_BOOTSTRAP_ADMIN_PASSWORD');

    } finally {

      if (previousAlias) {

        process.env.KPI_BOOTSTRAP_ADMIN_PASSWORD = previousAlias;

      } else {

        delete process.env.KPI_BOOTSTRAP_ADMIN_PASSWORD;

      }

      if (previousGeneric) {

        process.env.KPI_BOOTSTRAP_PASSWORD_ADMIN = previousGeneric;

      } else {

        delete process.env.KPI_BOOTSTRAP_PASSWORD_ADMIN;

      }

      resetDb();

    }

  });



  it('cho phÃƒÆ’Ã‚Â©p trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã…Â¸ng nhÃƒÆ’Ã‚Â³m Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi mÃƒÂ¡Ã‚ÂºÃ‚Â­t khÃƒÂ¡Ã‚ÂºÃ‚Â©u mÃƒÂ¡Ã‚ÂºÃ‚Â·c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh vÃƒÆ’Ã‚Â  khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ quyÃƒÂ¡Ã‚Â»Ã‚Ân quÃƒÂ¡Ã‚ÂºÃ‚Â£n lÃƒÆ’Ã‚Â½ tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n', async () => {

    const response = await request(app)

      .post('/api/auth/login')

      .send({ username: 'lead.phuong', password: 'Phuong@2024' });

    expect(response.status).toBe(200);

    expect(response.body?.ok).toBe(true);

    expect(response.body?.user).toMatchObject({ username: 'lead.phuong', role: 'lead' });

    expect(response.body?.user?.permissions?.accountManage).toBe(false);

  });



  it('duy trÃƒÆ’Ã‚Â¬ phiÃƒÆ’Ã‚Âªn Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p vÃƒÆ’Ã‚Â  cho phÃƒÆ’Ã‚Â©p Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t', async () => {

    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const sessionRes = await agent.get('/api/auth/session');

    expect(sessionRes.status).toBe(200);

    expect(sessionRes.body?.user).toMatchObject({ username: 'admin', role: 'admin' });



    const logoutRes = await agent.post('/api/auth/logout').send();

    expect(logoutRes.status).toBe(200);



    const sessionAfterLogout = await agent.get('/api/auth/session');

    expect(sessionAfterLogout.body?.user).toBeNull();

  });



  it('cÃƒÂ¡Ã‚ÂºÃ‚Â¥p lÃƒÂ¡Ã‚ÂºÃ‚Â¡i cookie phiÃƒÆ’Ã‚Âªn sau khi ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i mÃƒÂ¡Ã‚ÂºÃ‚Â­t khÃƒÂ¡Ã‚ÂºÃ‚Â©u', async () => {

    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const changeRes = await agent

      .post('/api/auth/password/change')

      .send({ username: 'admin', currentPassword: 'admin123', newPassword: 'admin999' });

    expect(changeRes.status).toBe(200);

    expect(changeRes.headers['set-cookie']).toBeDefined();



    expect(changeRes.body).not.toHaveProperty('token');

    expect(typeof changeRes.body?.expiresAt).toBe('number');



    const sessionAfterChange = await agent.get('/api/auth/session');

    expect(sessionAfterChange.body?.user).toMatchObject({ username: 'admin' });

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p khi mÃƒÂ¡Ã‚ÂºÃ‚Â­t khÃƒÂ¡Ã‚ÂºÃ‚Â©u sai', async () => {

    const response = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'sai' });

    expect(response.status).toBe(401);

    expect(response.body?.ok).toBe(false);

  });



  it('khÃƒÆ’Ã‚Â´ng cho phÃƒÆ’Ã‚Â©p ghi Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â¨ kpi_users_v1 qua API storage chung', async () => {

    const response = await request(app)

      .put('/api/storage/kpi_users_v1')

      .send({ value: JSON.stringify([]) });

    expect(response.status).toBe(403);

  });



  it('yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p khi truy vÃƒÂ¡Ã‚ÂºÃ‚Â¥n lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ Ãƒâ€žÃ‚ÂÃƒÂ¡Ã‚ÂºÃ‚Â¡i lÃƒÆ’Ã‚Â½ HQ', async () => {

    const response = await request(app).get('/api/hq/history');

    expect(response.status).toBe(401);

    expect(response.body?.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi truy vÃƒÂ¡Ã‚ÂºÃ‚Â¥n lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ Ãƒâ€žÃ‚ÂÃƒÂ¡Ã‚ÂºÃ‚Â¡i lÃƒÆ’Ã‚Â½ HQ nÃƒÂ¡Ã‚ÂºÃ‚Â¿u tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n thiÃƒÂ¡Ã‚ÂºÃ‚Â¿u quyÃƒÂ¡Ã‚Â»Ã‚Ân mstEdit', async () => {

    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });



    const response = await agent.get('/api/hq/history');

    expect(response.status).toBe(403);

    expect(response.body?.ok).toBe(false);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ Ãƒâ€žÃ‚ÂÃƒÂ¡Ã‚ÂºÃ‚Â¡i lÃƒÆ’Ã‚Â½ HQ kÃƒÆ’Ã‚Â¨m bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ lÃƒÂ¡Ã‚Â»Ã‚Âc', async () => {

    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });



    const historyEntries = [

      {

        id: 'hq-0101234567-company',

        mst: '0101234567',

        field: 'company',

        from: '',

        to: 'CÃƒÆ’Ã‚Â´ng ty A',

        actor: 'admin',

        timestamp: new Date('2024-09-01T08:00:00Z').toISOString(),

        type: 'create',

      },

      {

        id: 'hq-0101234567-agents',

        mst: '0101234567',

        field: 'agents',

        from: 'DL CÃƒâ€¦Ã‚Â©',

        to: 'DL MÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi',

        actor: 'admin',

        timestamp: new Date('2024-09-02T08:00:00Z').toISOString(),

        type: 'update',

      },

      {

        id: 'hq-0200000000-company',

        mst: '0200000000',

        field: 'company',

        from: '',

        to: 'CÃƒÆ’Ã‚Â´ng ty B',

        actor: 'tester',

        timestamp: new Date('2024-09-03T08:00:00Z').toISOString(),

        type: 'create',

      },

    ];



    const putRes = await agent

      .put('/api/storage/hq_history_v1')

      .send({ value: JSON.stringify(historyEntries) });

    expect(putRes.status).toBe(200);



    const response = await agent

      .get('/api/hq/history')

      .query({ mst: '0101234567', field: 'agents', limit: 1 });



    expect(response.status).toBe(200);

    expect(response.body?.ok).toBe(true);

    expect(response.body?.entries).toHaveLength(1);

    expect(response.body.entries[0]).toMatchObject({

      mst: '0101234567',

      field: 'agents',

      type: 'update',

    });

    expect(response.body.total).toBeGreaterThanOrEqual(1);

  });



  it('danh sÃƒÆ’Ã‚Â¡ch tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng lÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ hash mÃƒÂ¡Ã‚ÂºÃ‚Â­t khÃƒÂ¡Ã‚ÂºÃ‚Â©u', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const response = await adminAgent.get('/api/auth/accounts');

    expect(response.status).toBe(200);

    const accounts = response.body?.accounts ?? [];

    expect(Array.isArray(accounts)).toBe(true);

    for (const account of accounts) {

      expect(account).not.toHaveProperty('password');

      expect(account).not.toHaveProperty('passwordHash');

    }

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi xem danh sÃƒÆ’Ã‚Â¡ch tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const response = await request(app).get('/api/auth/accounts');

    expect(response.status).toBe(401);

    expect(response.body?.ok).toBe(false);

  });



  it('lÃƒâ€ Ã‚Â°u mÃƒÂ¡Ã‚ÂºÃ‚Â­t khÃƒÂ¡Ã‚ÂºÃ‚Â©u dÃƒÂ¡Ã‚ÂºÃ‚Â¡ng bÃƒâ€žÃ†â€™m trong cÃƒâ€ Ã‚Â¡ sÃƒÂ¡Ã‚Â»Ã…Â¸ dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u', async () => {

    const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const db = getDb();

    const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('kpi_users_v1');

    expect(row?.value).toBeTruthy();

    const accounts = JSON.parse(row.value || '[]');

    expect(accounts.length).toBeGreaterThan(0);

    expect(accounts[0]).not.toHaveProperty('password');

    expect(accounts[0].passwordHash).toMatch(/^\$2[abyx]\$/);

  });

});



describe('QuÃƒÂ¡Ã‚ÂºÃ‚Â£n lÃƒÆ’Ã‚Â½ tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n', () => {

  beforeEach(() => {

    resetDb();

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi quÃƒÂ¡Ã‚ÂºÃ‚Â£n lÃƒÆ’Ã‚Â½ tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khi khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ quyÃƒÂ¡Ã‚Â»Ã‚Ân accountManage', async () => {

    const staffAgent = request.agent(app);

    const loginRes = await staffAgent.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    expect(loginRes.status).toBe(200);

    const response = await staffAgent.get('/api/auth/accounts');

    expect(response.status).toBe(403);

    expect(response.body?.ok).toBe(false);

  });



  it('gÃƒÂ¡Ã‚ÂºÃ‚Â¯n nhÃƒÆ’Ã‚Â¢n viÃƒÆ’Ã‚Âªn KPI khi tÃƒÂ¡Ã‚ÂºÃ‚Â¡o tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n mÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi', async () => {

    const db = getDb();

    const roster = {

      version: 1,

      teams: [

        {

          id: 'team-kt',

          name: 'Team Ke toan',

          members: [

            { id: 'kt001', name: 'Nguyen Thu Phuong' },

            { id: 'kt002', name: 'Tran Minh Duong' },

          ],

        },

      ],

    };

    writeTeamRosterSnapshot(db, roster);



    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const createRes = await adminAgent.post('/api/auth/accounts').send({

      username: 'ketoan.phuong',

      password: 'Phuong@2025',

      role: 'staff',

      memberId: 'kt001',

    });



    expect(createRes.status).toBe(201);

    const account = createRes.body?.account;

    expect(account).toMatchObject({

      username: 'ketoan.phuong',

      memberId: 'kt001',

      memberName: 'Nguyen Thu Phuong',

      teamName: 'Team Ke toan',

    });



    const auditRow = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('audit_logs_v1');

    const logs = JSON.parse(auditRow?.value || '[]');

    const createLog = logs.find((entry) => entry.action === 'account.create' && entry.detail?.includes('ketoan.phuong'));

    expect(createLog).toBeTruthy();

    expect(createLog?.meta?.member).toMatchObject({ memberId: 'kt001', teamName: 'Team Ke toan' });

  });



  it('ghi log chi tiÃƒÂ¡Ã‚ÂºÃ‚Â¿t khi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t quyÃƒÂ¡Ã‚Â»Ã‚Ân tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const createRes = await adminAgent.post('/api/auth/accounts').send({

      username: 'quyen.tester',

      password: 'Tester@2025',

      role: 'staff',

    });

    expect(createRes.status).toBe(201);



    const patchRes = await adminAgent

      .patch('/api/auth/accounts/quyen.tester')

      .send({ permissions: { importEdit: true, importUpload: true, auditView: true } });

    expect(patchRes.status).toBe(200);

    expect(patchRes.body?.account?.permissions?.importEdit).toBe(true);

    expect(patchRes.body?.account?.permissions?.importUpload).toBe(true);

    expect(patchRes.body?.account?.permissions?.auditView).toBe(true);



    const auditRow = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('audit_logs_v1');

    const logs = JSON.parse(auditRow?.value || '[]');

    const updateLog = logs.find((entry) => entry.action === 'account.update' && entry.detail?.includes('quyen.tester'));

    expect(updateLog).toBeTruthy();

    expect(updateLog?.detail).toMatch(/quyền:/i);

    expect(updateLog?.meta?.changes?.permissions).toEqual(

      expect.arrayContaining([

        expect.objectContaining({ key: 'importEdit', after: true }),

        expect.objectContaining({ key: 'importUpload', after: true }),

        expect.objectContaining({ key: 'auditView', after: true }),

      ])

    );

  });



  it('bÃƒÂ¡Ã‚Â»Ã‚Â qua actor do client gÃƒÂ¡Ã‚Â»Ã‚Â­i khi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const createRes = await adminAgent.post('/api/auth/accounts').send({

      username: 'actor.guard',

      password: 'Tester@2025',

      role: 'staff',

    });

    expect(createRes.status).toBe(201);

    const patchRes = await adminAgent

      .patch('/api/auth/accounts/actor.guard')

      .send({ actor: 'spoofed.actor', permissions: { importEdit: true } });

    expect(patchRes.status).toBe(200);

    const auditRow = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('audit_logs_v1');

    const logs = JSON.parse(auditRow?.value || '[]');

    const updateLog = logs.find((entry) => entry.action === 'account.update' && entry.detail?.includes('actor.guard'));

    expect(updateLog).toBeTruthy();

    expect(updateLog?.actor).toBe('admin');

  });

});



describe('API thÃƒÆ’Ã‚Â´ng bÃƒÆ’Ã‚Â¡o hÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡ thÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng', () => {

  beforeEach(() => {

    resetDb();

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi truy cÃƒÂ¡Ã‚ÂºÃ‚Â­p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ thÃƒÆ’Ã‚Â´ng bÃƒÆ’Ã‚Â¡o khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(401);

    expect(res.body?.ok).toBe(false);

  });



  it('cho phÃƒÆ’Ã‚Â©p ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p xem thÃƒÆ’Ã‚Â´ng bÃƒÆ’Ã‚Â¡o', async () => {

    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const res = await agent.get('/api/notifications');

    expect(res.status).toBe(200);

    expect(res.body?.ok).toBe(true);

    expect(Array.isArray(res.body?.events)).toBe(true);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi mÃƒÂ¡Ã‚Â»Ã…Â¸ stream SSE khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/notifications/stream');

    expect(res.status).toBe(401);

  });

});



describeExternal('Ãƒâ€žÃ‚ÂÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi SQL Server', () => {

  beforeEach(() => {

    resetDb();

    sqlMock.__resetMock();

  });



  it('Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â©y thay Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n lÃƒÆ’Ã‚Âªn SQL Server khi tÃƒÂ¡Ã‚ÂºÃ‚Â¡o mÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi', async () => {

    const admin = request.agent(app);

    const loginRes = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const state = sqlMock.__getState();

    state.lastQuery = null;

    state.requests.length = 0;



    const createRes = await admin.post('/api/auth/accounts').send({

      username: 'sync.user',

      password: 'Abcdef12',

      role: 'staff',

    });

    expect(createRes.status).toBe(201);



    await waitAccountSync?.();



    const finalState = sqlMock.__getState();

    expect(finalState.lastQuery).toContain('INSERT INTO [dbo].[KPI_USER_ROLES]');

    expect(finalState.lastQuery).toContain("sync.user");

  });

});



describeExternal('AI assistant API', () => {

  beforeEach(() => {

    resetDb();

    sqlMock.__resetMock();

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/ai/profile');

    expect(res.status).toBe(401);

    expect(res.body?.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi khi tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ quyÃƒÂ¡Ã‚Â»Ã‚Ân aiAssistUse', async () => {

    const adminAgent = request.agent(app);

    const loginAdmin = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginAdmin.status).toBe(200);



    const createRes = await adminAgent.post('/api/auth/accounts').send({

      username: 'no.ai',

      password: 'Abcdef12',

      role: 'staff',

      permissions: { aiAssistUse: false },

    });

    expect(createRes.status).toBe(201);



    const viewer = request.agent(app);

    const loginViewer = await viewer.post('/api/auth/login').send({ username: 'no.ai', password: 'Abcdef12' });

    expect(loginViewer.status).toBe(200);



    const res = await viewer.get('/api/ai/profile');

    expect(res.status).toBe(403);

    expect(res.body?.ok).toBe(false);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i rÃƒÆ’Ã‚Âºt gÃƒÂ¡Ã‚Â»Ã‚Ân cho ngÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Âi dÃƒÆ’Ã‚Â¹ng cÃƒÆ’Ã‚Â³ quyÃƒÂ¡Ã‚Â»Ã‚Ân', async () => {

    const staff = request.agent(app);

    const loginRes = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    expect(loginRes.status).toBe(200);



    const res = await staff.get('/api/ai/profile');

    expect(res.status).toBe(200);

    expect(res.body?.ok).toBe(true);

    const profile = res.body?.profile;

    expect(profile).toBeTruthy();

    expect(profile.enabled).toBe(true);

    expect(Array.isArray(profile.providers)).toBe(true);

    if (profile.providers.length > 0 && profile.defaultProvider) {

      const found = profile.providers.find((provider) => provider.id === profile.defaultProvider);

      expect(found).toBeTruthy();

      expect(found).not.toHaveProperty('endpoint');

      expect(found).not.toHaveProperty('apiKeyEnv');

    }

  });



  it('tÃƒÂ¡Ã‚ÂºÃ‚Â¡o snapshot KPI vÃƒÆ’Ã‚Â  trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â cÃƒÂ¡Ã‚ÂºÃ‚Â¥u trÃƒÆ’Ã‚Âºc tÃƒÆ’Ã‚Â³m tÃƒÂ¡Ã‚ÂºÃ‚Â¯t', async () => {

    const admin = request.agent(app);

    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(adminLogin.status).toBe(200);



    const configRes = await admin.put('/api/import/ecus/config').send({

      config: {

        batchSize: 0,

        connection: {

          server: 'MRHOC\\ECUSSQL2008',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '123456',

        },

      },

    });

    expect(configRes.status).toBe(200);



    const staff = request.agent(app);

    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    expect(staffLogin.status).toBe(200);



    sqlMock.__setMockResult([

      {

        So_tk: '100000000000',

        Ngay_dang_ky: '2025-08-01',

        MaSoThue: '0100109106',

        Ten_doanh_nghiep: 'CÃƒÆ’Ã‚Â´ng ty A',

        Loai_hinh: 'A11',

        nhan_vien: 'NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n VÃƒâ€žÃ†â€™n A',

        team: 'TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ 1',

        so_luong_mh: 5,

        ma_gp: 'ZB03',

      },

      {

        So_tk: '200000000000',

        Ngay_dang_ky: '2025-08-01',

        MaSoThue: '0100109107',

        Ten_doanh_nghiep: 'CÃƒÆ’Ã‚Â´ng ty B',

        Loai_hinh: 'B11',

        nhan_vien: 'NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n VÃƒâ€žÃ†â€™n B',

        team: 'TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ 2',

        so_luong_mh: 3,

        ma_gp: '',

      },

    ]);



    const res = await staff.get('/api/ai/data/snapshot').query({ from: '2025-08-01', to: '2025-08-02' });

    expect(res.status).toBe(200);

    expect(res.body?.ok).toBe(true);

    expect(res.body?.cached).toBe(false);

    const snapshot = res.body?.snapshot;

    expect(snapshot).toBeTruthy();

    expect(snapshot.summary?.declarations).toBe(2);

    expect(snapshot.summary?.licenseSamples).toBeInstanceOf(Array);

    expect(Array.isArray(snapshot.topStaff)).toBe(true);

    expect(Array.isArray(snapshot.topTeams)).toBe(true);

    expect(Array.isArray(snapshot.trends?.monthly)).toBe(true);

    expect(Array.isArray(snapshot.rawDeclarations)).toBe(true);

    expect(snapshot.filters?.includeTaxCodes).toEqual([]);

    expect(snapshot.source?.server).toBe('MRHOC\\ECUSSQL2008');

  });



  it('tÃƒÆ’Ã‚Â¡i sÃƒÂ¡Ã‚Â»Ã‚Â­ dÃƒÂ¡Ã‚Â»Ã‚Â¥ng cache snapshot khi gÃƒÂ¡Ã‚Â»Ã‚Âi cÃƒÆ’Ã‚Â¹ng tham sÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ', async () => {

    const admin = request.agent(app);

    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(adminLogin.status).toBe(200);



    await admin.put('/api/import/ecus/config').send({

      config: {

        batchSize: 0,

        connection: {

          server: 'MRHOC\\ECUSSQL2008',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '123456',

        },

      },

    });



    const staff = request.agent(app);

    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    expect(staffLogin.status).toBe(200);



    sqlMock.__setMockResult([

      {

        So_tk: '100000000000',

        Ngay_dang_ky: '2025-08-01',

        MaSoThue: '0100109106',

        Ten_doanh_nghiep: 'CÃƒÆ’Ã‚Â´ng ty A',

        Loai_hinh: 'A11',

        nhan_vien: 'NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n VÃƒâ€žÃ†â€™n A',

        team: 'TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ 1',

        so_luong_mh: 4,

      },

    ]);



    const firstRes = await staff.get('/api/ai/data/snapshot').query({ from: '2025-08-01', to: '2025-08-02' });

    expect(firstRes.status).toBe(200);

    expect(firstRes.body?.cached).toBe(false);

    const firstRequests = sqlMock.__getState().requests.length;

    expect(firstRequests).toBeGreaterThan(0);



    sqlMock.__setMockResult([]);



    const secondRes = await staff.get('/api/ai/data/snapshot').query({ from: '2025-08-01', to: '2025-08-02' });

    expect(secondRes.status).toBe(200);

    expect(secondRes.body?.cached).toBe(true);

    expect(sqlMock.__getState().requests.length).toBe(firstRequests);

    expect(secondRes.body?.snapshot?.summary?.declarations).toBe(1);

  });



  it('chÃƒÂ¡Ã‚ÂºÃ‚Â¡y insight AI vÃƒÆ’Ã‚Â  cho phÃƒÆ’Ã‚Â©p phÃƒÂ¡Ã‚ÂºÃ‚Â£n hÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“i kÃƒÂ¡Ã‚ÂºÃ‚Â¿t quÃƒÂ¡Ã‚ÂºÃ‚Â£', async () => {

    const admin = request.agent(app);

    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(adminLogin.status).toBe(200);



    const configRes = await admin.put('/api/import/ecus/config').send({

      config: {

        connection: {

          server: 'MRHOC\\ECUSSQL2008',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '123456',

        },

      },

    });

    expect(configRes.status).toBe(200);



    const staff = request.agent(app);

    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    expect(staffLogin.status).toBe(200);



    const today = new Date();

    const todayIso = today.toISOString().slice(0, 10);

    const yesterdayIso = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);



    sqlMock.__setMockResult([

      {

        So_tk: '100000000000',

        Ngay_dang_ky: todayIso,

        MaSoThue: '0100109106',

        Ten_doanh_nghiep: 'CÃƒÆ’Ã‚Â´ng ty A',

        Loai_hinh: 'A11',

        nhan_vien: 'NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n VÃƒâ€žÃ†â€™n A',

        team: 'TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ 1',

        so_luong_mh: 5,

        ma_gp: 'GP01',

      },

      {

        So_tk: '200000000000',

        Ngay_dang_ky: yesterdayIso,

        MaSoThue: '0100109107',

        Ten_doanh_nghiep: 'CÃƒÆ’Ã‚Â´ng ty B',

        Loai_hinh: 'B11',

        nhan_vien: 'NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n VÃƒâ€žÃ†â€™n B',

        team: 'TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ 2',

        so_luong_mh: 3,

        ma_gp: 'GP02',

      },

    ]);



    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {

      if (typeof url === 'string' && url.includes('/api/chat')) {

        return {

          ok: true,

          status: 200,

          json: async () => ({

            message: { content: 'BÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o KPI thÃƒÂ¡Ã‚Â»Ã‚Â­ nghiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡m: hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u suÃƒÂ¡Ã‚ÂºÃ‚Â¥t tÃƒâ€žÃ†â€™ng.' },

            prompt_eval_count: 16,

            eval_count: 8,

          }),

          text: async () => 'ok',

        };

      }

      return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => 'ok' };

    });



    try {

      const runRes = await admin.post('/api/ai/insights/run').send({});

      expect(runRes.status).toBe(200);

      expect(runRes.body?.ok).toBe(true);

      expect(runRes.body?.result?.insight?.insightId ?? '').toMatch(/^ins-/);

      expect(runRes.body?.result?.insight?.feedback?.helpful ?? 0).toBe(0);



      const listRes = await staff.get('/api/ai/insights');

      expect(listRes.status).toBe(200);

      expect(listRes.body?.ok).toBe(true);

      expect(Array.isArray(listRes.body?.insights)).toBe(true);

      expect(listRes.body.insights.length).toBeGreaterThan(0);

      const insightId = listRes.body.insights[0]?.insightId;

      expect(typeof insightId).toBe('string');

      expect(listRes.body.insights[0]?.feedback?.helpful ?? 0).toBe(0);

      expect(listRes.body?.meta?.settings?.notifyOnAnomaly).toBe(false);

      const historyList = listRes.body?.meta?.history?.entries || [];

      expect(Array.isArray(historyList)).toBe(true);

      expect(historyList.length).toBeGreaterThan(0);

      const historyEntryId = historyList[0]?.id;

      expect(typeof historyEntryId).toBe('string');



      const historyRes = await staff.get('/api/ai/data/snapshot/history');

      expect(historyRes.status).toBe(200);

      expect(Array.isArray(historyRes.body?.entries)).toBe(true);

      expect(historyRes.body.entries.length).toBeGreaterThan(0);



      const singleHistoryRes = await staff.get(`/api/ai/data/snapshot/history/${historyEntryId}`);

      expect(singleHistoryRes.status).toBe(200);

      expect(singleHistoryRes.body?.entry?.id).toBe(historyEntryId);



      const feedbackRes = await staff.post('/api/ai/insights/feedback').send({

        insightId,

        helpful: true,

      });

      expect(feedbackRes.status).toBe(200);

      expect(feedbackRes.body?.ok).toBe(true);

      expect(feedbackRes.body?.totals?.helpful).toBe(1);



      const refreshed = await staff.get('/api/ai/insights');

      expect(refreshed.status).toBe(200);

      expect(refreshed.body?.insights?.[0]?.feedback?.helpful).toBe(1);

      expect(refreshed.body?.insights?.[0]?.feedback?.viewer?.helpful).toBe(true);



      const toggleRes = await admin

        .put('/api/ai/insights/settings')

        .send({ settings: { notifyOnAnomaly: true } });

      expect(toggleRes.status).toBe(200);

      expect(toggleRes.body?.settings?.notifyOnAnomaly).toBe(true);



      const afterToggle = await admin.get('/api/ai/insights');

      expect(afterToggle.status).toBe(200);

      expect(afterToggle.body?.meta?.settings?.notifyOnAnomaly).toBe(true);

    } finally {

      fetchSpy.mockRestore();

    }

  });



  it('cho phÃƒÆ’Ã‚Â©p cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh nhÃƒÆ’Ã‚Â  cung cÃƒÂ¡Ã‚ÂºÃ‚Â¥p vÃƒÆ’Ã‚Â  trÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã‚Âi qua Ollama mock vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi cache', async () => {

    const admin = request.agent(app);

    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(adminLogin.status).toBe(200);



    const updateRes = await admin.put('/api/ai/config').send({

      config: {

        enabled: true,

        defaultProvider: 'ollama-local',

        fallbackProvider: null,

        providers: [

          { id: 'azure-openai', enabled: false },

          { id: 'google-ai-studio', enabled: false },

          {

            id: 'ollama-local',

            type: 'ollama',

            enabled: true,

            endpoint: 'http://ollama.test',

            model: 'llama3.1:8b',

          },

        ],

        caching: { enabled: true, ttlMinutes: 60, maxEntries: 10 },

      },

    });

    expect(updateRes.status).toBe(200);



    const staff = request.agent(app);

    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    expect(staffLogin.status).toBe(200);



    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {

      if (typeof url === 'string' && url.includes('ollama.test')) {

        return {

          ok: true,

          status: 200,

          json: async () => ({

            message: { content: 'TrÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã‚Âi thÃƒÂ¡Ã‚Â»Ã‚Â­ nghiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡m tÃƒÂ¡Ã‚Â»Ã‚Â« mÃƒÆ’Ã‚Â´ phÃƒÂ¡Ã‚Â»Ã‚Âng' },

            prompt_eval_count: 12,

            eval_count: 5,

          }),

          text: async () => 'ok',

        };

      }

      return {

        ok: true,

        status: 200,

        json: async () => ({ ok: true }),

        text: async () => 'ok',

      };

    });



    try {

      const payload = { prompt: 'Xin chÃƒÆ’Ã‚Â o trÃƒÂ¡Ã‚Â»Ã‚Â£ lÃƒÆ’Ã‚Â½', scope: 'test', providerId: 'ollama-local' };

      const first = await staff.post('/api/ai/chat').send(payload);

      expect(first.status).toBe(200);

      expect(first.body?.ok).toBe(true);

      expect(first.body.cached).toBe(false);

      expect(first.body.message).toContain('TrÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã‚Âi thÃƒÂ¡Ã‚Â»Ã‚Â­ nghiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡m');

      expect(fetchSpy).toHaveBeenCalledTimes(1);



      const second = await staff.post('/api/ai/chat').send(payload);

      expect(second.status).toBe(200);

      expect(second.body?.ok).toBe(true);

      expect(second.body.cached).toBe(true);

      expect(second.body.cacheKey).toBeTruthy();

      expect(fetchSpy).toHaveBeenCalledTimes(1);

    } finally {

      fetchSpy.mockRestore();

    }

  });



  it('cho phÃƒÆ’Ã‚Â©p kiÃƒÂ¡Ã‚Â»Ã†â€™m thÃƒÂ¡Ã‚Â»Ã‚Â­ Ollama cÃƒÂ¡Ã‚Â»Ã‚Â¥c bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ mÃƒÆ’Ã‚Â  khÃƒÆ’Ã‚Â´ng cÃƒÂ¡Ã‚ÂºÃ‚Â§n API key', async () => {

    const admin = request.agent(app);

    const loginRes = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const updateRes = await admin.put('/api/ai/config').send({

      config: {

        defaultProvider: 'ollama-local',

        fallbackProvider: 'azure-openai',

        providers: [

          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },

        ],

      },

    });

    expect(updateRes.status).toBe(200);



    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {

      if (typeof url === 'string' && url.includes('ollama.test')) {

        return {

          ok: true,

          status: 200,

          json: async () => ({

            message: { content: 'Pong tÃƒÂ¡Ã‚Â»Ã‚Â« kiÃƒÂ¡Ã‚Â»Ã†â€™m thÃƒÂ¡Ã‚Â»Ã‚Â­ Ollama' },

            prompt_eval_count: 10,

            eval_count: 4,

          }),

          text: async () => 'ok',

        };

      }

      return {

        ok: true,

        status: 200,

        json: async () => ({ ok: true }),

        text: async () => 'ok',

      };

    });



    try {

      const res = await admin.post('/api/ai/providers/test').send({

        provider: {

          id: 'ollama-local',

          type: 'ollama',

          endpoint: 'http://ollama.test',

          model: 'llama3.1:8b',

        },

        prompt: 'kiÃƒÂ¡Ã‚Â»Ã†â€™m thÃƒÂ¡Ã‚Â»Ã‚Â­ ollama nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢',

      });

      expect(res.status).toBe(200);

      expect(res.body?.ok).toBe(true);

      expect(res.body?.provider?.id).toContain('ollama-local');

      expect(res.body?.message).toContain('Pong');

      expect(fetchSpy).toHaveBeenCalledTimes(1);

    } finally {

      fetchSpy.mockRestore();

    }

  });



  it('ghi log lÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi kiÃƒÂ¡Ã‚Â»Ã†â€™m thÃƒÂ¡Ã‚Â»Ã‚Â­ Ollama thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i', async () => {

    const admin = request.agent(app);

    const loginRes = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const updateRes = await admin.put('/api/ai/config').send({

      config: {

        providers: [

          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },

        ],

      },

    });

    expect(updateRes.status).toBe(200);



    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {

      if (typeof url === 'string' && url.includes('ollama.test')) {

        return {

          ok: false,

          status: 503,

          text: async () => 'service unavailable',

        };

      }

      return {

        ok: true,

        status: 200,

        json: async () => ({ ok: true }),

        text: async () => 'ok',

      };

    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});



    try {

      const res = await admin.post('/api/ai/providers/test').send({

        provider: {

          id: 'ollama-local',

          type: 'ollama',

          endpoint: 'http://ollama.test',

          model: 'llama3.1:8b',

        },

        prompt: 'kiÃƒÂ¡Ã‚Â»Ã†â€™m thÃƒÂ¡Ã‚Â»Ã‚Â­ ollama thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i',

      });

      expect(res.status).toBe(400);

      expect(res.body?.ok).toBe(false);

      expect(res.body?.error).toContain('503');

      expect(errorSpy).toHaveBeenCalledWith(

        'Kiểm thử nhà cung cấp AI thất bại',

        expect.objectContaining({

          providerId: expect.stringContaining('ollama-local'),

          error: expect.stringContaining('503'),

        }),

      );

    } finally {

      fetchSpy.mockRestore();

      errorSpy.mockRestore();

    }

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â± Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ng thÃƒÂ¡Ã‚Â»Ã‚Â­ lÃƒÂ¡Ã‚ÂºÃ‚Â¡i khi gÃƒÂ¡Ã‚Â»Ã‚Âi Ollama lÃƒÂ¡Ã‚ÂºÃ‚Â§n Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â§u thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i', async () => {

    const admin = request.agent(app);

    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(adminLogin.status).toBe(200);



    const updateRes = await admin.put('/api/ai/config').send({

      config: {

        enabled: true,

        defaultProvider: 'ollama-local',

        providers: [

          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },

        ],

        caching: { enabled: true, ttlMinutes: 5, maxEntries: 5 },

      },

    });

    expect(updateRes.status).toBe(200);



    const staff = request.agent(app);

    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    expect(staffLogin.status).toBe(200);



    let attempts = 0;

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {

      if (typeof url === 'string' && url.includes('ollama.test')) {

        attempts += 1;

        if (attempts === 1) {

          throw new Error('ECONNREFUSED');

        }

        return {

          ok: true,

          status: 200,

          json: async () => ({

            message: { content: 'PhÃƒÂ¡Ã‚ÂºÃ‚Â£n hÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“i sau lÃƒÂ¡Ã‚ÂºÃ‚Â§n retry' },

            prompt_eval_count: 15,

            eval_count: 6,

          }),

          text: async () => 'ok',

        };

      }

      return {

        ok: true,

        status: 200,

        json: async () => ({ ok: true }),

        text: async () => 'ok',

      };

    });



    try {

      const res = await staff.post('/api/ai/chat').send({

        prompt: 'KiÃƒÂ¡Ã‚Â»Ã†â€™m tra retry Ollama',

        scope: 'retry',

        providerId: 'ollama-local',

      });

      expect(res.status).toBe(200);

      expect(res.body?.ok).toBe(true);

      expect(res.body?.message).toContain('retry');

      expect(attempts).toBe(2);

    } finally {

      fetchSpy.mockRestore();

    }

  });



  it('ping kÃƒÂ¡Ã‚ÂºÃ‚Â¿t nÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi AI thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi nhÃƒÆ’Ã‚Â  cung cÃƒÂ¡Ã‚ÂºÃ‚Â¥p mÃƒÂ¡Ã‚ÂºÃ‚Â·c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh', async () => {

    const admin = request.agent(app);

    const loginRes = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const updateRes = await admin.put('/api/ai/config').send({

      config: {

        defaultProvider: 'ollama-local',

        providers: [

          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },

        ],

      },

    });

    expect(updateRes.status).toBe(200);



    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {

      if (typeof url === 'string' && url.includes('ollama.test')) {

        return {

          ok: true,

          status: 200,

          json: async () => ({

            message: { content: 'Pong tÃƒÂ¡Ã‚Â»Ã‚Â« ping Ollama' },

            prompt_eval_count: 5,

            eval_count: 2,

          }),

          text: async () => 'ok',

        };

      }

      return {

        ok: true,

        status: 200,

        json: async () => ({ ok: true }),

        text: async () => 'ok',

      };

    });



    try {

      const res = await admin.post('/api/ai/providers/ping').send({ prompt: 'ping kiÃƒÂ¡Ã‚Â»Ã†â€™m tra' });

      expect(res.status).toBe(200);

      expect(res.body?.ok).toBe(true);

      expect(res.body?.provider?.id).toBe('ollama-local');

      expect(res.body?.message).toContain('Pong');

      expect(fetchSpy).toHaveBeenCalledTimes(1);

    } finally {

      fetchSpy.mockRestore();

    }

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi ping khÃƒÆ’Ã‚Â´ng tÃƒÆ’Ã‚Â¬m thÃƒÂ¡Ã‚ÂºÃ‚Â¥y nhÃƒÆ’Ã‚Â  cung cÃƒÂ¡Ã‚ÂºÃ‚Â¥p', async () => {

    const admin = request.agent(app);

    const loginRes = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const updateRes = await admin.put('/api/ai/config').send({

      config: {

        providers: [

          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },

        ],

      },

    });

    expect(updateRes.status).toBe(200);



    const res = await admin.post('/api/ai/providers/ping').send({ providerId: 'khong-ton-tai' });

    expect(res.status).toBe(404);

    expect(res.body?.ok).toBe(false);

    expect(res.body?.error).toContain('Chưa tìm thấy nhà cung cấp');

  });



  it('dÃƒÆ’Ã‚Â¹ng cache nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ cÃƒÂ¡Ã‚Â»Ã‚Â§a Ollama ngay cÃƒÂ¡Ã‚ÂºÃ‚Â£ khi cache chung tÃƒÂ¡Ã‚ÂºÃ‚Â¯t', async () => {

    const admin = request.agent(app);

    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(adminLogin.status).toBe(200);



    const updateRes = await admin.put('/api/ai/config').send({

      config: {

        enabled: true,

        defaultProvider: 'ollama-local',

        providers: [

          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },

        ],

        caching: { enabled: false },

      },

    });

    expect(updateRes.status).toBe(200);



    const staff = request.agent(app);

    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    expect(staffLogin.status).toBe(200);



    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {

      if (typeof url === 'string' && url.includes('ollama.test')) {

        return {

          ok: true,

          status: 200,

          json: async () => ({

            message: { content: 'NÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i dung cache nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢' },

            prompt_eval_count: 8,

            eval_count: 3,

          }),

          text: async () => 'ok',

        };

      }

      return {

        ok: true,

        status: 200,

        json: async () => ({ ok: true }),

        text: async () => 'ok',

      };

    });



    const payload = { prompt: 'Cache nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ Ollama', scope: 'local-cache', providerId: 'ollama-local' };



    try {

      const first = await staff.post('/api/ai/chat').send(payload);

      expect(first.status).toBe(200);

      expect(first.body?.ok).toBe(true);

      expect(first.body.cached).toBe(false);

      expect(first.body.message).toContain('NÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i dung cache nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢');

      expect(fetchSpy).toHaveBeenCalledTimes(1);



      const second = await staff.post('/api/ai/chat').send(payload);

      expect(second.status).toBe(200);

      expect(second.body?.ok).toBe(true);

      expect(second.body.cached).toBe(false);

      expect(second.body.message).toContain('NÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i dung cache nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢');

      expect(fetchSpy).toHaveBeenCalledTimes(1);

    } finally {

      fetchSpy.mockRestore();

    }

  });

});



afterAll(() => {

  stopServer?.();

});



beforeEach(async () => {

  if (typeof waitAccountSync === 'function') {

    await waitAccountSync();

  }

  resetDb();

  sqlMock.__resetMock();

  resetSqlMonitor();

  clearReportCache();

  excelMock.__resetWorkbookCreateCount?.();

});



describe('Data health summary API', () => {

  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i sao lÃƒâ€ Ã‚Â°u vÃƒÆ’Ã‚Â  cÃƒÂ¡Ã‚ÂºÃ‚Â£nh bÃƒÆ’Ã‚Â¡o dung lÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£ng', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const logs = [

      {

        ts: '2024-05-12T02:00:00.000Z',

        actor: 'system',

        action: 'db.backup',

        detail: 'Sao lÃƒâ€ Ã‚Â°u Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh kÃƒÂ¡Ã‚Â»Ã‚Â³',

        meta: { status: 'success', file: 'C:/backups/storage-20240512.sqlite', bytes: 4096 },

      },

      {

        ts: '2024-05-11T02:00:00.000Z',

        actor: 'system',

        action: 'db.backup',

        detail: 'Sao lÃƒâ€ Ã‚Â°u thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i',

        meta: { status: 'failure', reason: 'memory_db' },

      },

    ];

    getDb()

      .prepare('INSERT OR REPLACE INTO kv_store(key, value) VALUES(?, ?)')

      .run('audit_logs_v1', JSON.stringify(logs));

    getDb()

      .prepare('INSERT OR REPLACE INTO kv_store(key, value) VALUES(?, ?)')

      .run('db_backup_config_v1', JSON.stringify({ cron: '0 1 * * *', retentionCopies: 5 }));



    const res = await adminAgent.get('/api/data-health/summary');

    expect(res.status).toBe(200);

    expect(res.body?.ok).toBe(true);



    const storage = res.body.summary?.storage;

    expect(storage).toBeTruthy();

    expect(storage.backup?.health?.severity).toBeTruthy();

    expect(Array.isArray(storage.backup?.recent)).toBe(true);

    expect(storage.database?.mode).toBe('memory');

    expect(Array.isArray(storage.health?.issues)).toBe(true);

    expect(storage.health.issues.length).toBeGreaterThan(0);



    expect(res.body.summary?.sqlServer).toHaveProperty('health');

  });

});



describe('Backup summary API', () => {

  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/admin/backups/summary');

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi khi tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ quyÃƒÂ¡Ã‚Â»Ã‚Ân audit', async () => {

    const staffAgent = request.agent(app);

    const loginRes = await staffAgent

      .post('/api/auth/login')

      .send({ username: 'nhanvien', password: '123456' });

    expect(loginRes.status).toBe(200);



    const res = await staffAgent.get('/api/admin/backups/summary');

    expect(res.status).toBe(403);

    expect(res.body.ok).toBe(false);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sao lÃƒâ€ Ã‚Â°u vÃƒÆ’Ã‚Â  nhÃƒÂ¡Ã‚ÂºÃ‚Â­t kÃƒÆ’Ã‚Â½ gÃƒÂ¡Ã‚ÂºÃ‚Â§n nhÃƒÂ¡Ã‚ÂºÃ‚Â¥t cho quÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const logs = [

      {

        ts: '2024-05-01T03:00:00.000Z',

        actor: 'system',

        action: 'db.backup',

        detail: 'Sao lÃƒâ€ Ã‚Â°u CSDL (scheduled)',

        meta: { status: 'success', reason: 'scheduled', bytes: 2048 },

      },

      {

        ts: '2024-05-01T02:00:00.000Z',

        actor: 'system',

        action: 'db.backup',

        detail: 'Sao lÃƒâ€ Ã‚Â°u CSDL thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i (memory_db)',

        meta: { status: 'failure', reason: 'memory_db' },

      },

      {

        ts: '2024-04-30T23:00:00.000Z',

        actor: 'tester',

        action: 'other.action',

        detail: 'ignored',

      },

    ];

    const db = getDb();

    db.prepare(

      'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'

    ).run('audit_logs_v1', JSON.stringify(logs));



    const res = await adminAgent.get('/api/admin/backups/summary');

    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    const summary = res.body.summary;

    expect(summary.schedule).toMatchObject({

      cron: '0 3 * * *',

      cronDescription: expect.stringContaining('03:00'),

      active: false,

      retentionCopies: 14,

    });

    expect(Array.isArray(summary.schedule.reasons)).toBe(true);

    expect(summary.schedule.reasons.length).toBeGreaterThan(0);

    expect(summary.lastSuccess).toMatchObject({

      actor: 'system',

      meta: expect.objectContaining({ status: 'success', bytes: 2048 }),

    });

    expect(summary.lastFailure).toMatchObject({

      meta: expect.objectContaining({ status: 'failure', reason: 'memory_db' }),

    });

    expect(Array.isArray(summary.recent)).toBe(true);

    expect(summary.recent[0]).toMatchObject({ action: 'db.backup' });

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t cron sao lÃƒâ€ Ã‚Â°u khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app)

      .post('/api/admin/backups/schedule')

      .send({ cron: '*/15 * * * *' });

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t cron sao lÃƒâ€ Ã‚Â°u vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ quyÃƒÂ¡Ã‚Â»Ã‚Ân', async () => {

    const staffAgent = request.agent(app);

    const loginRes = await staffAgent

      .post('/api/auth/login')

      .send({ username: 'nhanvien', password: '123456' });

    expect(loginRes.status).toBe(200);



    const res = await staffAgent.post('/api/admin/backups/schedule').send({ cron: '*/15 * * * *' });

    expect(res.status).toBe(403);

    expect(res.body.ok).toBe(false);

  });



  it('cho phÃƒÆ’Ã‚Â©p quÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t biÃƒÂ¡Ã‚Â»Ã†â€™u thÃƒÂ¡Ã‚Â»Ã‚Â©c cron hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent

      .post('/api/admin/backups/schedule')

      .send({ cron: '*/30 * * * *', retentionCopies: 5 });

    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    expect(res.body.config).toMatchObject({ cron: '*/30 * * * *', retentionCopies: 5 });

    expect(typeof res.body.config.directory).toBe('string');

    expect(res.body.config.directoryRaw).toBe(res.body.config.directory);

    expect(res.body.summary.schedule).toMatchObject({

      cron: '*/30 * * * *',

      cronDescription: 'Mỗi 30 phút',

      retentionCopies: 5,

      directory: res.body.config.directory,

    });

    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('audit_logs_v1');

    const logs = JSON.parse(row?.value || '[]');

    expect(logs[0]).toMatchObject({

      action: 'db.backup_schedule.update',

      meta: expect.objectContaining({ cron: '*/30 * * * *', retentionCopies: 5, directory: res.body.config.directory }),

    });

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi retention khÃƒÆ’Ã‚Â´ng hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent

      .post('/api/admin/backups/schedule')

      .send({ cron: '*/15 * * * *', retentionCopies: -1 });

    expect(res.status).toBe(400);

    expect(res.body).toMatchObject({ ok: false, field: 'retentionCopies' });

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi thÃƒâ€ Ã‚Â° mÃƒÂ¡Ã‚Â»Ã‚Â¥c sao lÃƒâ€ Ã‚Â°u khÃƒÆ’Ã‚Â´ng hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent

      .post('/api/admin/backups/schedule')

      .send({ cron: '*/15 * * * *', directory: ':memory:' });

    expect(res.status).toBe(400);

    expect(res.body).toMatchObject({ ok: false, field: 'directory' });

  });



  it('cho phÃƒÆ’Ã‚Â©p cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t thÃƒâ€ Ã‚Â° mÃƒÂ¡Ã‚Â»Ã‚Â¥c sao lÃƒâ€ Ã‚Â°u tÃƒÆ’Ã‚Â¹y chÃƒÂ¡Ã‚Â»Ã¢â‚¬Â°nh', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent

      .post('/api/admin/backups/schedule')

      .send({ cron: '0 2 * * *', directory: 'custom-backups' });

    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    const expectedDir = path.resolve(__dirname, '../server/custom-backups');

    expect(res.body.config).toMatchObject({

      cron: '0 2 * * *',

      retentionCopies: res.body.config.retentionCopies,

      directory: expectedDir,

      directoryRaw: 'custom-backups',

    });

    expect(res.body.summary.schedule.directory).toBe(expectedDir);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t cron khÃƒÆ’Ã‚Â´ng hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent.post('/api/admin/backups/schedule').send({ cron: 'not-a-cron' });

    expect(res.status).toBe(400);

    expect(res.body.ok).toBe(false);

  });

});



describe('Backup manual API', () => {

  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi danh sÃƒÆ’Ã‚Â¡ch file sao lÃƒâ€ Ã‚Â°u khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/admin/backups/files');

    expect(res.status).toBe(401);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â danh sÃƒÆ’Ã‚Â¡ch rÃƒÂ¡Ã‚Â»Ã¢â‚¬â€ng khi chÃƒâ€ Ã‚Â°a cÃƒÆ’Ã‚Â³ bÃƒÂ¡Ã‚ÂºÃ‚Â£n sao lÃƒâ€ Ã‚Â°u', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent.get('/api/admin/backups/files');

    expect(res.status).toBe(200);

    expect(res.body?.ok).toBe(true);

    expect(Array.isArray(res.body.files)).toBe(true);

    for (const file of res.body.files) {

      expect(typeof file.filename).toBe('string');

      expect(typeof file.bytes === 'number' || file.bytes === undefined).toBe(true);

    }

  });



  it('khÃƒÆ’Ã‚Â´ng cho phÃƒÆ’Ã‚Â©p sao lÃƒâ€ Ã‚Â°u thÃƒÂ¡Ã‚Â»Ã‚Â§ cÃƒÆ’Ã‚Â´ng khi DB chÃƒÂ¡Ã‚ÂºÃ‚Â¡y memory', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent.post('/api/admin/backups/run').send({ note: 'manual-test' });

    expect(res.status).toBe(400);

    expect(res.body).toMatchObject({ ok: false, reason: 'memory_db' });

  });



  it('yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u chÃƒÂ¡Ã‚Â»Ã‚Ân file khi khÃƒÆ’Ã‚Â´i phÃƒÂ¡Ã‚Â»Ã‚Â¥c', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent.post('/api/admin/backups/restore').send({ note: 'restore-test' });

    expect(res.status).toBe(400);

    expect(res.body).toMatchObject({ ok: false, reason: 'missing_filename' });

  });

});



describe('Audit export API', () => {

  it('yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc khi tÃƒÂ¡Ã‚ÂºÃ‚Â£i CSV', async () => {

    const res = await request(app).get('/api/admin/audit/export');

    expect(res.status).toBe(401);

  });



  it('cho phÃƒÆ’Ã‚Â©p quÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn tÃƒÂ¡Ã‚ÂºÃ‚Â£i CSV theo khoÃƒÂ¡Ã‚ÂºÃ‚Â£ng ngÃƒÆ’Ã‚Â y', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const logs = [

      {

        ts: '2024-05-10T05:00:00.000Z',

        actor: 'admin',

        action: 'db.backup',

        detail: 'Sao lÃƒâ€ Ã‚Â°u thÃƒÂ¡Ã‚Â»Ã‚Â­ nghiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡m',

        result: 'success',

        category: 'db',

        note: 'manual snapshot',

        meta: { status: 'success', reason: 'manual-ui' },

      },

      {

        ts: '2024-04-09T02:00:00.000Z',

        actor: 'system',

        action: 'audit.clear',

        detail: 'XÃƒÆ’Ã‚Â³a nhÃƒÂ¡Ã‚ÂºÃ‚Â­t kÃƒÆ’Ã‚Â½',

        result: 'success',

        category: 'audit',

      },

    ];

    getDb()

      .prepare('INSERT OR REPLACE INTO kv_store(key, value) VALUES(?, ?)')

      .run('audit_logs_v1', JSON.stringify(logs));



    const res = await adminAgent.get('/api/admin/audit/export');

    expect(res.status).toBe(200);

    expect(res.headers['content-type']).toContain('text/csv');

    const lines = res.text.split(/\r?\n/).filter(Boolean);

    expect(lines.length).toBeGreaterThanOrEqual(1);

    expect(res.text).toContain('Thời gian');

  });

});



describeExternal('ECUS sync API', () => {

  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi xem cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/import/ecus/config');

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh mÃƒÂ¡Ã‚ÂºÃ‚Â·c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh cho quÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const res = await adminAgent.get('/api/import/ecus/config');

    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({

      ok: true,

      config: expect.objectContaining({

        enabled: false,

        schedule: '0 3 * * *',

        scheduleMode: 'daily',

        scheduleValue: 1,

        scheduleTime: '03:00',

        connection: expect.objectContaining({

          server: 'Server',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '',

        }),

      }),

    });

    expect(typeof res.body.config.connection.hasPassword).toBe('boolean');

    expect(res.body.config.schedulePreset).toEqual(expect.objectContaining({

      mode: 'daily',

      value: 1,

      time: '03:00',

      cron: '0 3 * * *',

    }));

    expect(typeof res.body.config.scheduleDescription).toBe('string');

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).put('/api/import/ecus/config').send({ config: {} });

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh khi tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng phÃƒÂ¡Ã‚ÂºÃ‚Â£i admin', async () => {

    const staffAgent = request.agent(app);

    const loginRes = await staffAgent

      .post('/api/auth/login')

      .send({ username: 'nhanvien', password: '123456' });

    expect(loginRes.status).toBe(200);



    const res = await staffAgent.put('/api/import/ecus/config').send({ config: {} });

    expect(res.status).toBe(403);

    expect(res.body.ok).toBe(false);

  });



  it('chuÃƒÂ¡Ã‚ÂºÃ‚Â©n hÃƒÆ’Ã‚Â³a truy vÃƒÂ¡Ã‚ÂºÃ‚Â¥n dÃƒÆ’Ã‚Â¹ng COALESCE ngÃƒÆ’Ã‚Â y Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng kÃƒÆ’Ã‚Â½ Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ trÃƒÆ’Ã‚Â¡nh timeout', async () => {

    resetDb();

    sqlMock.__resetMock();

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const slowQuery = [

      'SELECT CAST(lp.So_TK AS nvarchar(50)) AS so_tk',

      'FROM dbo.DTBLP AS lp',

      'LEFT JOIN dbo.DTOKHAIMD AS md ON md._DToKhaiMDID = lp._DTokhaiMDID',

      'WHERE COALESCE(lp.Ngay_DK, md.NGAY_DK) >= @from',

      '  AND COALESCE(lp.Ngay_DK, md.NGAY_DK) < DATEADD(DAY, 1, @to)',

      '  AND 1 = 1',

      'ORDER BY lp.Ngay_DK',

    ].join('\n');



    const saveRes = await adminAgent.put('/api/import/ecus/config').send({

      config: { query: slowQuery },

    });

    expect(saveRes.status).toBe(200);

    const optimizedQuery = saveRes.body?.config?.query || '';

    expect(optimizedQuery).toBeTypeOf('string');

    expect(optimizedQuery).not.toMatch(/COALESCE\s*\(\s*lp\.Ngay_DK/iu);

    expect(optimizedQuery).toMatch(/lp\.Ngay_DK >= @from/);

    expect(optimizedQuery).toMatch(/lp\.Ngay_DK < DATEADD\(DAY, 1, @to\)/);

    expect(optimizedQuery).not.toMatch(/md\.NGAY_DK\s*>=/iu);

    expect(optimizedQuery).toMatch(/AND 1 = 1/);



    const getRes = await adminAgent.get('/api/import/ecus/config');

    expect(getRes.status).toBe(200);

    expect(getRes.body?.config?.query).toBe(optimizedQuery);

  });



  it('thay thÃƒÂ¡Ã‚ÂºÃ‚Â¿ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã‚Âu kiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n COALESCE khi xem trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u ECUS', async () => {

    resetDb();

    sqlMock.__resetMock();

    const slowQuery = [

      'SELECT CAST(lp.So_TK AS nvarchar(50)) AS so_tk',

      'FROM dbo.DTBLP AS lp',

      'LEFT JOIN dbo.DTOKHAIMD AS md ON md._DToKhaiMDID = lp._DTokhaiMDID',

      'WHERE COALESCE(lp.Ngay_DK, md.NGAY_DK) >= @from',

      '  AND COALESCE(lp.Ngay_DK, md.NGAY_DK) < DATEADD(DAY, 1, @to)',

      'ORDER BY lp.Ngay_DK',

    ].join('\n');



    const configPayload = {

      enabled: true,

      batchSize: 0,

      query: slowQuery,

      connection: {

        server: 'Server',

        database: 'ECUS5VNACCS',

        user: 'sa',

        password: '',

      },

    };



    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const saveRes = await adminAgent

      .put('/api/import/ecus/config')

      .send({ config: configPayload });

    expect(saveRes.status).toBe(200);



    sqlMock.__setMockResult([]);



    const previewRes = await adminAgent

      .post('/api/import/ecus/preview')

      .send({ from: '2025-10-01', to: '2025-10-02' });



    const configRes = await adminAgent.get('/api/import/ecus/config');

    const serverQuery = configRes.body?.config?.query || '';

    expect(serverQuery).toBeTypeOf('string');

    expect(serverQuery).not.toMatch(/COALESCE\s*\(\s*lp\.Ngay_DK/iu);

    expect(serverQuery).toMatch(/lp\.Ngay_DK >= @from/);

    expect(serverQuery).toMatch(/lp\.Ngay_DK < DATEADD\(DAY, 1, @to\)/);

    expect(serverQuery).not.toMatch(/md\.NGAY_DK\s*>=/iu);



    expect(previewRes.status).toBe(200);

    expect(previewRes.body?.ok).toBe(true);

    const state = sqlMock.__getState();

    expect(state.lastQuery).toBeTypeOf('string');

    expect(state.lastQuery).not.toMatch(/COALESCE\s*\(\s*lp\.Ngay_DK/iu);

    expect(state.lastQuery).toMatch(/lp\.Ngay_DK >= @from/);

    expect(state.lastQuery).toMatch(/lp\.Ngay_DK < DATEADD\(DAY, 1, @to\)/);

    expect(state.lastQuery).not.toMatch(/md\.NGAY_DK\s*>=/iu);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i chÃƒâ€ Ã‚Â°a cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh cho quÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn khi thiÃƒÂ¡Ã‚ÂºÃ‚Â¿u thÃƒÆ’Ã‚Â´ng tin SQL', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const res = await adminAgent.get('/api/import/ecus/status');

    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    expect(res.body.backend).toMatchObject({ ok: true, state: 'online' });

    expect(res.body.database).toMatchObject({ ok: true, state: 'ready' });

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi xem trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i ECUS khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/import/ecus/status');

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi chÃƒÂ¡Ã‚ÂºÃ‚Â¡y Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ khi khÃƒÆ’Ã‚Â´ng Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app)

      .post('/api/import/ecus/run')

      .send({ from: '2025-01-01', to: '2025-01-02' });

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi chÃƒÂ¡Ã‚ÂºÃ‚Â¡y Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ khi tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng phÃƒÂ¡Ã‚ÂºÃ‚Â£i admin', async () => {

    const staffAgent = request.agent(app);

    const loginRes = await staffAgent

      .post('/api/auth/login')

      .send({ username: 'nhanvien', password: '123456' });

    expect(loginRes.status).toBe(200);



    const res = await staffAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-01-01', to: '2025-01-02' });

    expect(res.status).toBe(403);

    expect(res.body.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi xem trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u ECUS khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app)

      .post('/api/import/ecus/preview')

      .send({ from: '2025-01-01', to: '2025-01-02' });

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi xem trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u ECUS khi tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng phÃƒÂ¡Ã‚ÂºÃ‚Â£i admin', async () => {

    const staffAgent = request.agent(app);

    const loginRes = await staffAgent

      .post('/api/auth/login')

      .send({ username: 'nhanvien', password: '123456' });

    expect(loginRes.status).toBe(200);



    const res = await staffAgent

      .post('/api/import/ecus/preview')

      .send({ from: '2025-01-01', to: '2025-01-02' });

    expect(res.status).toBe(403);

    expect(res.body.ok).toBe(false);

  });



  it('xem trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u phÃƒÆ’Ã‚Â¢n loÃƒÂ¡Ã‚ÂºÃ‚Â¡i tÃƒÂ¡Ã‚Â»Ã‚Â khai mÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi vÃƒÆ’Ã‚Â  Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ tÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent.put('/api/import/ecus/config').send({

      config: {

        enabled: true,

        connection: {

          server: 'MRHOC\\ECUSSQL2008',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '123456',

        },

      },

    });



    const existingRow = [{

      so_tk: '999999999999',

      nhanh: '',

      date: '2025-08-01',

      mst: '1234567890',

      cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY ABC',

    }];

    expect((await adminAgent.put('/api/storage/decl_rows_v1').send({ value: existingRow })).status).toBe(200);



    sqlMock.__setMockResult([

      {

        So_tk: '999999999999',

        Ngay_dang_ky: '2025-08-01',

        MaSoThue: '1234567890',

        Ten_doanh_nghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY ABC',

        Loai_hinh: 'A11',

      },

      {

        So_tk: '888888888888',

        Ngay_dang_ky: '2025-08-01',

        MaSoThue: '5555555555',

        Ten_doanh_nghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY MÃƒÂ¡Ã‚Â»Ã…Â¡I',

        Loai_hinh: 'E11',

        ts_xnk_ma_bt: '<TS_XNK_MA_BT>B05</TS_XNK_MA_BT>',

      },

    ]);



    const res = await adminAgent

      .post('/api/import/ecus/preview')

      .send({ from: '2025-08-01', to: '2025-08-02' });



    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    expect(Array.isArray(res.body.preview?.rows)).toBe(true);

    const statuses = res.body.preview.rows.map((row) => row.status);

    expect(statuses).toContain('existing');

    expect(statuses).toContain('new');

    const newRow = res.body.preview.rows.find((row) => row.status === 'new');

    expect(newRow?.co_line_count).toBe(1);

  });



  it('xem trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u qua v4 ECUS bridge contract vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi bearer token', async () => {

    resetDb();

    sqlMock.__resetMock();

    const previousBridgeToken = process.env.ECUS_BRIDGE_TOKEN;

    process.env.ECUS_BRIDGE_TOKEN = 'bridge-secret';

    try {

      const adminAgent = request.agent(app);

      const loginRes = await adminAgent

        .post('/api/auth/login')

        .send({ username: 'admin', password: 'admin123' });

      expect(loginRes.status).toBe(200);



      const existingRow = [{

        so_tk: 'TK002',

        nhanh: '',

        date: '2025-08-01',

        mst: '1234567890',

        cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY ABC',

      }];

      getDb()

        .prepare('DELETE FROM kv_store WHERE key = ?')

        .run('decl_rows_v1');

      expect((await adminAgent.put('/api/storage/decl_rows_v1').send({ value: existingRow })).status).toBe(200);



      const res = await request(app)

        .post('/api/v4/declarations/imports/ecus-preview')

        .set('Authorization', 'Bearer bridge-secret')

        .send({

          rawRows: [

            {

              So_tk: 'TK002',

              Ngay_dang_ky: '2025-08-01',

              MaSoThue: '1234567890',

              Ten_doanh_nghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY ABC',

              Loai_hinh: 'A11',

            },

            {

              So_tk: 'TK004',

              Ngay_dang_ky: '2025-08-01',

              MaSoThue: '5555555555',

              Ten_doanh_nghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY MÃƒÂ¡Ã‚Â»Ã…Â¡I',

              Loai_hinh: 'E11',

            },

          ],

          range: { from: '2025-08-01', to: '2025-08-02' },

        });



      expect(res.status).toBe(200);

      expect(res.body?.ok).toBe(true);

      expect(Array.isArray(res.body?.preview?.rows)).toBe(true);

      expect(res.body.preview.rows.map((row) => row.status)).toEqual(expect.arrayContaining(['existing', 'new']));

    } finally {

      if (previousBridgeToken === undefined) {

        delete process.env.ECUS_BRIDGE_TOKEN;

      } else {

        process.env.ECUS_BRIDGE_TOKEN = previousBridgeToken;

      }

    }

  });



  it('commit dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u qua v4 ECUS bridge contract vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi bearer token', async () => {

    resetDb();

    sqlMock.__resetMock();

    const previousBridgeToken = process.env.ECUS_BRIDGE_TOKEN;

    process.env.ECUS_BRIDGE_TOKEN = 'bridge-secret';

    try {

      const adminAgent = request.agent(app);

      const loginRes = await adminAgent

        .post('/api/auth/login')

        .send({ username: 'admin', password: 'admin123' });

      expect(loginRes.status).toBe(200);



      const existingRow = [{

        so_tk: 'TK002',

        nhanh: '',

        date: '2025-08-01',

        mst: '1234567890',

        cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY ABC CÃƒâ€¦Ã‚Â¨',

      }];

      getDb()

        .prepare('DELETE FROM kv_store WHERE key = ?')

        .run('decl_rows_v1');

      expect((await adminAgent.put('/api/storage/decl_rows_v1').send({ value: existingRow })).status).toBe(200);



      const res = await request(app)

        .post('/api/v4/declarations/imports/ecus-commit')

        .set('Authorization', 'Bearer bridge-secret')

        .send({

          rawRows: [

            {

              So_tk: 'TK002',

              Ngay_dang_ky: '2025-08-01',

              MaSoThue: '1234567890',

              Ten_doanh_nghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY ABC MÃƒÂ¡Ã‚Â»Ã…Â¡I',

              Loai_hinh: 'A11',

            },

            {

              So_tk: 'TK004',

              Ngay_dang_ky: '2025-08-01',

              MaSoThue: '5555555555',

              Ten_doanh_nghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY MÃƒÂ¡Ã‚Â»Ã…Â¡I',

              Loai_hinh: 'E11',

            },

          ],

          fetchedTotal: 2,

          actor: 'bridge-service',

          reason: 'manual',

          range: { from: '2025-08-01', to: '2025-08-02' },

        });



      expect(res.status).toBe(200);

      expect(res.body?.ok).toBe(true);

      expect(res.body?.result).toMatchObject({

        fetched: 2,

        imported: 1,

        updated: 1,

        skipped: 0,

        reviewLocked: 0,

      });



      const storedRows = readDeclarationRowsSnapshot(getDb()) || [];

      expect(storedRows).toHaveLength(2);

      expect(storedRows.find((row) => row.mst === '1234567890')).toMatchObject({ cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY ABC MÃƒÂ¡Ã‚Â»Ã…Â¡I' });

      expect(storedRows.find((row) => row.mst === '5555555555')).toMatchObject({ cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY MÃƒÂ¡Ã‚Â»Ã…Â¡I' });

    } finally {

      if (previousBridgeToken === undefined) {

        delete process.env.ECUS_BRIDGE_TOKEN;

      } else {

        process.env.ECUS_BRIDGE_TOKEN = previousBridgeToken;

      }

    }

  });



  it('ÃƒÆ’Ã‚Â¡p dÃƒÂ¡Ã‚Â»Ã‚Â¥ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ lÃƒÂ¡Ã‚Â»Ã‚Âc MST khi xem trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc vÃƒÆ’Ã‚Â  chÃƒÂ¡Ã‚ÂºÃ‚Â¡y Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢', async () => {

    resetDb();

    sqlMock.__resetMock();

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent.put('/api/import/ecus/config').send({

      config: {

        batchSize: 0,

        includeTaxCodes: [],

        excludeTaxCodes: [],

        connection: {

          server: 'MRHOC\\ECUSSQL2008',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '123456',

        },

      },

    });



    sqlMock.__setMockResult([

      { So_tk: '100000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109106', Ten_doanh_nghiep: 'DN 010', Loai_hinh: 'A11' },

      { So_tk: '200000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109107', Ten_doanh_nghiep: 'DN 011', Loai_hinh: 'A12' },

      { So_tk: '300000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109108', Ten_doanh_nghiep: 'DN 012', Loai_hinh: 'A31' },

    ]);



    const previewRes = await adminAgent.post('/api/import/ecus/preview').send({

      from: '2025-08-01',

      to: '2025-08-02',

      includeTaxCodes: ['0100109106', '0100109107'],

      excludeTaxCodes: ['0100109107'],

    });



    expect(previewRes.status).toBe(200);

    expect(previewRes.body.preview.rows).toHaveLength(1);

    expect(previewRes.body.preview.rows[0]).toMatchObject({ mst: '0100109106' });



    sqlMock.__setMockResult([

      { So_tk: '100000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109106', Ten_doanh_nghiep: 'DN 010', Loai_hinh: 'A11' },

      { So_tk: '200000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109107', Ten_doanh_nghiep: 'DN 011', Loai_hinh: 'A12' },

      { So_tk: '300000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109108', Ten_doanh_nghiep: 'DN 012', Loai_hinh: 'A31' },

    ]);



    const runRes = await adminAgent.post('/api/import/ecus/run').send({

      from: '2025-08-01',

      to: '2025-08-02',

      includeTaxCodes: ['0100109106', '0100109107'],

      excludeTaxCodes: ['0100109107'],

    });



    expect(runRes.status).toBe(200);

    expect(runRes.body.result.imported).toBe(1);

    expect(runRes.body.result.includeTaxCodes).toEqual(['0100109106', '0100109107']);

    expect(runRes.body.result.excludeTaxCodes).toEqual(['0100109107']);

    const storedRows = JSON.parse(

      getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1')?.value || '[]'

    );

    expect(storedRows).toHaveLength(1);

    expect(storedRows[0]).toMatchObject({ mst: '0100109106' });

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â± Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ng bÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ sung MST mÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi vÃƒÆ’Ã‚Â o bÃƒÂ¡Ã‚ÂºÃ‚Â£ng gÃƒÆ’Ã‚Â¡n sau khi Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ ECUS', async () => {

    resetDb();

    sqlMock.__resetMock();

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent.put('/api/import/ecus/config').send({

      config: {

        batchSize: 0,

        includeTaxCodes: [],

        excludeTaxCodes: [],

        connection: {

          server: 'MRHOC\\ECUSSQL2008',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '123456',

        },

      },

    });



    sqlMock.__setMockResult([

      {

        So_tk: '900000000001',

        Ngay_dang_ky: '2025-08-01',

        MaSoThue: '0100109109',

        Ten_doanh_nghiep: 'DN 013',

        Loai_hinh: 'A11',

      },

    ]);



    const runRes = await adminAgent.post('/api/import/ecus/run').send({

      from: '2025-08-01',

      to: '2025-08-02',

    });



    expect(runRes.status).toBe(200);

    expect(runRes.body.result.imported).toBe(1);



    const mstRes = await adminAgent.get('/api/storage/mst_rows_v2');

    expect(mstRes.status).toBe(200);

    const mstRows = Array.isArray(mstRes.body.value) ? mstRes.body.value : [];

    expect(mstRows.length).toBeGreaterThan(0);

    const entry = mstRows.find((row) => row?.mst === '0100109109');

    expect(entry).toBeTruthy();

    expect(entry).toMatchObject({

      mst: '0100109109',

      company: 'DN 013',

      status: 'Chưa gán nhân viên',

    });

    expect(entry.effective_from).toBe('2025-08-01');

  });



  it('lÃƒâ€ Ã‚Â°u cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh vÃƒÆ’Ã‚Â  chÃƒÂ¡Ã‚ÂºÃ‚Â¡y Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const configPayload = {

      config: {

        enabled: true,

        schedule: '0 0 * * *',

        rangeDays: 2,

        connection: {

          server: 'MRHOC\\ECUSSQL2008',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '123456',

        },

      },

    };

    const saveRes = await adminAgent.put('/api/import/ecus/config').send(configPayload);

    expect(saveRes.status).toBe(200);

    expect(saveRes.body.config.connection.password).toBe('');

    expect(saveRes.body.config.connection.hasPassword).toBe(true);



    const ecusRow = {

      So_tk: '105110557420',

      Ngay_dang_ky: '2025-08-01',

      MaSoThue: '1051105574',

      TenDoanhNghiep: 'CONG TY TNHH ABC',

      Loai_hinh: 'A11',

      muc_hang: 5,

      ds_gp: 'GP01, GP05',

      NhanVienNhap: 'Phuong',

    };

    sqlMock.__setMockResult([ecusRow]);



    const runRes = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });



    expect(runRes.status).toBe(200);

    expect(runRes.body).toMatchObject({

      ok: true,

      result: {

        imported: 1,

        updated: 0,

        skipped: 0,

        reviewLocked: 0,

        existingBefore: 0,

        fetched: 1,

        alerts: expect.any(Object),

      },

    });



    const state = sqlMock.__getState();

    const rangeRequest = state.requests.find(

      (req) =>

        Object.prototype.hasOwnProperty.call(req.inputs, 'from') ||

        Object.prototype.hasOwnProperty.call(req.inputs, 'to'),

    );

    expect(rangeRequest).toBeTruthy();

    expect(rangeRequest.inputs).toHaveProperty('from');

    expect(rangeRequest.inputs).toHaveProperty('to');



    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('decl_rows_v1');

    const storedRows = JSON.parse(row.value);

    expect(storedRows).toHaveLength(1);

    expect(storedRows[0]).toMatchObject({

      so_tk: '10511055742',

      so_tk_full: '105110557420',

      mst: '1051105574',

      cong_ty: ecusRow.TenDoanhNghiep,

      nhan_vien: ecusRow.NhanVienNhap,

      so_luong_gp: 2,

    });

  });



  it('bÃƒÂ¡Ã‚Â»Ã‚Â qua tÃƒÂ¡Ã‚Â»Ã‚Â khai Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ cÃƒÆ’Ã‚Â³ vÃƒÆ’Ã‚Â  giÃƒÂ¡Ã‚Â»Ã‚Â¯ nguyÃƒÆ’Ã‚Âªn dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent.put('/api/import/ecus/config').send({

      config: {

        enabled: true,

        connection: {

          server: 'MRHOC\\ECUSSQL2008',

          database: 'ECUS5VNACCS',

          user: 'sa',

          password: '123456',

        },

      },

    });



    sqlMock.__setMockResult([

      {

        So_tk: '777777777777',

        Ngay_dang_ky: '2025-08-01',

        MaSoThue: '7777777777',

        TenDoanhNghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY XYZ',

        Loai_hinh: 'A11',

        muc_hang: 3,

        NhanVienNhap: 'PhÃƒâ€ Ã‚Â°Ãƒâ€ Ã‚Â¡ng',

      },

    ]);



    const firstRun = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-01', to: '2025-08-02', actor: 'tester' });

    expect(firstRun.status).toBe(200);

    expect(firstRun.body.result.imported).toBe(1);



    const manualRow = [{

      so_tk: '777777777777',

      nhanh: '',

      date: '2025-08-01',

      mst: '7777777777',

      cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY XYZ',

      nhan_vien: 'Manual Edit',

      muc_hang: 3,

    }];

    expect((await adminAgent.put('/api/storage/decl_rows_v1').send({ value: manualRow })).status).toBe(200);



    sqlMock.__setMockResult([

      {

        So_tk: '777777777777',

        Ngay_dang_ky: '2025-08-01',

        MaSoThue: '7777777777',

        TenDoanhNghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY XYZ',

        Loai_hinh: 'A11',

        muc_hang: 3,

        NhanVienNhap: 'KhÃƒÆ’Ã‚Â¡c',

      },

    ]);



    const secondRun = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-01', to: '2025-08-02', actor: 'tester' });



    expect(secondRun.status).toBe(200);

    expect(secondRun.body.result.imported).toBe(0);

    expect(secondRun.body.result.updated).toBe(1);

    expect(secondRun.body.result.skipped).toBe(0);



    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('decl_rows_v1');

    const storedRows = JSON.parse(row.value);

    expect(storedRows).toHaveLength(1);

    expect(storedRows[0].nhan_vien).toBe('Manual Edit');

  });



  it('cap nhat co_line_count cho to khai da ton tai', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent

      .put('/api/import/ecus/config')

      .send({

        config: {

          enabled: true,

          connection: { server: 'MRHOC\\ECUSSQL2008', database: 'ECUS5VNACCS', user: 'sa', password: '123456' },

        },

      });



    const existingRow = [{

      so_tk: '107490433150',

      nhanh: '',

      date: '2025-09-03',

      mst: '4601145670',

      cong_ty: 'Cong ty TNHH SAMJU VINA',

      loai_hinh: 'E11',

      co_line_count: 0,

      co: '',

      has_co: false,

      nhan_vien: 'Huyen',

      team: 'Team 2',

    }];

    expect((await adminAgent.put('/api/storage/decl_rows_v1').send({ value: existingRow })).status).toBe(200);



    sqlMock.__setMockResult([

      {

        so_tk: '107490433150',

        ngay_dang_ky: '2025-09-03',

        mst: '4601145670',

        cong_ty: 'Cong ty TNHH SAMJU VINA',

        loai_hinh: 'E11',

        muc_hang: 1,

        co_count_num: 3,

      },

    ]);



    const runRes = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-09-03', to: '2025-09-04', actor: 'tester' });



    expect(runRes.status).toBe(200);

    expect(runRes.body.result.imported).toBe(0);

    expect(runRes.body.result.updated).toBe(1);

    expect(runRes.body.result.skipped).toBe(0);



    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('decl_rows_v1');

    const storedRows = JSON.parse(row.value);

    expect(storedRows).toHaveLength(1);

    expect(storedRows[0]).toMatchObject({

      so_tk: '10749043315',

      so_tk_full: '107490433150',

      co_line_count: 3,

      has_co: true,

      nhan_vien: 'Huyen',

    });

    expect(storedRows[0].co).toBeTruthy();

  });



  it('Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â¡nh dÃƒÂ¡Ã‚ÂºÃ‚Â¥u C/O khi dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u ECUS cÃƒÆ’Ã‚Â³ mÃƒÆ’Ã‚Â£ biÃƒÂ¡Ã‚Â»Ã†â€™u thuÃƒÂ¡Ã‚ÂºÃ‚Â¿ phÃƒÆ’Ã‚Â¹ hÃƒÂ¡Ã‚Â»Ã‚Â£p', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent

      .put('/api/import/ecus/config')

      .send({

        config: {

          enabled: true,

          connection: {

            server: 'MRHOC\\ECUSSQL2008',

            database: 'ECUS5VNACCS',

            user: 'sa',

            password: '123456',

          },

        },

      });



    sqlMock.__setMockResult([

      {

        so_tk: '105110557420',

        ngay_dang_ky: '2025-08-01',

        mst: '1051105574',

        cong_ty: 'CONG TY TNHH C/O',

        ma_bieu_thue_xnk: 'B05',

        muc_hang: '1',

      },

    ]);



    const runRes = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });



    expect(runRes.status).toBe(200);

    const row = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1');

    const storedRows = JSON.parse(row.value);

    expect(storedRows).toHaveLength(1);
    expect(storedRows[0].has_co).toBe(true);
    expect(storedRows[0].co).toBeTruthy();

  });



  it('loÃƒÂ¡Ã‚ÂºÃ‚Â¡i trÃƒÂ¡Ã‚Â»Ã‚Â« giÃƒÂ¡Ã‚ÂºÃ‚Â¥y phÃƒÆ’Ã‚Â©p theo quy tÃƒÂ¡Ã‚ÂºÃ‚Â¯c toÃƒÆ’Ã‚Â n cÃƒÂ¡Ã‚Â»Ã‚Â¥c khi Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent

      .put('/api/import/ecus/config')

      .send({

        config: {

          enabled: true,

          connection: {

            server: 'MRHOC\\ECUSSQL2008',

            database: 'ECUS5VNACCS',

            user: 'sa',

            password: '123456',

          },

        },

      });



    const rulesPayload = {

      version: 1,

      license: {

        exclude: {

          codes: ['ZN02', 'HDGC'],

          agencies: [],

        },

      },

    };

    const rulesRes = await adminAgent

      .put('/api/storage/kpi_rules_v2')

      .send({ value: JSON.stringify(rulesPayload) });

    expect(rulesRes.status).toBe(200);



    sqlMock.__setMockResult([

      {

        so_tk: '105110557420',

        ngay_dang_ky: '2025-09-01',

        mst: '0123456789',

        cong_ty: 'Cong ty ABC',

        loai_hinh: 'A11',

        muc_hang: 1,

        license_count: 3,

        license_codes: 'GP01, ZN02 , HDGC',

      },

    ]);



    const runRes = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-09-01', to: '2025-09-02', actor: 'tester' });



    expect(runRes.status).toBe(200);

    expect(runRes.body?.result?.imported).toBe(1);



    const row = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1');

    const storedRows = JSON.parse(row.value);

    expect(storedRows).toHaveLength(1);

    expect(storedRows[0]).toMatchObject({

      so_tk: '10511055742',

      licenses: 1,

      so_luong_gp: 1,

    });

    expect(storedRows[0].licenseCodes).toEqual(['GP01']);

    expect(storedRows[0].licenseSourceCodes).toEqual(

      expect.arrayContaining(['GP01', 'ZN02', 'HDGC'])

    );

    expect(storedRows[0].licenseExcludedCodes).toEqual(

      expect.arrayContaining(['ZN02', 'HDGC'])

    );

  });



  it('loÃƒÂ¡Ã‚ÂºÃ‚Â¡i trÃƒÂ¡Ã‚Â»Ã‚Â« giÃƒÂ¡Ã‚ÂºÃ‚Â¥y phÃƒÆ’Ã‚Â©p theo Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â¡i lÃƒÆ’Ã‚Â½ HQ khi Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent

      .put('/api/import/ecus/config')

      .send({

        config: {

          enabled: true,

          connection: {

            server: 'MRHOC\\ECUSSQL2008',

            database: 'ECUS5VNACCS',

            user: 'sa',

            password: '123456',

          },

        },

      });



    const rulesPayload = {

      version: 1,

      license: {

        exclude: {

          codes: [],

          agencies: [

            {

              agency: 'Dai ly HQ 1',

              codes: ['AG01'],

            },

          ],

        },

      },

    };

    const rulesRes = await adminAgent

      .put('/api/storage/kpi_rules_v2')

      .send({ value: JSON.stringify(rulesPayload) });

    expect(rulesRes.status).toBe(200);



    const hqPayload = [

      { mst: '4601145670', company: 'Cong ty SAMJU', agent: 'Dai ly HQ 1' },

    ];

    const hqRes = await adminAgent

      .put('/api/storage/hq_agencies_v1')

      .send({ value: JSON.stringify(hqPayload) });

    expect(hqRes.status).toBe(200);



    sqlMock.__setMockResult([

      {

        so_tk: '107490433150',

        ngay_dang_ky: '2025-09-03',

        mst: '4601145670',

        cong_ty: '',

        loai_hinh: 'E11',

        muc_hang: 1,

        license_count: 2,

        license_codes: 'AG01, GP02',

      },

    ]);



    const runRes = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-09-03', to: '2025-09-04', actor: 'tester' });



    expect(runRes.status).toBe(200);

    expect(runRes.body?.result?.imported).toBe(1);



    const row = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1');

    const storedRows = JSON.parse(row.value);

    expect(storedRows).toHaveLength(1);

    expect(storedRows[0]).toMatchObject({

      so_tk: '10749043315',

      licenses: 1,

      so_luong_gp: 1,

      agency: 'Dai ly HQ 1',

      cong_ty: 'Cong ty SAMJU',

    });

    expect(storedRows[0].licenseCodes).toEqual(['GP02']);

    expect(storedRows[0].licenseSourceCodes).toEqual(expect.arrayContaining(['AG01', 'GP02']));

    expect(storedRows[0].licenseExcludedCodes).toEqual(expect.arrayContaining(['AG01']));

  });



  it('kiÃƒÂ¡Ã‚Â»Ã†â€™m tra trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i SQL Server thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng khi Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent

      .put('/api/import/ecus/config')

      .send({

        config: {

          enabled: true,

          connection: {

            server: 'MRHOC\\ECUSSQL2008',

            database: 'ECUS5VNACCS',

            user: 'sa',

            password: '123456',

          },

        },

      });



    const stateBefore = sqlMock.__getState();

    stateBefore.lastQuery = null;

    stateBefore.requests.length = 0;



    sqlMock.__setMockResult([{ ok: 1 }]);



    const res = await adminAgent.get('/api/import/ecus/status');

    expect(res.status).toBe(200);

    expect(res.body.database.ok).toBe(true);

    expect(res.body.database.state).toBe('ready');



    const state = sqlMock.__getState();

    expect(state.lastQuery).toMatch(/SELECT 1/i);

  });



  it('Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c bÃƒÂ¡Ã‚ÂºÃ‚Â£n ghi vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi tiÃƒÆ’Ã‚Âªu Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â cÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢t tiÃƒÂ¡Ã‚ÂºÃ‚Â¿ng ViÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t cÃƒÆ’Ã‚Â³ dÃƒÂ¡Ã‚ÂºÃ‚Â¥u', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent

      .put('/api/import/ecus/config')

      .send({

        config: {

          enabled: true,

          connection: {

            server: 'MRHOC\\ECUSSQL2008',

            database: 'ECUS5VNACCS',

            user: 'sa',

            password: '123456',

          },

        },

      });



    const exportRow = {

      so_tk: '305254416960',

      ngay_dang_ky: '2025-08-15',

      mst: '2301158516',

      cong_ty: 'CONG TY TNHH XYZ',

      muc_hang: '4',

      licenses: '3',

      nhan_vien_xuat: 'Hoc',

      team: 'Team 3',

    };

    sqlMock.__setMockResult([exportRow]);



    const runRes = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });



    expect(runRes.status).toBe(200);

    expect(runRes.body.ok).toBe(true);

    expect(runRes.body.result.imported).toBe(1);



    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('decl_rows_v1');

    const stored = JSON.parse(row.value);

    expect(stored).toHaveLength(1);

    expect(stored[0]).toMatchObject({

      so_tk: '30525441696',

      so_tk_full: '305254416960',

      mst: '2301158516',

      cong_ty: exportRow.cong_ty,

      so_luong_gp: 3,

      team: 'Team 3',

      nhan_vien: exportRow.nhan_vien_xuat,

    });

  });



  it('Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â·t tham sÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ to tÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi cuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi ngÃƒÆ’Ã‚Â y khi truyÃƒÂ¡Ã‚Â»Ã‚Ân chuÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i ngÃƒÆ’Ã‚Â y Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ khÃƒÆ’Ã‚Â´ng bÃƒÂ¡Ã‚Â»Ã‚Â sÃƒÆ’Ã‚Â³t bÃƒÂ¡Ã‚ÂºÃ‚Â£n ghi cuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi ngÃƒÆ’Ã‚Â y', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent

      .put('/api/import/ecus/config')

      .send({

        config: {

          enabled: true,

          connection: {

            server: 'MRHOC\\ECUSSQL2008',

            database: 'ECUS5VNACCS',

            user: 'sa',

            password: '123456',

          },

        },

      });



    sqlMock.__setMockResult([

      {

        So_tk: '999999999999',

        Ngay_dang_ky: '2025-08-31T23:30:00',

        MaSoThue: '1234567890',

        Ten_doanh_nghiep: 'CÃƒÆ’Ã¢â‚¬ÂNG TY ABC',

        So_muc: 2,

        Giay_phep: 'GP01;GP02',

      },

    ]);



    const res = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-30', to: '2025-08-31', actor: 'tester' });



    expect(res.status).toBe(200);

    expect(res.body?.ok).toBe(true);

    expect(res.body?.result?.imported).toBe(1);



    const state = sqlMock.__getState();

    const lastRequest = state.requests.at(-1);

    expect(lastRequest?.inputs?.to).toBeInstanceOf(Date);

    const toValue = lastRequest.inputs.to;

    expect(toValue.getHours()).toBe(23);

    expect(toValue.getMinutes()).toBe(59);

    expect(toValue.getSeconds()).toBe(59);

    expect(toValue.getMilliseconds()).toBe(997);



    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('decl_rows_v1');

    const stored = JSON.parse(row.value);

    expect(stored).toHaveLength(1);

    expect(stored[0].date).toBe('2025-08-31');

    expect(stored.some((entry) => entry.date === '2025-09-01')).toBe(false);

  });



  it('ghi nhÃƒÂ¡Ã‚ÂºÃ‚Â­n lÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i khi SQL Server gÃƒÂ¡Ã‚ÂºÃ‚Â·p sÃƒÂ¡Ã‚Â»Ã‚Â± cÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    await adminAgent

      .put('/api/import/ecus/config')

      .send({

        config: {

          enabled: true,

          connection: {

            server: 'MRHOC\\ECUSSQL2008',

            database: 'ECUS5VNACCS',

            user: 'sa',

            password: '123456',

          },

        },

      });



    sqlMock.__setMockErrors({ queryError: new Error('SQL timeout') });



    const res = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });



    expect(res.status).toBe(500);

    expect(res.body.ok).toBe(false);



    const timeoutEvents = getSqlTimeoutEvents();

    expect(timeoutEvents.some((event) => event.message?.includes('SQL timeout'))).toBe(true);



    const configRes = await adminAgent.get('/api/import/ecus/config');

    expect(configRes.body.config.lastStatus).toMatch(/error/i);



    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('decl_rows_v1');

    expect(JSON.parse(row.value)).toHaveLength(0);

  });

});



describe('V4 reporting read-model API', () => {

  beforeEach(() => {

    resetDb();

    seedReportingReadModelData();

  });



  it('yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc khi Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Âc reporting view KPI', async () => {

    const response = await request(app).get('/api/v4/reporting/view');

    expect(response.status).toBe(401);

    expect(response.body.ok).toBe(false);

  });



  it('returns reporting view contract v4', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const response = await adminAgent.get('/api/v4/reporting/view').query({ from: '2026-02-01', to: '2026-02-28' });
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.meta).toEqual({
      servedAt: expect.any(String),
      aggregateStatus: {
        available: false,
        generatedAt: '',
        queryKey: '',
        total: 0,
        range: { from: '', to: '' },
      },
    });
    expect(response.body.data.summary).toEqual(expect.objectContaining({
      range: { from: '2026-02-01', to: '2026-02-28' },
      ruleSet: { id: 'legacy-kpi', name: 'Legacy KPI' },
      summary: expect.objectContaining({
        decls: expect.any(Number),
        import: expect.any(Number),
        export: expect.any(Number),
        items: expect.any(Number),
        kpi: expect.any(Number),
        companyCount: expect.any(Number),
        licenseSummary: expect.any(String),
      }),
      trend: expect.objectContaining({
        series: expect.any(Array),
        comparison: expect.objectContaining({
          delta: expect.objectContaining({
            kpi: expect.any(Number),
            decls: expect.any(Number),
          }),
        }),
        topTeams: expect.any(Array),
      }),
    }));
    expect(response.body.data.summary.adjustments).toEqual(expect.objectContaining({
      list: expect.any(Array),
      applied: expect.any(Array),
      totalPoints: expect.any(Number),
      pendingCount: expect.any(Number),
      approvedCount: expect.any(Number),
      rejectedCount: expect.any(Number),
      appliedCount: expect.any(Number),
      totalsByCategory: expect.any(Object),
    }));
    expect(response.body.data.summary.companies).toEqual(expect.objectContaining({
      staff: expect.any(Array),
      teams: expect.any(Array),
    }));
    expect(response.body.data.staff).toEqual(expect.objectContaining({
      range: { from: '2026-02-01', to: '2026-02-28' },
      ruleSet: { id: 'legacy-kpi', name: 'Legacy KPI' },
      total: expect.any(Number),
      keysHash: expect.any(String),
      items: expect.any(Array),
    }));
    expect(response.body.data.teams).toEqual(expect.objectContaining({
      range: { from: '2026-02-01', to: '2026-02-28' },
      ruleSet: { id: 'legacy-kpi', name: 'Legacy KPI' },
      total: expect.any(Number),
      keysHash: expect.any(String),
      items: expect.any(Array),
    }));
  });

  it('returns reporting view bundle contract v4', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const response = await adminAgent.get('/api/v4/reporting/view').query({ from: '2026-02-01', to: '2026-02-28' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.summary).toEqual(expect.objectContaining({
      range: { from: '2026-02-01', to: '2026-02-28' },
      ruleSet: { id: 'legacy-kpi', name: 'Legacy KPI' },
    }));
    expect(response.body.data.meta).toEqual(expect.objectContaining({
      servedAt: expect.any(String),
      aggregateStatus: expect.objectContaining({ available: false }),
    }));
    expect(response.body.data.staff).toEqual(expect.objectContaining({
      total: expect.any(Number),
      range: { from: '2026-02-01', to: '2026-02-28' },
      ruleSet: { id: 'legacy-kpi', name: 'Legacy KPI' },
      keysHash: expect.any(String),
      items: expect.any(Array),
    }));
    expect(response.body.data.teams).toEqual(expect.objectContaining({
      total: expect.any(Number),
      range: { from: '2026-02-01', to: '2026-02-28' },
      ruleSet: { id: 'legacy-kpi', name: 'Legacy KPI' },
      keysHash: expect.any(String),
      items: expect.any(Array),
    }));
  });

  it('Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â­nh kÃƒÆ’Ã‚Â¨m freshness monthly aggregate vÃƒÆ’Ã‚Â o reporting view khi snapshot phÃƒÆ’Ã‚Â¹ hÃƒÂ¡Ã‚Â»Ã‚Â£p Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ tÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const query = { from: '2026-01-01', to: '2026-02-28' };
    const aggregateRes = await adminAgent.get('/api/v4/reporting/aggregates/monthly').query(query);

    expect(aggregateRes.status).toBe(200);

    const response = await adminAgent.get('/api/v4/reporting/view').query(query);

    expect(response.status).toBe(200);
    expect(response.body.data.meta).toEqual({
      servedAt: expect.any(String),
      aggregateStatus: {
        available: true,
        generatedAt: aggregateRes.body.data.generatedAt,
        queryKey: createMonthlyAggregateQueryKey(query),
        total: aggregateRes.body.data.total,
        range: {
          from: '2026-01-01',
          to: '2026-02-28',
        },
      },
    });
  });

  it('retire cÃƒÆ’Ã‚Â¡c compatibility reporting slice endpoints Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ dÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n vÃƒÂ¡Ã‚Â»Ã‚Â /view', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });



    expect(loginRes.status).toBe(200);



    const query = { from: '2026-02-01', to: '2026-02-28', ruleId: 'legacy-kpi' };

    const [summaryResponse, staffResponse, teamsResponse] = await Promise.all([
      adminAgent.get('/api/v4/reporting/summary').query(query),

      adminAgent.get('/api/v4/reporting/staff').query(query),

      adminAgent.get('/api/v4/reporting/teams').query(query),

    ]);



    expect(summaryResponse.status).toBe(404);

    expect(staffResponse.status).toBe(404);

    expect(teamsResponse.status).toBe(404);

  });



  it('cho phÃƒÆ’Ã‚Â©p chÃƒÂ¡Ã‚Â»Ã‚Ân reporting rule qua ruleId vÃƒÆ’Ã‚Â  trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â adjustment summary Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ chuÃƒÂ¡Ã‚ÂºÃ‚Â©n hÃƒÆ’Ã‚Â³a', async () => {

    const seed = createReportingSeed();

    upsertKvValue('kpi_rules_v2', {

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

    });

    upsertKvValue('kpi_adjustments_v1', [

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

    ]);



    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const response = await adminAgent.get('/api/v4/reporting/view').query({ from: '2026-02-01', to: '2026-02-28', ruleId: 'boosted-kpi' });

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

          kpi: 2,

          nhan_vien: 'Lan',

          team: 'Blue Team',

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



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â schedule KPI Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ chuÃƒÂ¡Ã‚ÂºÃ‚Â©n hÃƒÆ’Ã‚Â³a vÃƒÆ’Ã‚Â  next-run xÃƒÆ’Ã‚Â¡c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const asOf = '2026-03-09T07:00:00.000Z';

    const response = await adminAgent.get('/api/v4/reporting/schedules').query({ asOf });



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

        deliveryChannels: ['email'],

        deliveryStatus: 'idle',

        lastDeliveryAt: '',

        lastDeliveryError: '',

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

        deliveryChannels: ['email'],

        deliveryStatus: 'idle',

        lastDeliveryAt: '',

        lastDeliveryError: '',

        active: false,

        lastRun: '2026-02-20T02:15:00.000Z',

        nextRun: '',

      }),

    ]);

    expect(response.body.data.items[0].nextRun).not.toBe('');

    expect(new Date(response.body.data.items[0].nextRun).getTime()).toBeGreaterThan(new Date(asOf).getTime());

  });



  it('Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â­nh kÃƒÆ’Ã‚Â¨m trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i monthly aggregate hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n cÃƒÆ’Ã‚Â³ vÃƒÆ’Ã‚Â o schedules response', async () => {

    upsertKvValue('kpi_reporting_monthly_aggregates_default_v1', createStoredMonthlyAggregateSnapshot());

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const response = await adminAgent.get('/api/v4/reporting/schedules').query({ asOf: '2026-03-09T07:00:00.000Z' });



    expect(response.status).toBe(200);

    expect(response.body.data.aggregateStatus).toEqual({

      available: true,

      generatedAt: '2026-03-09T09:00:00.000Z',

      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),

      total: 2,

      range: {

        from: '2026-01-01',

        to: '2026-02-28',

      },

    });

  });

  it('lÃƒâ€ Ã‚Â°u vÃƒÆ’Ã‚Â  xoÃƒÆ’Ã‚Â¡ schedule KPI qua reporting boundary thay vÃƒÆ’Ã‚Â¬ storage API generic', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const saveResponse = await adminAgent.post('/api/v4/reporting/schedules').send({

      name: 'Friday Ops',

      frequency: 'weekly',

      dayOfWeek: 5,

      time: '09:45',

      formats: ['pdf', ' excel ', 'pdf'],

      recipients: 'ops@example.com\nlead@example.com',

      deliveryChannels: ['email', 'report_center'],

      active: true,

    });



    expect(saveResponse.status).toBe(200);

    expect(saveResponse.body.ok).toBe(true);

    expect(saveResponse.body.data.total).toBe(3);

    expect(saveResponse.body.data.item).toEqual(

      expect.objectContaining({

        id: expect.any(String),

        name: 'Friday Ops',

        frequency: 'weekly',

        dayOfWeek: 5,

        time: '09:45',

        formats: ['pdf', 'excel'],

        recipients: ['ops@example.com', 'lead@example.com'],

        deliveryChannels: ['email', 'report_center'],

        deliveryStatus: 'idle',

        active: true,

      })

    );



    const storedSchedules = JSON.parse(
      getDb()
        .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
        .get('kpi_report_schedule_v1')?.payload || '[]'
    );

    expect(storedSchedules).toEqual(

      expect.arrayContaining([

        expect.objectContaining({

          name: 'Friday Ops',

          formats: ['pdf', 'excel'],

          recipients: ['ops@example.com', 'lead@example.com'],

          deliveryChannels: ['email', 'report_center'],

        }),

      ])

    );



    const deleteResponse = await adminAgent.delete(`/api/v4/reporting/schedules/${saveResponse.body.data.item.id}`);



    expect(deleteResponse.status).toBe(200);

    expect(deleteResponse.body).toEqual({

      ok: true,

      data: {

        deleted: true,

        total: 2,

      },

    });

    const remainingSchedules = JSON.parse(
      getDb()
        .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
        .get('kpi_report_schedule_v1')?.payload || '[]'
    );

    expect(remainingSchedules).toHaveLength(2);

    expect(remainingSchedules.find((entry) => entry.id === saveResponse.body.data.item.id)).toBeUndefined();

  });

  it('chÃƒÂ¡Ã‚ÂºÃ‚Â·n ghi trÃƒÂ¡Ã‚Â»Ã‚Â±c tiÃƒÂ¡Ã‚ÂºÃ‚Â¿p schedule KPI qua storage API generic', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const response = await adminAgent.put('/api/storage/kpi_report_schedule_v1').send({

      value: [],

    });



    expect(response.status).toBe(403);

    expect(response.body).toEqual({

      ok: false,

      error: 'Khoá này chỉ chỉnh sửa qua API lịch báo cáo KPI',

    });

  });

});



describe('V4 reporting aggregates API', () => {

  beforeEach(() => {

    resetDb();

    seedReportingAggregateData();

  });



  it('yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc khi Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Âc monthly aggregates', async () => {

    const response = await request(app).get('/api/v4/reporting/aggregates/monthly');

    expect(response.status).toBe(401);

    expect(response.body.ok).toBe(false);

  });



  it('materialize monthly aggregates vÃƒÆ’Ã‚Â  lÃƒâ€ Ã‚Â°u snapshot vÃƒÆ’Ã‚Â o reporting projections', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const response = await adminAgent

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



    const stored = getDb()
      .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
      .get('kpi_reporting_monthly_aggregates_v1');

    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored.payload);

    expect(parsed.ruleSet).toEqual({

      id: 'legacy-kpi',

      name: 'Legacy KPI',

    });

    expect(parsed.cache).toEqual({

      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),

      reused: false,

    });

    expect(parsed.total).toBe(2);

    expect(parsed.items.map((item) => item.period)).toEqual(['2026-02', '2026-01']);
  });

  it('returns reporting observability with recent monthly aggregate runs', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const query = { from: '2026-01-01', to: '2026-02-28' };
    const aggregateRes = await adminAgent.get('/api/v4/reporting/aggregates/monthly').query(query);
    const viewRes = await adminAgent.get('/api/v4/reporting/view').query(query);
    const observabilityRes = await adminAgent.get('/api/v4/reporting/observability');

    expect(aggregateRes.status).toBe(200);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.data.meta.aggregateStatus).toEqual({
      available: true,
      generatedAt: aggregateRes.body.data.generatedAt,
      queryKey: createMonthlyAggregateQueryKey(query),
      total: aggregateRes.body.data.total,
      range: {
        from: '2026-01-01',
        to: '2026-02-28',
      },
    });

    expect(observabilityRes.status).toBe(200);
    expect(observabilityRes.body.data.aggregates.active).toEqual({
      available: true,
      generatedAt: aggregateRes.body.data.generatedAt,
      queryKey: createMonthlyAggregateQueryKey(query),
      total: aggregateRes.body.data.total,
      range: {
        from: '2026-01-01',
        to: '2026-02-28',
      },
    });
    expect(observabilityRes.body.data.jobs).toEqual(
      expect.objectContaining({
        total: 2,
        filteredTotal: 2,
        successCount: 2,
        failureCount: 0,
        lastSuccessAt: aggregateRes.body.data.generatedAt,
        lastFailureAt: null,
        items: [
          expect.objectContaining({
            job: 'reporting-monthly-aggregate-materialize',
            status: 'success',
            source: 'reporting-monthly-aggregates',
            snapshotKey: 'kpi_reporting_monthly_aggregates_v1',
            queryKey: createMonthlyAggregateQueryKey(query),
            total: aggregateRes.body.data.total,
          }),
          expect.objectContaining({
            job: 'reporting-monthly-aggregate-materialize',
            status: 'success',
            source: 'storage',
            snapshotKey: 'kpi_reporting_monthly_aggregates_default_v1',
            queryKey: createMonthlyAggregateQueryKey(query),
            total: aggregateRes.body.data.total,
          }),
        ],
      })
    );
  });

  it('supports reporting observability search and pagination for jobs and periods', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const janQuery = { from: '2026-01-01', to: '2026-01-31' };
    const fullQuery = { from: '2026-01-01', to: '2026-02-28' };
    const janResponse = await adminAgent.get('/api/v4/reporting/aggregates/monthly').query(janQuery);
    const fullResponse = await adminAgent.get('/api/v4/reporting/aggregates/monthly').query(fullQuery);
    writeReportingProjectionValue(
      getDb(),
      'kpi_reporting_monthly_aggregates_v1',
      createStoredMonthlyAggregateSnapshot(),
      {
        updatedAt: '2026-03-09T09:00:00.000Z',
      }
    );
    const observabilityRes = await adminAgent.get('/api/v4/reporting/observability').query({
      jobSearch: 'aggregate',
      jobStatus: 'success',
      jobPageSize: 1,
      periodSearch: '02/2026',
      periodPageSize: 1,
    });

    expect(janResponse.status).toBe(200);
    expect(fullResponse.status).toBe(200);
    expect(observabilityRes.status).toBe(200);
    expect(observabilityRes.body.data.jobs).toEqual(
      expect.objectContaining({
        total: 3,
        filteredTotal: 3,
        successCount: 3,
        failureCount: 0,
        lastSuccessAt: fullResponse.body.data.generatedAt,
        lastFailureAt: null,
        search: 'aggregate',
        status: 'success',
        page: 1,
        pageSize: 1,
        pageCount: 3,
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
    expect(observabilityRes.body.data.monthlyStats.active).toEqual(
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



  it('dÃƒÆ’Ã‚Â¹ng preset aggregate mÃƒÂ¡Ã‚ÂºÃ‚Â·c Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹nh khi khÃƒÆ’Ã‚Â´ng truyÃƒÂ¡Ã‚Â»Ã‚Ân query', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const first = await adminAgent.get('/api/v4/reporting/aggregates/monthly');

    const second = await adminAgent.get('/api/v4/reporting/aggregates/monthly');



    expect(first.status).toBe(200);

    expect(first.body.data.range).toEqual({

      from: '2026-01-01',

      to: '2026-02-28',

    });

    expect(first.body.data.cache.queryKey).toBe(
      createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' })
    );



    expect(second.status).toBe(200);

    expect(second.body.data.cache).toEqual({

      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),

      reused: true,

    });

    const storedDefault = getDb()
      .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
      .get('kpi_reporting_monthly_aggregates_default_v1');

    expect(storedDefault).toBeTruthy();

  });



  it('tÃƒÆ’Ã‚Â¡i sÃƒÂ¡Ã‚Â»Ã‚Â­ dÃƒÂ¡Ã‚Â»Ã‚Â¥ng snapshot monthly aggregate khi query khÃƒÆ’Ã‚Â´ng Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const first = await adminAgent

      .get('/api/v4/reporting/aggregates/monthly')

      .query({ from: '2026-01-01', to: '2026-02-28' });

    const second = await adminAgent

      .get('/api/v4/reporting/aggregates/monthly')

      .query({ from: '2026-01-01', to: '2026-02-28' });



    expect(first.status).toBe(200);

    expect(second.status).toBe(200);

    expect(second.body.data.generatedAt).toBe(first.body.data.generatedAt);

    expect(second.body.data.cache).toEqual({

      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),

      reused: true,

    });

  });



  it('lÃƒÆ’Ã‚Â m mÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi snapshot monthly aggregate khi dÃƒÂ¡Ã‚Â»Ã‚Â¯ liÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u nguÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n reporting thay Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢i', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const buildRes = await adminAgent

      .get('/api/v4/reporting/aggregates/monthly')

      .query({ from: '2026-01-01', to: '2026-02-28' });

    expect(buildRes.status).toBe(200);

    const initialSnapshot = JSON.parse(
      getDb()
        .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
        .get('kpi_reporting_monthly_aggregates_v1').payload
    );



    const updateRes = await adminAgent.put('/api/storage/kpi_adjustments_v1').send({

      value: JSON.stringify([

        {

          declarationId: 'TK1',

          points: 0.2,

          reason: 'manual adjustment',

        },

      ]),

    });



    expect(updateRes.status).toBe(200);

    const refreshedRow = getDb()
      .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
      .get('kpi_reporting_monthly_aggregates_v1');

    expect(refreshedRow).toBeTruthy();

    const refreshedSnapshot = JSON.parse(refreshedRow.payload);

    expect(refreshedSnapshot.cache).toEqual({

      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),

      reused: false,

    });
    expect(refreshedSnapshot).not.toEqual(initialSnapshot);

    const cachedRes = await adminAgent

      .get('/api/v4/reporting/aggregates/monthly')

      .query({ from: '2026-01-01', to: '2026-02-28' });

    expect(cachedRes.status).toBe(200);

    expect(cachedRes.body.data.generatedAt).toBe(refreshedSnapshot.generatedAt);

    expect(cachedRes.body.data.cache).toEqual({

      queryKey: createMonthlyAggregateQueryKey({ from: '2026-01-01', to: '2026-02-28' }),

      reused: true,

    });

  });

});



describe('Report export API', () => {

  beforeEach(() => {

    resetDb();

    excelMock.__resetWorkbookCreateCount?.();

  });



  it('yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc khi xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o', async () => {

    const res = await request(app)

      .post('/api/reports/export')

      .send({ kind: 'staff', payload: {} });

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);



    const auditCount = getDb().prepare('SELECT COUNT(*) AS total FROM export_audit').get() || { total: 0 };

    expect(auditCount.total ?? 0).toBe(0);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi khi tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ quyÃƒÂ¡Ã‚Â»Ã‚Ân bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o', async () => {

    const admin = request.agent(app);

    const loginAdmin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginAdmin.status).toBe(200);



    await admin.post('/api/auth/accounts').send({

      username: 'noperm',

      password: '12345678',

      name: 'KhÃƒÆ’Ã‚Â´ng quyÃƒÂ¡Ã‚Â»Ã‚Ân',

      role: 'staff',

      permissions: { reportsExport: false },

    });



    const staffAgent = request.agent(app);

    const staffLogin = await staffAgent.post('/api/auth/login').send({ username: 'noperm', password: '12345678' });

    expect(staffLogin.status).toBe(200);



    const exportRes = await staffAgent

      .post('/api/reports/export')

      .send({ kind: 'staff', payload: {} });



    expect(exportRes.status).toBe(403);

    expect(exportRes.body.ok).toBe(false);



    const auditCount = getDb().prepare('SELECT COUNT(*) AS total FROM export_audit').get() || { total: 0 };

    expect(auditCount.total ?? 0).toBe(0);



    const cleanup = await admin.delete('/api/auth/accounts/noperm');

    expect(cleanup.status).toBe(200);

  });



  it('xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t file bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o KPI nhÃƒÆ’Ã‚Â¢n viÃƒÆ’Ã‚Âªn thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng', async () => {

    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const payload = {

      staff: {

        name: 'NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n VÃƒâ€žÃ†â€™n A',

        teamLabel: 'Team 1',

        stats: { decls: 1, kpi: 2.5, import: 1, export: 0, items: 5, licenses: 1 },

        rows: [

          {

            date: '2025-01-01',

            so_tk: 'TK001',

            mst: '0123456789',

            cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY A',

            loai_hinh: 'A11',

            isExport: false,

            num_items: 5,

            licenses: 1,

            kpi: 2.5,

          },

        ],

      },

      range: { from: '2025-01-01', to: '2025-01-31' },

      rules: { name: 'Quy tÃƒÂ¡Ã‚ÂºÃ‚Â¯c demo', applyFrom: '2025-01-01' },

    };



    const res = await agent

      .post('/api/reports/export')

      .buffer(true)

      .parse(binaryParser)

      .send({ kind: 'staff', payload });



    expect(res.status).toBe(200);

    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    expect(res.headers['content-disposition']).toMatch(/bao-cao-kpi-nhan-vien/);

    expect(Buffer.isBuffer(res.body)).toBe(true);

    expect(res.body.byteLength).toBeGreaterThan(0);



    const rows = getDb()

      .prepare('SELECT * FROM export_audit ORDER BY id DESC')

      .all();

    expect(rows).toHaveLength(1);

    const [entry] = rows;

    expect(entry.username).toBe('admin');

    expect(entry.report_kind).toBe('staff');

    expect(entry.signature).toBeTruthy();

    expect(entry.short_signature).toBeTruthy();

    expect(entry.request_id).toBeTruthy();

    expect(entry.filters).toBeTruthy();

    const storedFilters = JSON.parse(entry.filters);

    expect(storedFilters).toHaveProperty('staff');

    expect(storedFilters.staff.name).toBe(payload.staff.name);

    expect(Array.isArray(storedFilters.staff.rows)).toBe(true);

    expect(storedFilters.range).toEqual(payload.range);

    expect(storedFilters.rules.name).toBe(payload.rules.name);

    expect(Object.keys(storedFilters.staff.stats || {})).toEqual(

      expect.arrayContaining(['decls', 'kpi', 'import', 'export', 'items', 'licenses'])

    );

  });



  it('tÃƒÆ’Ã‚Â¡i sÃƒÂ¡Ã‚Â»Ã‚Â­ dÃƒÂ¡Ã‚Â»Ã‚Â¥ng cache khi xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t cÃƒÆ’Ã‚Â¹ng tham sÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ', async () => {

    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const payload = {

      staff: {

        name: 'NguyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n VÃƒâ€žÃ†â€™n B',

        teamLabel: 'Team 2',

        stats: { decls: 2, kpi: 5, import: 1, export: 1, items: 10, licenses: 0 },

        rows: [

          {

            date: '2025-02-01',

            so_tk: 'TK002',

            mst: '9876543210',

            cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY B',

            loai_hinh: 'B11',

            isExport: true,

            num_items: 10,

            licenses: 0,

            kpi: 5,

          },

        ],

      },

      range: { from: '2025-02-01', to: '2025-02-28' },

    };



    const first = await agent

      .post('/api/reports/export')

      .buffer(true)

      .parse(binaryParser)

      .send({ kind: 'staff', payload });



    expect(first.status).toBe(200);

    expect(excelMock.__getWorkbookCreateCount()).toBe(1);



    const second = await agent

      .post('/api/reports/export')

      .buffer(true)

      .parse(binaryParser)

      .send({ kind: 'staff', payload });



    expect(second.status).toBe(200);

    expect(excelMock.__getWorkbookCreateCount()).toBe(2);

    expect(Buffer.isBuffer(second.body)).toBe(true);

    expect(second.body.byteLength).toBeGreaterThan(0);

  });



  it('xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÆ’Ã‚Â¡o cÃƒÆ’Ã‚Â¡o nhÃƒÆ’Ã‚Â¢n viÃƒÆ’Ã‚Âªn tÃƒÂ¡Ã‚Â»Ã‚Â« compact reporting-v4 payload', async () => {
    seedReportingAggregateData();

    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const response = await agent
      .post('/api/reports/export')
      .buffer(true)
      .parse(binaryParser)
      .send({
        kind: 'staff',
        payload: {
          source: 'reporting-v4',
          query: { from: '2026-02-01', to: '2026-02-28' },
          ruleId: 'legacy-kpi',
          staffKey: 'lan',
          columns: { items: true },
        },
      });

    expect(response.status).toBe(200);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.byteLength).toBeGreaterThan(0);
    expect(response.headers['content-disposition']).toMatch(/bao-cao-kpi-nhan-vien-lan/i);

    const rows = getDb()
      .prepare('SELECT * FROM export_audit ORDER BY id DESC')
      .all();
    expect(rows).toHaveLength(1);

    const storedFilters = JSON.parse(rows[0].filters);
    expect(storedFilters).toEqual(
      expect.objectContaining({
        source: 'reporting-v4',
        query: {
          from: '2026-02-01',
          to: '2026-02-28',
        },
        ruleId: 'legacy-kpi',
        staffKey: 'lan',
        columns: {
          items: true,
        },
      })
    );
    expect(storedFilters.staffList).toBeUndefined();
    expect(storedFilters.summary).toBeUndefined();
  });

  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi compact reporting-v4 payload khi staffKey khÃƒÆ’Ã‚Â´ng tÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i', async () => {
    seedReportingAggregateData();

    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const response = await agent.post('/api/reports/export').send({
      kind: 'staff',
      payload: {
        source: 'reporting-v4',
        query: { from: '2026-02-01', to: '2026-02-28' },
        ruleId: 'legacy-kpi',
        staffKey: 'missing-staff',
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toMatch(/nhân viên/i);

    const auditCount = getDb().prepare('SELECT COUNT(*) AS total FROM export_audit').get() || { total: 0 };
    expect(auditCount.total ?? 0).toBe(0);
  });

  it('yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc khi tra cÃƒÂ¡Ã‚Â»Ã‚Â©u lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ export', async () => {

    const res = await request(app).get('/api/reports/export/audit');

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi khi tÃƒÆ’Ã‚Â i khoÃƒÂ¡Ã‚ÂºÃ‚Â£n khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ quyÃƒÂ¡Ã‚Â»Ã‚Ân xem lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ export', async () => {

    resetDb();

    const staffAgent = request.agent(app);

    const loginRes = await staffAgent

      .post('/api/auth/login')

      .send({ username: 'nhanvien', password: '123456' });

    expect(loginRes.status).toBe(200);



    const res = await staffAgent.get('/api/reports/export/audit');

    expect(res.status).toBe(403);

    expect(res.body.ok).toBe(false);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch sÃƒÂ¡Ã‚Â»Ã‚Â­ export theo bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ lÃƒÂ¡Ã‚Â»Ã‚Âc, phÃƒÆ’Ã‚Â¢n trang vÃƒÆ’Ã‚Â  tÃƒÂ¡Ã‚Â»Ã‚Â« khÃƒÆ’Ã‚Â³a', async () => {

    resetDb();

    const db = getDb();

    const insertAudit = db.prepare(

      `INSERT INTO export_audit (

        created_at,

        issued_at,

        username,

        display_name,

        role,

        report_kind,

        filename,

        signature,

        short_signature,

        filter_summary,

        filters,

        ip_address,

        request_id,

        user_agent

      ) VALUES (

        @created_at,

        @issued_at,

        @username,

        @display_name,

        @role,

        @report_kind,

        @filename,

        @signature,

        @short_signature,

        @filter_summary,

        @filters,

        @ip_address,

        @request_id,

        @user_agent

      )`

    );



    insertAudit.run({

      created_at: '2025-03-01T03:15:00.000Z',

      issued_at: '2025-03-01T03:10:00.000Z',

      username: 'admin',

      display_name: 'QuÃƒÂ¡Ã‚ÂºÃ‚Â£n trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ viÃƒÆ’Ã‚Âªn',

      role: 'admin',

      report_kind: 'staff',

      filename: 'bao-cao-staff.xlsx',

      signature: 'SIG-001',

      short_signature: 'AA1001',

      filter_summary: 'Team 1 ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ThÃƒÆ’Ã‚Â¡ng 03/2025',

      filters: JSON.stringify({ range: { from: '2025-03-01', to: '2025-03-31' }, team: 'Team 1' }),

      ip_address: '10.0.0.1',

      request_id: 'req-001',

      user_agent: 'Vitest/1.0',

    });



    insertAudit.run({

      created_at: '2025-03-02T09:30:00.000Z',

      issued_at: '2025-03-02T09:25:00.000Z',

      username: 'lead.hoc',

      display_name: 'TrÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã…Â¸ng nhÃƒÆ’Ã‚Â³m HÃƒÂ¡Ã‚Â»Ã‚Âc',

      role: 'lead',

      report_kind: 'team',

      filename: 'bao-cao-team.xlsx',

      signature: 'SIG-002',

      short_signature: 'BB2002',

      filter_summary: 'Team 2 ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ So sÃƒÆ’Ã‚Â¡nh KPI',

      filters: JSON.stringify({ range: { from: '2025-03-01', to: '2025-03-02' }, team: 'Team 2' }),

      ip_address: '10.0.0.2',

      request_id: 'req-002',

      user_agent: 'Vitest/1.0',

    });



    insertAudit.run({

      created_at: '2025-04-01T08:00:00.000Z',

      issued_at: '2025-04-01T07:58:00.000Z',

      username: 'manager.hoainam',

      display_name: 'QuÃƒÂ¡Ã‚ÂºÃ‚Â£n lÃƒÆ’Ã‚Â½ Nam',

      role: 'manager',

      report_kind: 'staff',

      filename: 'bao-cao-thang4.xlsx',

      signature: 'SIG-003',

      short_signature: 'CC3003',

      filter_summary: 'ThÃƒÆ’Ã‚Â¡ng 04/2025',

      filters: JSON.stringify({ range: { from: '2025-04-01', to: '2025-04-30' } }),

      ip_address: '10.0.0.3',

      request_id: 'req-003',

      user_agent: 'Vitest/1.0',

    });



    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const res = await adminAgent

      .get('/api/reports/export/audit')

      .query({ from: '2025-03-01', to: '2025-03-07', limit: 2, page: 1 });



    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    expect(res.body.total).toBe(2);

    expect(res.body.entries).toHaveLength(2);

    expect(res.body.entries[0]).toMatchObject({ reportKind: 'team', shortSignature: 'BB2002' });

    expect(res.body.entries[0].filters).toMatchObject({ range: { from: '2025-03-01', to: '2025-03-02' } });

    expect(res.body.summary.byKind).toEqual(

      expect.arrayContaining([

        expect.objectContaining({ kind: 'staff', total: 1 }),

        expect.objectContaining({ kind: 'team', total: 1 }),

      ])

    );

    expect(res.body.summary.topUsers).toEqual(

      expect.arrayContaining([

        expect.objectContaining({ username: 'lead.hoc', total: 1 }),

        expect.objectContaining({ username: 'admin', total: 1 }),

      ])

    );



    const searchRes = await adminAgent

      .get('/api/reports/export/audit')

      .query({ search: 'req-002', limit: 1, page: 1 });



    expect(searchRes.status).toBe(200);

    expect(searchRes.body.ok).toBe(true);

    expect(searchRes.body.total).toBe(1);

    expect(searchRes.body.entries).toHaveLength(1);

    expect(searchRes.body.entries[0].requestId).toBe('req-002');

    expect(searchRes.body.availableKinds).toEqual(expect.arrayContaining(['staff', 'team']));

  });

  it('khong cap nhat to khai da ra soat va thong ke reviewLocked', async () => {

    sqlMock.__setMockResult([

      {

        So_tk: '888888888888',

        Ngay_dang_ky: '2025-08-11',

        MaSoThue: '8888888888',

        TenDoanhNghiep: 'CONG TY ABC',

        Loai_hinh: 'E42',

        muc_hang: 1,

        NhanVienNhap: 'Tester',

      },

    ]);



    const adminAgent = request.agent(app);

    const loginRes = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const firstRun = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-11', to: '2025-08-12', actor: 'tester' });

    expect(firstRun.status).toBe(200);



    const reviewedRow = [{

      so_tk: '888888888888',

      nhanh: '',

      date: '2025-08-11',

      mst: '8888888888',

      cong_ty: 'CONG TY ABC',

      loai_hinh: 'E42',

      nhan_vien: 'Tester',

      reviewed: true,

      reviewed_at: '2025-08-12T00:00:00Z',

    }];

    expect((await adminAgent.put('/api/storage/decl_rows_v1').send({ value: reviewedRow })).status).toBe(200);



    sqlMock.__setMockResult([

      {

        So_tk: '888888888888',

        Ngay_dang_ky: '2025-08-11',

        MaSoThue: '8888888888',

        TenDoanhNghiep: 'CONG TY ABC',

        Loai_hinh: 'E42',

        muc_hang: 2,

        NhanVienNhap: 'Khac',

      },

    ]);



    const secondRun = await adminAgent

      .post('/api/import/ecus/run')

      .send({ from: '2025-08-11', to: '2025-08-12', actor: 'tester' });



    expect(secondRun.status).toBe(200);

    expect(secondRun.body.result.imported).toBe(0);

    expect(secondRun.body.result.updated).toBe(0);

    expect(secondRun.body.result.reviewLocked).toBe(1);



    const row = getDb()

      .prepare('SELECT value FROM kv_store WHERE key = ?')

      .get('decl_rows_v1');

    const storedRows = JSON.parse(row.value);

    const target = storedRows.find(

      (entry) => entry.so_tk === '88888888888' || entry.so_tk_full === '888888888888'

    );

    expect(target).toBeDefined();

    expect(target.reviewed).toBe(true);

    expect(target.nhan_vien).toBe('Tester');

  });

  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â review-locked khi cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t tÃƒÂ¡Ã‚Â»Ã‚Â khai Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ rÃƒÆ’Ã‚Â  soÃƒÆ’Ã‚Â¡t', () => {

    clearStorageCache();

    saveDeclRows(
      [
        {
          so_tk: '00000007001',
          nhanh: '',
          date: '2025-08-15',
          mst: '0107777333',
          cong_ty: 'CÃƒÆ’Ã‚Â´ng ty KhoÃƒÆ’Ã‚Â¡ RÃƒÆ’Ã‚Â  SoÃƒÆ’Ã‚Â¡t',
          loai_hinh: 'A11',
          nhan_vien: 'NhÃƒÆ’Ã‚Â¢n viÃƒÆ’Ã‚Âªn',
        },
      ],
      { overwrite: true, actor: 'review-lock-test' }
    );

    const key = '00000007001_';
    const marked = markDeclRowsReviewed([key], { actor: 'review-lock-test' });
    expect(marked).toBe(1);

    const result = updateDeclRowFields(key, { mst: '0100000000' }, { actor: 'nhanvien' });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('review-locked');

    const logs = getAuditLogs(1);
    expect(logs[0]).toMatchObject({
      action: 'decl.update.blocked',
      detail: expect.stringContaining('Chặn cập nhật tờ khai 00000007001'),
    });

    saveDeclRows([], { overwrite: true, actor: 'review-lock-cleanup' });
    setItem(AUDIT_KEY, '[]');
  });



});



describe('Storage API', () => {

  it('yeu cau dang nhap truoc khi doc du lieu kho chia se', async () => {

    const res = await request(app).get('/api/storage/decl_rows_v1');

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('tu choi truy cap khi tai khoan khong co quyen importEdit', async () => {

    const adminAgent = request.agent(app);

    const adminLogin = await adminAgent

      .post('/api/auth/login')

      .send({ username: 'admin', password: 'admin123' });

    expect(adminLogin.status).toBe(200);



    const downgradeRes = await adminAgent

      .patch('/api/auth/accounts/nhanvien')

      .send({ permissions: { importEdit: false, importUpload: false } });

    expect(downgradeRes.status).toBe(200);



    try {

      const staffAgent = request.agent(app);

      const loginRes = await staffAgent

      .post('/api/auth/login')

      .send({ username: 'nhanvien', password: '123456' });

      expect(loginRes.status).toBe(200);



      const res = await staffAgent.get('/api/storage/decl_rows_v1');

      expect(res.status).toBe(403);

      expect(res.body.ok).toBe(false);

    } finally {

      await adminAgent

        .patch('/api/auth/accounts/nhanvien')

        .send({ permissions: { importEdit: true, importUpload: true } });

    }

  });



  it('tra ve gia tri JSON da parse cho key hop le khi co quyen', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const sampleRows = [

      { so_tk: '99999999999', nhanh: '', date: '2025-08-11', mst: '1234567890', cong_ty: 'CONG TY ABC' },

    ];

    getDb()

      .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')

      .run('decl_rows_v1', JSON.stringify(sampleRows));



    const res = await adminAgent.get('/api/storage/decl_rows_v1');

    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    expect(Array.isArray(res.body.value)).toBe(true);

    expect(res.body.value[0]).toMatchObject({ so_tk: '99999999999', cong_ty: 'CONG TY ABC' });

    expect(typeof res.body.raw).toBe('string');

  });

  it('dual-write team_roster_v1 vao bang typed roster khi cap nhat qua Storage API', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const roster = {

      version: 7,

      teams: [

        {

          name: 'Blue Team',

          members: [{ name: 'Lan' }, { id: 'custom-member', name: 'Minh', notes: 'Lead' }],

        },

      ],

    };



    const putRes = await adminAgent.put('/api/storage/team_roster_v1').send({ value: roster });

    expect(putRes.status).toBe(200);

    expect(readTeamRosterSnapshot(getDb())).toEqual({

      version: 1,

      teams: [

        {

          name: 'Blue Team',

          members: [{ name: 'Lan' }, { id: 'custom-member', name: 'Minh', notes: 'Lead' }],

        },

      ],

    });

  });

  it('dual-write cac hot-path business key vao bang typed runtime khi cap nhat qua Storage API', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const declarations = [{ so_tk: '10756284616', nhanh: 'Blue', mst: '0101234567', date: '2026-02-14' }];

    const mstRows = [{ mst: '0101234567', person_import: 'Lan', team: 'Blue Team' }];

    const rules = {

      version: 2,

      activeId: 'typed-kpi',

      sets: [{ id: 'typed-kpi', name: 'Typed KPI', groups: {} }],

    };

    const adjustments = [{ id: 'adj-typed', totalPoints: 2, status: 'approved' }];



    expect((await adminAgent.put('/api/storage/decl_rows_v1').send({ value: declarations })).status).toBe(200);

    expect((await adminAgent.put('/api/storage/mst_rows_v2').send({ value: mstRows })).status).toBe(200);

    expect((await adminAgent.put('/api/storage/kpi_rules_v2').send({ value: rules })).status).toBe(200);

    expect((await adminAgent.put('/api/storage/kpi_adjustments_v1').send({ value: adjustments })).status).toBe(200);



    expect(readDeclarationRowsSnapshot(getDb())).toEqual([
      {
        so_tk: '10756284616',
        so_tk_full: '10756284616',
        so_tk_suffix: '',
        nhanh: 'Blue',
        mst: '0101234567',
        date: '2026-02-14',
      },
    ]);

    expect(readMstAssignmentRowsSnapshot(getDb())).toEqual(mstRows);

    expect(readRuleCollectionSnapshot(getDb())).toEqual(rules);

    expect(readAdjustmentRowsSnapshot(getDb())).toEqual(adjustments);

  });

  it('dong bo reporting schedule va monthly aggregate seeds vao reporting_projections khi reset test db', async () => {
    const activeSnapshot = createStoredMonthlyAggregateSnapshot();
    const defaultSnapshot = {
      ...createStoredMonthlyAggregateSnapshot(),
      generatedAt: '2026-03-10T09:00:00.000Z',
    };

    resetDb({
      kpi_report_schedule_v1: [{ id: 'seed-schedule', name: 'Seed Schedule' }],
      kpi_reporting_monthly_aggregates_v1: activeSnapshot,
      kpi_reporting_monthly_aggregates_default_v1: defaultSnapshot,
    });

    const storedSchedules = JSON.parse(
      getDb()
        .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
        .get('kpi_report_schedule_v1')?.payload || '[]'
    );
    const storedActive = JSON.parse(
      getDb()
        .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
        .get('kpi_reporting_monthly_aggregates_v1')?.payload || 'null'
    );
    const storedDefault = JSON.parse(
      getDb()
        .prepare('SELECT payload FROM reporting_projections WHERE projection_key = ?')
        .get('kpi_reporting_monthly_aggregates_default_v1')?.payload || 'null'
    );

    expect(storedSchedules).toEqual([{ id: 'seed-schedule', name: 'Seed Schedule' }]);
    expect(storedActive).toEqual(activeSnapshot);
    expect(storedDefault).toEqual(defaultSnapshot);
  });

  it('xoa cac hot-path typed runtime tuong ung khi xoa qua Storage API', async () => {

    const adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);



    const roster = {

      version: 1,

      teams: [

        {

          name: 'Blue Team',

          members: [{ name: 'Lan' }],

        },

      ],

    };

    const declarations = [{ so_tk: '10756284616', nhanh: 'Blue', mst: '0101234567', date: '2026-02-14' }];

    const mstRows = [{ mst: '0101234567', person_import: 'Lan', team: 'Blue Team' }];

    const adjustments = [{ id: 'adj-typed', totalPoints: 2, status: 'approved' }];



    expect((await adminAgent.put('/api/storage/team_roster_v1').send({ value: roster })).status).toBe(200);

    expect((await adminAgent.put('/api/storage/decl_rows_v1').send({ value: declarations })).status).toBe(200);

    expect((await adminAgent.put('/api/storage/mst_rows_v2').send({ value: mstRows })).status).toBe(200);

    expect((await adminAgent.put('/api/storage/kpi_adjustments_v1').send({ value: adjustments })).status).toBe(200);



    expect((await adminAgent.delete('/api/storage/team_roster_v1')).status).toBe(200);

    expect((await adminAgent.delete('/api/storage/decl_rows_v1')).status).toBe(200);

    expect((await adminAgent.delete('/api/storage/mst_rows_v2')).status).toBe(200);

    expect((await adminAgent.delete('/api/storage/kpi_adjustments_v1')).status).toBe(200);



    expect(readTeamRosterSnapshot(getDb())).toBeNull();

    expect(readDeclarationRowsSnapshot(getDb())).toBeNull();

    expect(readMstAssignmentRowsSnapshot(getDb())).toBeNull();

    expect(readAdjustmentRowsSnapshot(getDb())).toBeNull();

  });

});



describe('Alert API', () => {

  const missingDecl = {

    so_tk: 'TK001',

    so_tk_full: 'TK001',

    nhanh: '',

    mst: '0100000001',

    cong_ty: 'CÃƒÆ’Ã¢â‚¬ÂNG TY MINH HÃƒÂ¡Ã‚Â»Ã…â€™A',

    date: '2000-01-01',

    raw_date: '2000-01-01',

    nhan_vien: '',

    team: '',

  };



  let adminAgent;



  beforeEach(async () => {

    adminAgent = request.agent(app);

    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);

    const putRes = await adminAgent

      .put('/api/storage/decl_rows_v1')

      .send({ value: JSON.stringify([missingDecl]) });

    expect(putRes.status).toBe(200);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi xem cÃƒÂ¡Ã‚ÂºÃ‚Â£nh bÃƒÆ’Ã‚Â¡o khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/import/alerts');

    expect(res.status).toBe(401);

    expect(res.body.ok).toBe(false);

  });



  it('trÃƒÂ¡Ã‚ÂºÃ‚Â£ vÃƒÂ¡Ã‚Â»Ã‚Â danh sÃƒÆ’Ã‚Â¡ch cÃƒÂ¡Ã‚ÂºÃ‚Â£nh bÃƒÆ’Ã‚Â¡o vÃƒÆ’Ã‚Â  cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i', async () => {

    const res = await adminAgent.get('/api/import/alerts');

    expect(res.status).toBe(200);

    expect(res.body.ok).toBe(true);

    expect(res.body.alerts.length).toBe(1);

    expect(res.body.alerts[0]).toMatchObject({ so_tk: '00000000001', resolved: false });

  });



  it('cho phÃƒÆ’Ã‚Â©p cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh cÃƒÂ¡Ã‚ÂºÃ‚Â£nh bÃƒÆ’Ã‚Â¡o vÃƒÆ’Ã‚Â  Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â¡nh dÃƒÂ¡Ã‚ÂºÃ‚Â¥u Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ rÃƒÆ’Ã‚Â  soÃƒÆ’Ã‚Â¡t', async () => {

    const configRes = await adminAgent

      .put('/api/import/alerts/config')

      .send({

        actor: 'tester',

        config: { thresholdDays: 0, channel: 'audit', enabled: true },

      });

    expect(configRes.status).toBe(200);

    expect(configRes.body.summary.outstanding).toBe(1);



    const alerts = await adminAgent.get('/api/import/alerts');

    expect(alerts.status).toBe(200);

    expect(alerts.body.ok).toBe(true);

    const key = alerts.body.alerts[0].key;



    const reviewRes = await adminAgent

      .post('/api/import/alerts/review')

      .send({ actor: 'tester', keys: [key] });

    expect(reviewRes.status).toBe(200);

    expect(reviewRes.body.updated).toBe(1);

    expect(reviewRes.body.summary.outstanding).toBe(0);

  });



  it('bo danh dau ra soat qua API', async () => {

    const configRes = await adminAgent

      .put('/api/import/alerts/config')

      .send({

        actor: 'tester',

        config: { thresholdDays: 0, channel: 'audit', enabled: true },

      });

    expect(configRes.status).toBe(200);



    const alerts = await adminAgent.get('/api/import/alerts');

    expect(alerts.body.alerts.length).toBeGreaterThan(0);

    const key = alerts.body.alerts[0].key;



    const reviewRes = await adminAgent

      .post('/api/import/alerts/review')

      .send({ actor: 'tester', keys: [key] });



    expect(reviewRes.status).toBe(200);

    expect(reviewRes.body.updated).toBe(1);



    const unreviewRes = await adminAgent

      .post('/api/import/alerts/unreview')

      .send({ actor: 'tester', keys: [key] });



    expect(unreviewRes.status).toBe(200);

    expect(unreviewRes.body.updated).toBe(1);

    expect(unreviewRes.body.summary).toBeDefined();

    expect(unreviewRes.body.summary.outstanding).toBeGreaterThan(0);

  });



  it('bÃƒÂ¡Ã‚Â»Ã‚Â qua actor do client gÃƒÂ¡Ã‚Â»Ã‚Â­i khi rÃƒÆ’Ã‚Â  soÃƒÆ’Ã‚Â¡t cÃƒÂ¡Ã‚ÂºÃ‚Â£nh bÃƒÆ’Ã‚Â¡o', async () => {

    const configRes = await adminAgent

      .put('/api/import/alerts/config')

      .send({

        actor: 'spoofed.actor',

        config: { thresholdDays: 0, channel: 'audit', enabled: true },

      });

    expect(configRes.status).toBe(200);

    const alerts = await adminAgent.get('/api/import/alerts');

    const key = alerts.body.alerts[0].key;

    const reviewRes = await adminAgent

      .post('/api/import/alerts/review')

      .send({ actor: 'spoofed.actor', keys: [key] });

    expect(reviewRes.status).toBe(200);

    const auditRow = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('audit_logs_v1');

    const logs = JSON.parse(auditRow?.value || '[]');

    const reviewLog = logs.find((entry) => entry.action === 'decl.review');

    expect(reviewLog).toBeTruthy();

    expect(reviewLog?.actor).toBe('admin');

  });

});



describe('Import read API authz', () => {

  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi tra cÃƒÂ¡Ã‚Â»Ã‚Â©u tÃƒÂ¡Ã‚Â»Ã‚Â khai khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/import/search?mst=0101234567');

    expect(res.status).toBe(401);

    expect(res.body?.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi xem cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh mÃƒÆ’Ã‚Â£ CO khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/import/co-codes');

    expect(res.status).toBe(401);

    expect(res.body?.ok).toBe(false);

  });



  it('tÃƒÂ¡Ã‚Â»Ã‚Â« chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi xem trÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i kiÃƒÂ¡Ã‚Â»Ã†â€™m tra CO khi chÃƒâ€ Ã‚Â°a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€žÃ†â€™ng nhÃƒÂ¡Ã‚ÂºÃ‚Â­p', async () => {

    const res = await request(app).get('/api/import/co-discrepancy');

    expect(res.status).toBe(401);

    expect(res.body?.ok).toBe(false);

  });

});



