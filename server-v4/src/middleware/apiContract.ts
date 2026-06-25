import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiErrorResponse {
  status: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_VERSION = process.env.KPI_API_VERSION ?? '4.1.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the "module" segment from a request path.
 * Expects paths like /api/v4/{module}/... — returns the module name or "unknown".
 */
export function extractModuleName(path: string): string {
  const match = path.match(/^\/api\/v4\/([^/]+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Build a structured ApiErrorResponse payload.
 */
export function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  const body: ApiErrorResponse = {
    status,
    error: { code, message },
  };
  if (details !== undefined) {
    body.error.details = details;
  }
  return body;
}

// ---------------------------------------------------------------------------
// Middleware: API Version + Module Headers
// ---------------------------------------------------------------------------

/**
 * Adds `X-API-Version` and `X-API-Module` headers to every response.
 * Mount this BEFORE route handlers.
 */
export function apiVersionHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-API-Version', API_VERSION);
  res.setHeader('X-API-Module', extractModuleName(req.path));
  next();
}

// ---------------------------------------------------------------------------
// Middleware: 404 Catch-All
// ---------------------------------------------------------------------------

/**
 * Returns a structured 404 for any request that did not match a route.
 * Mount this AFTER all route handlers.
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  const body = buildErrorResponse(
    404,
    'ENDPOINT_NOT_FOUND',
    `No endpoint matches ${req.method} ${req.path}`,
  );
  res.status(404).json(body);
}

// ---------------------------------------------------------------------------
// Middleware: Error Formatter
// ---------------------------------------------------------------------------

/**
 * Wraps unhandled errors into the ApiErrorResponse shape.
 * Mount this AFTER all route handlers and the 404 handler.
 */
export function errorFormatter(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  if (err && typeof err === 'object') {
    const errRecord: Record<string, unknown> = err as never;
    if (typeof errRecord.status === 'number') {
      status = errRecord.status;
    }
    if (typeof errRecord.code === 'string') {
      code = errRecord.code;
    }
    if ('message' in errRecord && typeof errRecord.message === 'string') {
      message = errRecord.message;
    }
    if ('details' in errRecord && errRecord.details !== undefined) {
      details = errRecord.details;
    }
  }

  const body = buildErrorResponse(status, code, message, details);
  res.status(status).json(body);
}
