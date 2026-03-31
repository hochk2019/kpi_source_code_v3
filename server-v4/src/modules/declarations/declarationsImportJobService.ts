import { randomUUID } from 'node:crypto';

import type { DeclarationActor } from './declarationsStore.js';
import type {
  DeclarationsImportCommitRequest,
  DeclarationsImportCommitResponse,
  DeclarationsImportService,
} from './declarationsImportService.js';

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

type StoredJob = DeclarationsImportJobRecord & {
  ownerUsername: string;
};

export class DeclarationsImportJobService {
  private readonly jobs = new Map<string, StoredJob>();

  private readonly orderedIds: string[] = [];

  constructor(private readonly importService: DeclarationsImportService) {}

  createCommitJob(
    actor: DeclarationActor,
    payload: DeclarationsImportCommitRequest,
  ): DeclarationsImportJobRecord {
    const now = new Date().toISOString();
    const normalizedPayload = normalizeCommitPayload(payload);
    const normalizedRange = {
      from: normalizedPayload.rangeInput?.from ?? '',
      to: normalizedPayload.rangeInput?.to ?? '',
    };
    const job: StoredJob = {
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
    };

    this.writeJob(job);
    void this.runCommitJob(job.id, actor, normalizedPayload);
    return toPublicJob(job);
  }

  readJob(actor: DeclarationActor, jobId: string): DeclarationsImportJobRecord | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    // Sync managers can inspect all jobs to support handoff during operations.
    if (!actor.permissions?.syncManage) {
      return null;
    }

    return toPublicJob(job);
  }

  private async runCommitJob(
    jobId: string,
    actor: DeclarationActor,
    payload: DeclarationsImportCommitRequest,
  ): Promise<void> {
    const queued = this.jobs.get(jobId);
    if (!queued) {
      return;
    }

    this.writeJob({
      ...queued,
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
    });

    try {
      const result = await this.importService.commitEcusImport(actor, payload);
      const current = this.jobs.get(jobId);
      if (!current) {
        return;
      }

      this.writeJob({
        ...current,
        status: 'completed',
        result,
        error: null,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const current = this.jobs.get(jobId);
      if (!current) {
        return;
      }

      this.writeJob({
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

  private writeJob(job: StoredJob): void {
    this.jobs.set(job.id, job);

    const existingIndex = this.orderedIds.findIndex((id) => id === job.id);
    if (existingIndex >= 0) {
      this.orderedIds.splice(existingIndex, 1);
    }
    this.orderedIds.unshift(job.id);

    while (this.orderedIds.length > MAX_TRACKED_JOBS) {
      const removed = this.orderedIds.pop();
      if (!removed) {
        break;
      }
      this.jobs.delete(removed);
    }
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

function toPublicJob(job: StoredJob): DeclarationsImportJobRecord {
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
