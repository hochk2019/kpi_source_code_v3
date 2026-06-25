import { createDomainModule } from '../create-domain-module.js';

/**
 * AI Assistant domain module descriptor.
 *
 * The full AI backend (provider dispatch, KPI snapshot builder, insights
 * generation, cache + chat-history persistence) was removed together with the
 * legacy `server/` directory. Until it is reconstructed, this module is wired
 * with a thin router (see `aiRoutes.ts`) that registers every endpoint the
 * AiAssistant Page_Module calls and returns a structured `AI_NOT_CONFIGURED`
 * (503) response. This guarantees full frontend endpoint coverage (no hard
 * `ENDPOINT_NOT_FOUND` 404s) and a consistent contract for the UI to degrade
 * against. Full reconstruction is tracked under bead cng-ai.1.
 */
export const aiModule = createDomainModule({
  id: 'ai',
  basePath: '/api/v4/ai',
  description:
    'AI assistant configuration, chat, KPI snapshot, and insight endpoints consumed by the AiAssistant Page_Module.',
  schemaTargets: [
    'ai_provider_config_v1',
    'ai_usage_cache_v1',
    'ai_snapshot_history_v1',
    'ai_insights_v1',
  ],
  routeGroups: [
    {
      name: 'config',
      routes: [
        { method: 'GET', path: '/profile', purpose: 'Read the AI assistant availability profile.' },
        { method: 'GET', path: '/config', purpose: 'Read the AI provider configuration.' },
        { method: 'PUT', path: '/config', purpose: 'Update the AI provider configuration.' },
        { method: 'DELETE', path: '/cache', purpose: 'Clear the AI usage cache.' },
      ],
    },
    {
      name: 'providers',
      routes: [
        { method: 'POST', path: '/providers/test', purpose: 'Test connectivity for a candidate AI provider.' },
        { method: 'POST', path: '/providers/ping', purpose: 'Ping the active AI provider connection.' },
      ],
    },
    {
      name: 'conversation',
      routes: [
        { method: 'POST', path: '/chat', purpose: 'Request an AI chat completion.' },
        { method: 'GET', path: '/history', purpose: 'Read the AI chat history for the current account.' },
        { method: 'PUT', path: '/history', purpose: 'Persist the AI chat history for the current account.' },
        { method: 'DELETE', path: '/history', purpose: 'Clear the AI chat history for the current account.' },
      ],
    },
    {
      name: 'snapshot',
      routes: [
        { method: 'GET', path: '/data/snapshot', purpose: 'Build or read a KPI data snapshot for the AI assistant.' },
        { method: 'GET', path: '/data/snapshot/history', purpose: 'List recent KPI snapshot history entries.' },
        { method: 'GET', path: '/data/snapshot/history/:id', purpose: 'Read a stored KPI snapshot history entry.' },
      ],
    },
    {
      name: 'insights',
      routes: [
        { method: 'GET', path: '/insights', purpose: 'List generated AI insights and metadata.' },
        { method: 'POST', path: '/insights/run', purpose: 'Trigger AI insight generation.' },
        { method: 'POST', path: '/insights/feedback', purpose: 'Submit feedback for an AI insight.' },
        { method: 'PUT', path: '/insights/settings', purpose: 'Update AI insight generation settings.' },
      ],
    },
  ],
});
