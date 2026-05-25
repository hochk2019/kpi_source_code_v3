import type { Response } from 'express';
import { ZodError } from 'zod';

export abstract class BaseController {
  protected handleSuccess<T>(res: Response, data: T, statusCode = 200): void {
    res.status(statusCode).json({ ok: true, data });
  }

  protected handleError(error: unknown, res: Response, context: string): void {
    if (error instanceof ZodError) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'validation_error',
          message: `Invalid request for ${context}.`,
          details: error.flatten(),
        },
      });
      return;
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'internal_error',
        message: `Failed to ${context}.`,
      },
    });
  }
}
