import type { DeclarationsImportJobRecord, DeclarationsImportJobStatus } from './declarationsImportJobService.js';

export type StoredImportJob = DeclarationsImportJobRecord & {
  ownerUsername: string;
  commitPayload: Record<string, unknown> | null;
};

export interface DeclarationsImportJobStore {
  writeJob(job: StoredImportJob): Promise<void>;
  readJob(id: string): Promise<StoredImportJob | null>;
  listJobs(limit?: number): Promise<StoredImportJob[]>;
  deleteJob(id: string): Promise<void>;
}
