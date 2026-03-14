import type { Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../../http/BaseController.js';
import { MstAssignmentsService } from './mstAssignmentsService.js';

const listAssignmentsQuerySchema = z.object({
  mst: z.string().trim().optional(),
});

const resolveAssignmentQuerySchema = z.object({
  mst: z.string().trim().min(1),
  date: z.string().trim().optional(),
});

export class MstAssignmentsController extends BaseController {
  constructor(private readonly mstAssignmentsService: MstAssignmentsService) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = listAssignmentsQuerySchema.parse(req.query);
      const response = await this.mstAssignmentsService.listAssignments(query);
      this.handleSuccess(res, response);
    } catch (error) {
      this.handleError(error, res, 'list mst assignments');
    }
  }

  async resolve(req: Request, res: Response): Promise<void> {
    try {
      const query = resolveAssignmentQuerySchema.parse(req.query);
      const response = await this.mstAssignmentsService.resolveAssignment(query);
      this.handleSuccess(res, response);
    } catch (error) {
      this.handleError(error, res, 'resolve mst assignment');
    }
  }
}
