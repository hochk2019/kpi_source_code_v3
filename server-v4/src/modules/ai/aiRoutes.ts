import express, { type Request, type Response, type Router } from 'express';

import type { DomainModule } from '../../app/domain-module.js';

/**
 * Machine-readable code returned while the AI backend is not configured on this
 * runtime. The AiAssistant frontend reads the string `error` field for its
 * user-facing message, so we expose both `code` and `error` for compatibility.
 */
export const AI_NOT_CONFIGURED_CODE = 'AI_NOT_CONFIGURED';
const AI_NOT_CONFIGURED_MESSAGE = 'Trợ lý AI chưa được cấu hình trên máy chủ này.';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

function notConfigured(_req: Request, res: Response): void {
  res.status(503).json({
    ok: false,
    code: AI_NOT_CONFIGURED_CODE,
    error: AI_NOT_CONFIGURED_MESSAGE,
  });
}

/**
 * Build a thin AI router that registers every endpoint declared by the AI
 * domain module. Each endpoint responds with a structured 503 until the full
 * AI backend is reconstructed (bead cng-ai.1). Registering the routes here
 * guarantees the AiAssistant Page_Module never receives a hard
 * `ENDPOINT_NOT_FOUND` 404, satisfying the frontend coverage requirement (6.1).
 */
export function buildAiRouter(domainModule: DomainModule): Router {
  const router = express.Router();

  router.get('/__meta', (_req, res) => {
    res.json({ ok: true, module: domainModule });
  });

  for (const group of domainModule.routeGroups) {
    for (const route of group.routes) {
      const method = route.method.toLowerCase() as HttpMethod;
      router[method](route.path, notConfigured);
    }
  }

  return router;
}
