import type { Request, Response } from 'express';

export interface StorageRouteControllerOptions {
  getValue: (key: string) => string | null | undefined;
  safeParse: (value: unknown, fallback: unknown) => unknown;
  storageRouteRuntime: {
    putStorageValue(key: string, value: unknown, options?: { actor?: string; source?: string }): unknown;
    patchDeclarationRows(
      updates: unknown[],
      options?: { actor?: string; source?: string },
    ): { ok: boolean; invalidCurrentData?: boolean; updated?: number; totalStored?: number };
    deleteStorageValue(key: string, options?: { actor?: string; source?: string }): unknown;
  };
  getSessionContext: (req: Request) => Record<string, unknown> | null;
  resolveActor: (req: Request) => string;
  permissionRequirements: Record<string, string>;
  reportScheduleStorageKey: string;
}

export interface StorageRouteController {
  getStorageValue(req: Request, res: Response): void;
  putStorageValue(req: Request, res: Response): void;
  patchStorageValue(req: Request, res: Response): void;
  deleteStorageValue(req: Request, res: Response): void;
}

export function createStorageRouteController(options: StorageRouteControllerOptions): StorageRouteController;
