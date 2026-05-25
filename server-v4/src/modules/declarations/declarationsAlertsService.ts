import type { DeclarationsRepository } from './DeclarationsRepository.js';
import {
  buildDeclarationAlertsPayload,
  createDefaultDeclarationAlertConfig,
  createDefaultDeclarationAlertState,
  evaluateDeclarationAlerts,
  normalizeDeclarationAlertConfig,
  normalizeDeclarationAlertState,
  type DeclarationAlertConfigDocument,
  type DeclarationAlertSummary,
  type DeclarationAlertsPayload,
} from './declarationAlerts.js';
import { DeclarationsHttpError } from './declarationsService.js';
import type { DeclarationActor, DeclarationsStore } from './declarationsStore.js';

export type DeclarationsAlertMutationResponse = {
  updated: number;
  summary: DeclarationAlertSummary;
};

export class DeclarationsAlertsService {
  constructor(
    private readonly repository: DeclarationsRepository,
    private readonly store: DeclarationsStore,
  ) {}

  async listAlerts(actor: DeclarationActor): Promise<DeclarationAlertsPayload> {
    this.requireAlertsManager(actor);
    const { config, evaluation } = await this.evaluateAndPersist(actor.username, 'read');
    return buildDeclarationAlertsPayload({
      config,
      state: evaluation.state,
    });
  }

  async readAlertConfig(actor: DeclarationActor): Promise<DeclarationAlertConfigDocument> {
    this.requireAlertsManager(actor);
    return this.readConfig();
  }

  async updateAlertConfig(
    actor: DeclarationActor,
    patch: Record<string, unknown>,
  ): Promise<{
    config: DeclarationAlertConfigDocument;
    summary: DeclarationAlertSummary;
  }> {
    this.requireAlertsManager(actor);
    const current = await this.readConfig();
    const next = normalizeDeclarationAlertConfig({
      ...current,
      ...(patch ?? {}),
    });

    await this.store.writeDeclarationAlertConfig(next, actor.username);
    const { evaluation } = await this.evaluateAndPersist(actor.username, 'alert-config', next);
    return {
      config: next,
      summary: evaluation.summary,
    };
  }

  async markReviewed(
    actor: DeclarationActor,
    keys: readonly string[],
  ): Promise<DeclarationsAlertMutationResponse> {
    this.requireAlertsManager(actor);
    const normalizedKeys = normalizeAlertKeys(keys);
    const updated = await this.store.markDeclarationsReviewed(normalizedKeys, actor.username);
    const { evaluation } = await this.evaluateAndPersist(actor.username, 'manual-review');
    return {
      updated,
      summary: evaluation.summary,
    };
  }

  async unmarkReviewed(
    actor: DeclarationActor,
    keys: readonly string[],
  ): Promise<DeclarationsAlertMutationResponse> {
    this.requireAlertsManager(actor);
    const normalizedKeys = normalizeAlertKeys(keys);
    const updated = await this.store.unmarkDeclarationsReviewed(normalizedKeys, actor.username);
    const { evaluation } = await this.evaluateAndPersist(actor.username, 'manual-unreview');
    return {
      updated,
      summary: evaluation.summary,
    };
  }

  private async evaluateAndPersist(
    actor: string,
    reason: string,
    nextConfig?: DeclarationAlertConfigDocument,
  ): Promise<{
    config: DeclarationAlertConfigDocument;
    evaluation: ReturnType<typeof evaluateDeclarationAlerts>;
  }> {
    const config = nextConfig ? normalizeDeclarationAlertConfig(nextConfig) : await this.readConfig();
    const state = await this.readState();
    const rows = await this.repository.listDeclarations();
    const evaluation = evaluateDeclarationAlerts({
      rows,
      config,
      state,
    });

    await this.store.writeDeclarationAlertState(evaluation.state, actor || reason);
    return {
      config,
      evaluation,
    };
  }

  private async readConfig(): Promise<DeclarationAlertConfigDocument> {
    const stored = await this.store.readDeclarationAlertConfig();
    return stored ? normalizeDeclarationAlertConfig(stored) : createDefaultDeclarationAlertConfig();
  }

  private async readState() {
    const stored = await this.store.readDeclarationAlertState();
    return stored ? normalizeDeclarationAlertState(stored) : createDefaultDeclarationAlertState();
  }

  private requireAlertsManager(actor: DeclarationActor): void {
    if (actor.permissions?.alertsManage === true) {
      return;
    }

    throw new DeclarationsHttpError(
      403,
      'forbidden',
      'Tài khoản hiện không có quyền quản lý cảnh báo tờ khai.',
    );
  }
}

function normalizeAlertKeys(keys: readonly string[]): string[] {
  if (!Array.isArray(keys)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const key of keys) {
    const next = `${key ?? ''}`.trim();
    if (!next || seen.has(next)) {
      continue;
    }

    seen.add(next);
    normalized.push(next);
  }

  return normalized;
}
