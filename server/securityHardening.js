import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

const DEFAULT_LOGIN_LIMIT_MESSAGE = 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.';

export function createSecurityMiddleware({ isProduction = process.env.NODE_ENV === 'production' } = {}) {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: isProduction ? undefined : false,
  });
}

export function createLoginRateLimit({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = DEFAULT_LOGIN_LIMIT_MESSAGE,
  onLimitReached,
} = {}) {
  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, _next, options) => {
      if (typeof onLimitReached === 'function') {
        onLimitReached(req, options);
      }
      res.status(options.statusCode).json({
        ok: false,
        error: message,
      });
    },
  });
}
