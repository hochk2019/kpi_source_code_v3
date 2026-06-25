import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

/**
 * Middleware factory that validates `req.body` against a Zod schema.
 *
 * On success: replaces `req.body` with the parsed (type-safe) data and calls next().
 * On failure: returns 400 with `VALIDATION_FAILED` code and flattened Zod error details.
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        status: 400,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request body validation failed',
          details: result.error.flatten(),
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory that validates `req.query` against a Zod schema.
 *
 * On success: replaces `req.query` with the parsed data and calls next().
 * On failure: returns 400 with `VALIDATION_FAILED` code and flattened Zod error details.
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        status: 400,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Query parameter validation failed',
          details: result.error.flatten(),
        },
      });
      return;
    }
    req.query = result.data;
    next();
  };
}
