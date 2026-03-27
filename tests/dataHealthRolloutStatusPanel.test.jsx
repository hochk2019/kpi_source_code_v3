import React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DataHealthRolloutStatusPanel from '@/components/data-health-dashboard/DataHealthRolloutStatusPanel.jsx';

function createRollout() {
  return {
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
        'Re-run the QA matrix before enabling any additional `/api/v4/*` write traffic.',
      ],
    },
  };
}

describe('DataHealthRolloutStatusPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị readiness, stage, warning checks và fallback cho operator', () => {
    render(<DataHealthRolloutStatusPanel rollout={createRollout()} />);

    expect(screen.getByText('Tiến độ rollout server-v4')).toBeInTheDocument();
    expect(screen.getByText('Compatibility verification only')).toBeInTheDocument();
    expect(screen.getAllByText('Module parity').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Production cutover ready').length).toBeGreaterThan(0);
    expect(screen.getByText('monolith-legacy')).toBeInTheDocument();
    expect(screen.getByText('Declarations write gate cần giữ monolith write path')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Keep monolith `/api/*` routes as the production write path until the next gate is green.'
      )
    ).toBeInTheDocument();
  });

  it('hiển thị banner lỗi khi chưa tải được metadata rollout', () => {
    render(<DataHealthRolloutStatusPanel error="HTTP 500" />);

    expect(screen.getByText(/Không thể tải metadata rollout: HTTP 500/i)).toBeInTheDocument();
    expect(screen.queryByText('Compatibility verification only')).not.toBeInTheDocument();
  });
});
