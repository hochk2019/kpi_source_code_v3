import { normalizeStr } from '../../legacy/legacy-normalizers.js';
import {
  createDefaultCoCodeConfig,
  createDefaultCoDiscrepancyConfig,
  createDefaultCoDiscrepancyState,
  normalizeCoCodeConfig,
  normalizeCoDiscrepancyConfig,
  normalizeCoDiscrepancyState,
  type CoCodeConfigDocument,
  type CoDiscrepancyConfigDocument,
  type CoDiscrepancyStateDocument,
} from './declarationCoMonitoring.js';
import type { DeclarationsRepository } from './DeclarationsRepository.js';
import type { DeclarationsImportService } from './declarationsImportService.js';
import { DeclarationsHttpError } from './declarationsService.js';
import type { DeclarationActor, DeclarationImportRange, DeclarationsStore } from './declarationsStore.js';
import type { CoDiscrepancyRunner } from './ecusCoDiscrepancyRunner.js';

export class DeclarationsCoMonitoringService {
  constructor(
    private readonly repository: DeclarationsRepository,
    private readonly importService: DeclarationsImportService,
    private readonly store: DeclarationsStore,
    private readonly runner: CoDiscrepancyRunner,
  ) {}

  async readCoCodeConfig(actor: DeclarationActor): Promise<CoCodeConfigDocument> {
    this.requireSyncManager(actor);
    return this.readCoCodeConfigInternal();
  }

  async updateCoCodeConfig(
    actor: DeclarationActor,
    patch: Record<string, unknown>,
  ): Promise<CoCodeConfigDocument> {
    this.requireSyncManager(actor);
    const current = await this.readCoCodeConfigInternal();
    const next = normalizeCoCodeConfig({
      ...current,
      ...(patch ?? {}),
      updatedAt: new Date().toISOString(),
      updatedBy: actor.username,
    });
    return this.store.writeCoCodeConfig(next, actor.username);
  }

  async readCoDiscrepancy(actor: DeclarationActor): Promise<{
    config: CoDiscrepancyConfigDocument;
    state: CoDiscrepancyStateDocument;
  }> {
    this.requireSyncManager(actor);
    const [config, state] = await Promise.all([
      this.readCoDiscrepancyConfigInternal(),
      this.readCoDiscrepancyStateInternal(),
    ]);

    return {
      config,
      state,
    };
  }

  async updateCoDiscrepancyConfig(
    actor: DeclarationActor,
    patch: Record<string, unknown>,
  ): Promise<CoDiscrepancyConfigDocument> {
    this.requireSyncManager(actor);
    const current = await this.readCoDiscrepancyConfigInternal();
    const next = normalizeCoDiscrepancyConfig({
      ...current,
      ...(patch ?? {}),
      updatedAt: new Date().toISOString(),
      updatedBy: actor.username,
    });
    return this.store.writeCoDiscrepancyConfig(next, actor.username);
  }

