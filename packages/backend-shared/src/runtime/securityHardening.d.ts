import type { RequestHandler } from 'express';

export function createSecurityMiddleware(options?: {
  isProduction?: boolean;
}): RequestHandler;

export function createLoginRateLimit(options?: {
  windowMs?: number;
  max?: number;
  message?: string;
  onLimitReached?: (req: unknown, options: unknown) => void;
}): RequestHandler;
