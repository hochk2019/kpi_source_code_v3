import type { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
    windowMs?: number;
    max?: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}

export function createLoginRateLimit(options?: RateLimitOptions): (req: Request, res: Response, next: NextFunction) => void;
export function createSecurityMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
