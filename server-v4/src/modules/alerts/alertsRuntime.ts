import type { Response } from 'express';

type AlertConfig = Record<string, unknown>;
type AlertEntry = {
  key: string;
  resolved?: boolean;
  [key: string]: unknown;
};
type NotificationEntry = Record<string, unknown>;

export interface AlertsDomain {
  buildAlertPayload(): {
    alerts: AlertEntry[];
    config: AlertConfig;
    summary: {
      lastEvaluatedAt: string | null;
      outstanding: number;
      totalTracked: number;
    };
  };
  getAlertConfig(): AlertConfig;
  listNotifications(options?: { limit?: number }): NotificationEntry[];
  reviewAlerts(options: {
    actor: string;
    keys: string[];
  }): {
    summary: {
      lastEvaluatedAt: string | null;
      outstanding: number;
      totalTracked: number;
    };
    updated: number;
  };
  unreviewAlerts(options: {
    actor: string;
    keys: string[];
  }): {
    summary: {
      lastEvaluatedAt: string | null;
      outstanding: number;
      totalTracked: number;
    };
    updated: number;
  };
  updateAlertConfig(options: {
    actor: string;
    config: AlertConfig;
  }): {
    config: AlertConfig;
    summary: {
      lastEvaluatedAt: string | null;
      outstanding: number;
      totalTracked: number;
    };
  };
}

export interface AlertsRuntime {
  dispose?(): Promise<void> | void;
  domain: AlertsDomain;
  registerNotificationStream(res: Response): void;
}

type CreateAlertsRuntimeOptions = {
  domain?: AlertsDomain;
  initialAlerts?: AlertEntry[];
  initialConfig?: AlertConfig;
  initialNotifications?: NotificationEntry[];
  registerNotificationStream?: (res: Response) => void;
};

export function createAlertsRuntime(options: CreateAlertsRuntimeOptions = {}): AlertsRuntime {
  if (options.domain) {
    return {
      domain: options.domain,
      registerNotificationStream: options.registerNotificationStream ?? defaultRegisterNotificationStream,
    };
  }

  const alertsState = new Map<string, AlertEntry>();
  for (const alert of options.initialAlerts ?? []) {
    if (typeof alert?.key === 'string' && alert.key.trim()) {
      alertsState.set(alert.key, { ...alert, key: alert.key.trim() });
    }
  }

  const configState: AlertConfig = { ...(options.initialConfig ?? {}) };
  const notifications = [...(options.initialNotifications ?? [])];
  let lastEvaluatedAt: string | null = null;

  function snapshotSummary() {
    const alerts = Array.from(alertsState.values());
    return {
      outstanding: alerts.filter((entry) => !entry.resolved).length,
      totalTracked: alerts.length,
      lastEvaluatedAt,
    };
  }

  function markAlertsResolved(keys: string[], resolved: boolean): number {
    let updated = 0;
    for (const key of normalizeKeys(keys)) {
      const previous = alertsState.get(key) ?? { key, resolved: !resolved };
      if (previous.resolved === resolved) {
        alertsState.set(key, previous);
        continue;
      }

      alertsState.set(key, { ...previous, key, resolved });
      updated += 1;
    }

    if (updated > 0) {
      lastEvaluatedAt = new Date().toISOString();
    }

    return updated;
  }

  const domain: AlertsDomain = {
    buildAlertPayload: () => ({
      config: { ...configState },
      alerts: Array.from(alertsState.values()).map((entry) => ({ ...entry })),
      summary: snapshotSummary(),
    }),
    getAlertConfig: () => ({ ...configState }),
    listNotifications: ({ limit } = {}) => {
      const normalizedLimit = Number.isFinite(limit) && Number(limit) > 0 ? Math.trunc(Number(limit)) : 50;
      return notifications.slice(0, normalizedLimit).map((entry) => ({ ...entry }));
    },
    reviewAlerts: ({ keys }) => ({
      updated: markAlertsResolved(keys, true),
      summary: snapshotSummary(),
    }),
    unreviewAlerts: ({ keys }) => ({
      updated: markAlertsResolved(keys, false),
      summary: snapshotSummary(),
    }),
    updateAlertConfig: ({ config }) => {
      Object.assign(configState, config ?? {});
      lastEvaluatedAt = new Date().toISOString();
      return {
        config: { ...configState },
        summary: snapshotSummary(),
      };
    },
  };

  return {
    domain,
    registerNotificationStream: options.registerNotificationStream ?? defaultRegisterNotificationStream,
  };
}

function normalizeKeys(keys: string[]): string[] {
  const normalizedKeys = new Set<string>();
  for (const key of keys) {
    if (typeof key !== 'string') {
      continue;
    }

    const trimmed = key.trim();
    if (trimmed) {
      normalizedKeys.add(trimmed);
    }
  }

  return [...normalizedKeys];
}

function defaultRegisterNotificationStream(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream');
  res.status(200);
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  res.end();
}
