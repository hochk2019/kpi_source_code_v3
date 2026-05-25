import { randomUUID } from 'node:crypto';

import type { DeclarationActor } from './declarationsStore.js';
import type {
  DeclarationsImportCommitRequest,
  DeclarationsImportCommitResponse,
  DeclarationsImportService,
} from './declarationsImportService.js';
import type { DeclarationsImportJobStore, StoredImportJob } from './declarationsImportJobStore.js';

const MAX_TRACKED_JOBS = 50;

export type DeclarationsImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type DeclarationsImportJobRecord = {
  id: string;
  status: DeclarationsImportJobStatus;
  actor: string;
  reason: string;
  from: string;
  to: string;
  includeTaxCodes: string[];
  excludeTaxCodes: string[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: DeclarationsImportCommitResponse | null;
  error: {
    message: string;
  } | null;
};

export class DeclarationsImportJobService {
  constructor(
    private readonly importService: DeclarationsImportService,
    private readonly store?: DeclarationsImportJobStore,
  ) {}

  async createCommitJob(
    actor: DeclarationActor,
    payload: DeclarationsImportCommitRequest,
  ): Promise<DeclarationsImportJobRecord> {
    const now = new Date().toISOString();
    const normalizedPayload = normalizeCommitPayload(payload);
    const normalizedRange = {
      from: normalizedPayload.rangeInput?.from ?? '',
      to: normalizedPayload.rangeInput?.to ?? '',
    };
    const job: StoredImportJob = {
      id: `ecus-sync-job-${randomUUID()}`,
      status: 'queued',
      actor: actor.username || 'ecus-bridge-service',
      reason: normalizedPayload.reason ?? 'manual',
      from: normalizedRange.from,
      to: normalizedRange.to,
      includeTaxCodes: normalizedPayload.includeTaxCodes ?? [],
      excludeTaxCodes: normalizedPayload.excludeTaxCodes ?? [],
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      ownerUsername: actor.username || '',
      commitPayload: normalizedPayload as unknown as Record<string, unknown>,
    };

    await this.writeJob(job);
    void this.runCommitJob(job.id, actor, normalizedPayload);
    return toPublicJob(job);
  }

  async readJob(actor: DeclarationActor, jobId: string): Promise<DeclarationsImportJobRecord | null> {
    if (!actor.permissions?.syncManage) {
      return null;
    }

    const job = await this.store?.readJob(jobId);
    if (!job) {
      return null;
    }

    return toPublicJob(job);
  }

  async listJobs(actor: DeclarationActor): Promise<DeclarationsImportJobRecord[]> {
    if (!actor.permissions?.syncManage) {
      return [];
    }

    const jobs = await this.store?.listJobs(MAX_TRACKED_JOBS);
    if (!jobs) {
      return [];
    }

    return jobs.map(toPublicJob);
  }

  private async runCommitJob(
    jobId: string,
    actor: DeclarationActor,
    payload: DeclarationsImportCommitRequest,
  ): Promise<void> {
    const queued = await this.store?.readJob(jobId);
    if (!queued) {
      return;
    }

    await this.writeJob({
      ...queued,
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
    });

    try {
      const result = await this.importService.commitEcusImport(actor, payload);
      const current = await this.store?.readJob(jobId);
      if (!current) {
        return;
      }

      await this.writeJob({
        ...current,
        status: 'completed',
        result,
        error: null,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const current = await this.store?.readJob(jobId);
      if (!current) {
        return;
      }

      await this.writeJob({
        ...current,
        status: 'failed',
        result: null,
        error: {
          message: error instanceof Error ? error.message : 'Không thể đồng bộ ECUS',
        },
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private async writeJob(job: StoredImportJob): Promise<void> {
    await this.store?.writeJob(job);
  }
}

function normalizeCommitPayload(payload: DeclarationsImportCommitRequest): DeclarationsImportCommitRequest {
  return {
    ...payload,
    rawRows: Array.isArray(payload.rawRows) ? payload.rawRows : undefined,
    fetchedTotal:
      Number.isFinite(Number(payload.fetchedTotal)) && Number(payload.fetchedTotal) >= 0
        ? Number(payload.fetchedTotal)
        : undefined,
    actor: typeof payload.actor === 'string' ? payload.actor.trim() : undefined,
    reason: typeof payload.reason === 'string' ? payload.reason.trim() : undefined,
    rangeInput: {
      from: typeof payload.rangeInput?.from === 'string' ? payload.rangeInput.from : '',
      to: typeof payload.rangeInput?.to === 'string' ? payload.rangeInput.to : '',
    },
    includeTaxCodes: Array.isArray(payload.includeTaxCodes)
      ? payload.includeTaxCodes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : undefined,
    excludeTaxCodes: Array.isArray(payload.excludeTaxCodes)
      ? payload.excludeTaxCodes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : undefined,
  };
}

function toPublicJob(job: StoredImportJob): DeclarationsImportJobRecord {
  return {
    id: job.id,
    status: job.status,
    actor: job.actor,
    reason: job.reason,
    from: job.from,
    to: job.to,
    includeTaxCodes: [...job.includeTaxCodes],
    excludeTaxCodes: [...job.excludeTaxCodes],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    result: job.result,
    error: job.error,
  };
}