  async runCoDiscrepancy(
    actor: DeclarationActor,
    input: {
      rangeInput?: {
        from?: string;
        to?: string;
      };
      reason?: string;
    } = {},
  ): Promise<{
    config: CoDiscrepancyConfigDocument;
    state: CoDiscrepancyStateDocument;
  }> {
    this.requireSyncManager(actor);
    const config = await this.readCoDiscrepancyConfigInternal();
    const effectiveRange = buildEffectiveRange(input.rangeInput, config.rangeDays);
    const reason = normalizeStr(input.reason) || 'manual';
    const sampleLimit = normalizeNonNegativeInteger(config.sampleLimit);
    const startedAt = Date.now();

    try {
      const remoteSnapshot = await this.runner.fetch(effectiveRange, {
        limit: sampleLimit,
      });
      const preview = await this.importService.previewEcusImport(actor, {
        rawRows: remoteSnapshot.rawRows,
        rangeInput: remoteSnapshot.range,
      });
      const storedRows = await this.repository.listDeclarations();
      const storedMap = new Map<string, Record<string, unknown>>();
      for (const row of storedRows) {
        if (row.key) {
          storedMap.set(row.key, row);
        }
      }

      const mismatches: Array<Record<string, unknown>> = [];
      for (const row of preview.rows) {
        const key = readDeclarationKey(row);
        if (!key) {
          continue;
        }

        const stored = storedMap.get(key);
        if (!stored) {
          continue;
        }

        const storedCount = readCoLineCount(stored);
        const remoteCount = readCoLineCount(row);
        const storedHasCo = readHasCo(stored, storedCount);
        const remoteHasCo = readHasCo(row, remoteCount);
        if (storedCount === remoteCount && storedHasCo === remoteHasCo) {
          continue;
        }

        mismatches.push({
          key,
          so_tk: normalizeStr(row.so_tk),
          so_tk_full: normalizeStr(row.so_tk_full) || normalizeStr(row.so_tk),
          nhanh: normalizeStr(row.nhanh ?? row.branch),
          stored: {
            co_line_count: storedCount,
            has_co: storedHasCo,
            co: normalizeStr(stored.co),
            co_codes: normalizeStringArray(stored.co_codes),
          },
          remote: {
            co_line_count: remoteCount,
            has_co: remoteHasCo,
            co: normalizeStr(row.co),
            co_codes: normalizeStringArray(row.co_codes),
          },
        });
      }

      const state = normalizeCoDiscrepancyState({
        lastRunAt: new Date().toISOString(),
        range: remoteSnapshot.range,
        mismatchCount: mismatches.length,
        totalChecked: preview.rows.length,
        status: 'ok',
        error: null,
        durationMs: Date.now() - startedAt,
        mismatches: mismatches.slice(0, 200),
        triggered: mismatches.length >= config.threshold,
        limited: remoteSnapshot.limited || preview.limited,
        actor: actor.username,
        reason,
      });

      return {
        config,
        state: await this.store.writeCoDiscrepancyState(state, actor.username),
      };
    } catch (error) {
      const failureState = normalizeCoDiscrepancyState({
        lastRunAt: new Date().toISOString(),
        range: effectiveRange,
        mismatchCount: 0,
        totalChecked: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startedAt,
        mismatches: [],
        triggered: false,
        limited: false,
        actor: actor.username,
        reason,
      });
      await this.store.writeCoDiscrepancyState(failureState, actor.username);
      throw error;
    }
  }

  private async readCoCodeConfigInternal(): Promise<CoCodeConfigDocument> {
    const stored = await this.store.readCoCodeConfig();
    return stored ? normalizeCoCodeConfig(stored) : createDefaultCoCodeConfig();
  }

  private async readCoDiscrepancyConfigInternal(): Promise<CoDiscrepancyConfigDocument> {
    const stored = await this.store.readCoDiscrepancyConfig();
    return stored ? normalizeCoDiscrepancyConfig(stored) : createDefaultCoDiscrepancyConfig();
  }

  private async readCoDiscrepancyStateInternal(): Promise<CoDiscrepancyStateDocument> {
    const stored = await this.store.readCoDiscrepancyState();
    return stored ? normalizeCoDiscrepancyState(stored) : createDefaultCoDiscrepancyState();
  }

  private requireSyncManager(actor: DeclarationActor): void {
    if (actor.permissions?.syncManage === true) {
      return;
    }

    throw new DeclarationsHttpError(
      403,
      'forbidden',
      'Tài khoản hiện không có quyền quản lý đồng bộ ECUS.',
    );
  }
}

function buildEffectiveRange(
  input: { from?: string; to?: string } | null | undefined,
  rangeDays: number,
): DeclarationImportRange {
  const from = normalizeStr(input?.from);
  const to = normalizeStr(input?.to);
  if (from || to) {
    return { from, to };
  }

  const days = Math.max(1, normalizeNonNegativeInteger(rangeDays) || 1);
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    from: toDateOnly(start),
    to: toDateOnly(end),
  };
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeNonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function readDeclarationKey(row: Record<string, unknown> | null | undefined): string {
  const directKey = normalizeStr(row?.key);
  if (directKey) {
    return directKey;
  }

  const soTk = normalizeStr(row?.so_tk);
  const nhanh = normalizeStr(row?.nhanh ?? row?.branch);
  return soTk ? `${soTk}_${nhanh}` : '';
}

function readCoLineCount(row: Record<string, unknown> | null | undefined): number {
  const parsed = Number(row?.co_line_count);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function readHasCo(row: Record<string, unknown> | null | undefined, lineCount: number): boolean {
  if (row?.has_co === true) {
    return true;
  }

  return lineCount > 0 || normalizeStr(row?.co) === 'Có';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeStr(entry))
    .filter(Boolean);
}
