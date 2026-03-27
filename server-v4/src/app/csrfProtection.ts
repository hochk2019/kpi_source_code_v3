import type { Request, RequestHandler, Response } from 'express';

import {
  createCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  getRequestCookies,
  SESSION_COOKIE_NAME,
  setCsrfCookie,
} from '../modules/auth/authShared.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isSafeMethod(method: string | undefined): boolean {
  return SAFE_METHODS.has(`${method ?? ''}`.trim().toUpperCase());
}

function hasBearerAuthorization(req: Request): boolean {
  const authorization = req.get('authorization') ?? '';
  return authorization.trim().toLowerCase().startsWith('bearer ');
}

function readCsrfHeader(req: Request): string {
  return `${req.get(CSRF_HEADER_NAME) ?? ''}`.trim();
}

function rejectInvalidCsrf(res: Response): void {
  res.status(403).json({
    ok: false,
    error: {
      code: 'csrf_invalid',
      message: 'CSRF token is required for cookie-authenticated mutations.',
    },
  });
}

export function createCsrfProtection(): RequestHandler {
  return (req, res, next) => {
    const cookies = getRequestCookies(req);
    const sessionToken = cookies[SESSION_COOKIE_NAME] ?? '';
    const csrfCookie = cookies[CSRF_COOKIE_NAME] ?? '';

    if (!sessionToken) {
      next();
      return;
    }

    if (!csrfCookie) {
      setCsrfCookie(req, res, createCsrfToken());
    }

    if (isSafeMethod(req.method)) {
      next();
      return;
    }

    if (hasBearerAuthorization(req)) {
      next();
      return;
    }

    const csrfHeader = readCsrfHeader(req);
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      rejectInvalidCsrf(res);
      return;
    }

    next();
  };
}
