import type { Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../../http/BaseController.js';
import type { AuthStore } from '../auth/authStore.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import { ReportingService } from './reportingService.js';

class ReportingHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const reportingQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  ruleId: z.string().trim().optional(),
  limit: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : value),
      z.coerce.number().int().positive().max(500).optional()
    ),
});

const schedulesQuerySchema = z.object({
  asOf: z.string().trim().optional(),
});

const observabilityQuerySchema = z.object({
  jobSearch: z.string().trim().optional(),
  jobStatus: z.string().trim().optional(),
  jobPage: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : value),
      z.coerce.number().int().positive().optional()
    ),
  jobPageSize: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : value),
      z.coerce.number().int().positive().max(100).optional()
    ),
  periodSearch: z.string().trim().optional(),
  periodPage: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : value),
      z.coerce.number().int().positive().optional()
    ),
  periodPageSize: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : value),
      z.coerce.number().int().positive().max(100).optional()
    ),
});

const scheduleMutationSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().optional(),
  frequency: z.enum(['weekly', 'monthly']).optional(),
  time: z.string().trim().optional(),
  dayOfWeek: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : value),
      z.coerce.number().int().min(1).max(7).nullable().optional()
    ),
  dayOfMonth: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : value),
      z.coerce.number().int().min(1).max(31).nullable().optional()
    ),
  recipients: z.union([z.array(z.string()), z.string()]).optional(),
  formats: z.union([z.array(z.string()), z.string()]).optional(),
  deliveryChannels: z.union([z.array(z.string()), z.string()]).optional(),
  deliveryStatus: z.string().trim().optional(),
  lastDeliveryAt: z.string().trim().optional(),
  lastDeliveryError: z.string().trim().optional(),
  active: z.union([z.boolean(), z.string()]).optional(),
  lastRun: z.string().trim().optional(),
  nextRun: z.string().trim().optional(),
});

export class ReportingController extends BaseController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly authStore?: AuthStore,
  ) {
    super();
  }

  private async readActor(req: Request): Promise<{ username: string; role: string; permissions: Record<string, boolean> }> {
    const account = await readSessionAccount(this.authStore, readSessionTokenFromRequest(req));
    if (!account) {
      throw new ReportingHttpError(401, 'auth_required', 'Bạn cần đăng nhập để xem báo cáo.');
    }
    return { username: account.username, role: account.role, permissions: account.permissions };
  }

  private handleReportingError(error: unknown, res: Response, context: string): void {
    if (error instanceof ReportingHttpError) {
      res.status(error.statusCode).json({
        ok: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    this.handleError(error, res, context);
  }

  async getView(req: Request, res: Response): Promise<void> {
    try {
      await this.readActor(req);
      const query = reportingQuerySchema.parse({
        from: pickQueryValue(req.query.from),
        to: pickQueryValue(req.query.to),
        ruleId: pickQueryValue(req.query.ruleId),
        limit: pickQueryValue(req.query.limit),
      });
      const payload = await this.reportingService.getView(query);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleReportingError(error, res, 'build reporting view');
    }
  }

  async getMonthlyAggregates(req: Request, res: Response): Promise<void> {
    try {
      await this.readActor(req);
      const query = reportingQuerySchema.parse({
        from: pickQueryValue(req.query.from),
        to: pickQueryValue(req.query.to),
        limit: pickQueryValue(req.query.limit),
      });
      const payload = await this.reportingService.getMonthlyAggregates(query);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleReportingError(error, res, 'list monthly reporting aggregates');
    }
  }

  async getObservability(req: Request, res: Response): Promise<void> {
    try {
      await this.readActor(req);
      const query = observabilityQuerySchema.parse({
        jobSearch: pickQueryValue(req.query.jobSearch),
        jobStatus: pickQueryValue(req.query.jobStatus),
        jobPage: pickQueryValue(req.query.jobPage),
        jobPageSize: pickQueryValue(req.query.jobPageSize),
        periodSearch: pickQueryValue(req.query.periodSearch),
        periodPage: pickQueryValue(req.query.periodPage),
        periodPageSize: pickQueryValue(req.query.periodPageSize),
      });
      const payload = await this.reportingService.getObservability(query);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleReportingError(error, res, 'read reporting observability');
    }
  }

  async listSchedules(req: Request, res: Response): Promise<void> {
    try {
      await this.readActor(req);
      const query = schedulesQuerySchema.parse({
        asOf: pickQueryValue(req.query.asOf),
      });
      const payload = await this.reportingService.listSchedules(query);
      this.handleSuccess(res, payload);
    } catch (error) {
      this.handleReportingError(error, res, 'list report schedules');
    }
  }

  async saveSchedule(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      if (!actor.permissions.reportsExport && !actor.permissions.accountManage) {
        throw new ReportingHttpError(403, 'forbidden', 'Bạn không có quyền quản lý lịch báo cáo.');
      }
      const payload = scheduleMutationSchema.parse(req.body ?? {});
      const result = await this.reportingService.saveSchedule(payload);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleReportingError(error, res, 'save report schedule');
    }
  }

  async deleteSchedule(req: Request, res: Response): Promise<void> {
    try {
      const actor = await this.readActor(req);
      if (!actor.permissions.reportsExport && !actor.permissions.accountManage) {
        throw new ReportingHttpError(403, 'forbidden', 'Bạn không có quyền quản lý lịch báo cáo.');
      }
      const id = pickQueryValue(req.params.id);
      const result = await this.reportingService.deleteSchedule(typeof id === 'string' ? id : '');
      if (!result.deleted) {
        res.status(404).json({
          ok: false,
          error: {
            code: 'not_found',
            message: 'Failed to delete report schedule.',
          },
        });
        return;
      }

      this.handleSuccess(res, result);
    } catch (error) {
      this.handleReportingError(error, res, 'delete report schedule');
    }
  }
}

function pickQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}
