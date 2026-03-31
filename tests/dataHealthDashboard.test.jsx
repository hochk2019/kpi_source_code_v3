import React from 'react';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rolloutPanelSpy } = vi.hoisted(() => ({
  rolloutPanelSpy: vi.fn(),
}));

vi.mock('@/lib/notificationClient.js', () => ({
  fetchNotificationHistory: vi.fn(async () => []),
  subscribeNotificationStream: vi.fn(() => () => {}),
}));

vi.mock('@/components/data-health-dashboard/DataHealthRolloutStatusPanel.jsx', () => ({
  default: (props) => {
    rolloutPanelSpy(props);
    return (
      <div data-testid="rollout-panel-probe">
        <span>{props.loading ? 'loading' : 'loaded'}</span>
        <span>{props.rollout?.rollout?.declarationCutover?.writePath ?? 'no-write-path'}</span>
      </div>
    );
  },
}));

import DataHealthDashboard from '@/components/DataHealthDashboard.jsx';
import * as auth from '@/auth/localAuth.js';

function createJsonResponse(payload) {
  return {
    ok: true,
    json: async () => payload,
  };
}

function createSummaryPayload() {
  return {
    ok: true,
    summary: {
      sync: {
        lastStatus: 'OK',
        lastRunAt: '2026-03-27T09:25:00.000Z',
        lastSummary: {
          rowsFetched: 12,
          rowsInserted: 4,
          rowsUpdated: 3,
        },
      },
      alerts: {
        recent: [],
      },
      duplicates: {
        groups: [],
      },
      sqlServer: {
        timeoutEvents: [],
        health: {
          ok: true,
          state: 'healthy',
        },
      },
      storage: {
        backup: {},
        database: {},
        disk: {},
        health: {},
      },
      notifications: [],
    },
  };
}

function createRolloutPayload() {
  return {
    ok: true,
    generatedAt: '2026-03-27T09:30:00.000Z',
    persistence: {
      source: 'dual-write',
    },
    health: {
      readiness: {
        state: 'degraded',
        label: 'Compatibility verification only',
        detail: 'Legacy compat traffic vẫn đang được quan sát trước cutover.',
      },
    },
    migrationVerification: {
      checks: [
        {
          id: 'implemented-module-coverage',
          status: 'pass',
          summary: 'Module coverage đủ rộng cho rollout',
          detail: 'Tất cả module catalog đã có runtime routes.',
        },
        {
          id: 'declarations-write-cutover-policy',
          status: 'warn',
          summary: 'Declarations write gate cần giữ monolith write path',
          detail: 'Write path vẫn phải giữ ở monolith-legacy cho đến khi gate xanh.',
        },
      ],
    },
    rollout: {
      currentStage: 'module-parity',
      recommendedNextStage: 'cutover-ready',
      stages: [
        {
          id: 'baseline-health',
          label: 'Compatibility baseline',
          status: 'ready',
          gate: 'DB legacy có thể đọc và runtime health có thể quan sát.',
        },
        {
          id: 'module-parity',
          label: 'Module parity',
          status: 'ready',
          gate: 'Các module v4 đã có đủ read/write surface cần thiết.',
        },
        {
          id: 'cutover-ready',
          label: 'Production cutover ready',
          status: 'hold',
          gate: 'Cần green declaration cutover gate trước khi đổi write path.',
        },
      ],
      declarationCutover: {
        writePath: 'monolith-legacy',
        operatorAction: 'Giữ write path hiện tại và tiếp tục shadow verification',
      },
      fallback: [
        'Keep monolith `/api/*` routes as the production write path until the next gate is green.',
      ],
    },
  };
}

describe('DataHealthDashboard rollout integration', () => {
  let fetchSpy;

  beforeEach(() => {
    rolloutPanelSpy.mockReset();
    fetchSpy = vi.spyOn(auth, 'fetchWithAuth').mockImplementation(async (url) => {
      if (url === '/api/v4/data-health/summary') {
        return createJsonResponse(createSummaryPayload());
      }

      if (url === '/api/v4/meta/rollout') {
        return createJsonResponse(createRolloutPayload());
      }

      if (url === '/api/v4/duplicate-policy') {
        return createJsonResponse({
          ok: true,
          config: null,
          state: null,
          summary: null,
        });
      }

      throw new Error(`Unexpected fetchWithAuth call: ${url}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('fetches rollout metadata and renders the operator-facing rollout panel', async () => {
    render(
      <DataHealthDashboard
        currentUser={{ username: 'operator', fullName: 'Operator A' }}
        canManage={false}
      />
    );

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v4/meta/rollout',
        expect.objectContaining({ cache: 'no-store' })
      )
    );

    expect(await screen.findByTestId('rollout-panel-probe')).toBeInTheDocument();
    expect(await screen.findByText('monolith-legacy')).toBeInTheDocument();
    expect(await screen.findByText('Hiệu năng frontend')).toBeInTheDocument();

    await waitFor(() => {
      expect(rolloutPanelSpy).toHaveBeenCalled();
      const latestProps = rolloutPanelSpy.mock.calls.at(-1)?.[0];
      expect(latestProps).toEqual(
        expect.objectContaining({
          loading: false,
          error: '',
          rollout: expect.objectContaining({
            persistence: expect.objectContaining({ source: 'dual-write' }),
            rollout: expect.objectContaining({
              currentStage: 'module-parity',
              declarationCutover: expect.objectContaining({ writePath: 'monolith-legacy' }),
            }),
          }),
        })
      );
    });
  });
});
