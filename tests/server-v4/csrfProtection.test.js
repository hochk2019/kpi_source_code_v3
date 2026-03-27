import { describe, expect, it, vi } from 'vitest';

import { createCsrfProtection } from '../../server-v4/src/app/csrfProtection.ts';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
} from '../../server-v4/src/modules/auth/authShared.ts';

describe('server-v4 csrf protection', () => {
  it('hydrates a csrf cookie for safe requests with a session cookie', () => {
    const middleware = createCsrfProtection();
    const req = createRequest({
      method: 'GET',
      cookie: `${SESSION_COOKIE_NAME}=session-1`,
    });
    const res = createResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: false,
        sameSite: 'lax',
      }),
    );
  });

  it('rejects unsafe cookie-authenticated mutations without a matching csrf token', () => {
    const middleware = createCsrfProtection();
    const req = createRequest({
      method: 'POST',
      cookie: `${SESSION_COOKIE_NAME}=session-1`,
    });
    const res = createResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: 'csrf_invalid',
        message: 'CSRF token is required for cookie-authenticated mutations.',
      },
    });
  });

  it('allows unsafe cookie-authenticated mutations with a matching csrf token', () => {
    const middleware = createCsrfProtection();
    const req = createRequest({
      method: 'PATCH',
      cookie: `${SESSION_COOKIE_NAME}=session-1; ${CSRF_COOKIE_NAME}=csrf-1`,
      headers: {
        [CSRF_HEADER_NAME]: 'csrf-1',
      },
    });
    const res = createResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips csrf enforcement for bearer-authenticated mutations without a session cookie', () => {
    const middleware = createCsrfProtection();
    const req = createRequest({
      method: 'POST',
      headers: {
        authorization: 'Bearer bridge-token',
      },
    });
    const res = createResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

function createRequest({ method, cookie = '', headers = {} }) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  if (cookie) {
    normalizedHeaders.cookie = cookie;
  }

  return {
    method,
    headers: normalizedHeaders,
    get(name) {
      return normalizedHeaders[`${name}`.toLowerCase()] ?? undefined;
    },
    secure: false,
  };
}

function createResponse() {
  const res = {
    cookie: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
