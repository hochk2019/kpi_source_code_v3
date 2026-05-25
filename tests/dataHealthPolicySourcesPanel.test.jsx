import React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DataHealthPolicySourcesPanel from '@/components/data-health-dashboard/DataHealthPolicySourcesPanel.jsx';

function createProps(overrides = {}) {
  return {
    statusSummary: {
      awaitingActionLabel: 5,
      pendingReviewLabel: 2,
      lockedLabel: 1,
      lastEvaluatedAtLabel: '27/03/2026 11:00',
    },
    sources: [
      {
        key: 'source-a',
        source: 'ECUS-HN',
        awaitingActionLabel: 3,
        pendingReviewLabel: 1,
        locked: false,
        actionLabel: 'Khóa nguồn',
        actionToneClass: 'border-amber-500 text-amber-600',
        lockedAtLabel: '',
        lockedReasonLabel: '',
      },
      {
        key: 'source-b',
        source: 'ECUS-HCM',
        awaitingActionLabel: 2,
        pendingReviewLabel: 1,
        locked: true,
        actionLabel: 'Mở khóa',
        actionToneClass: 'border-emerald-500 text-emerald-600',
        lockedAtLabel: '27/03/2026 10:45',
        lockedReasonLabel: 'Vượt ngưỡng cảnh báo',
      },
    ],
    lockedSources: [
      {
        key: 'locked-a',
        source: 'ECUS-HCM',
        lockedByLabel: 'He thong',
        lockedAtLabel: '27/03/2026 10:45',
        reasonLabel: 'Vượt ngưỡng cảnh báo',
      },
    ],
    actionsDisabled: false,
    onLockSource: vi.fn(),
    onUnlockSource: vi.fn(),
    ...overrides,
  };
}

describe('DataHealthPolicySourcesPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị status summary, source breakdown và locked sources đã format sẵn', () => {
    render(<DataHealthPolicySourcesPanel {...createProps()} />);

    expect(screen.getByText(/Nhóm chờ xử lý: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhóm chờ rà soát: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhóm thuộc nguồn khóa: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Lần đánh giá gần nhất: 27\/03\/2026 11:00/i)).toBeInTheDocument();

    expect(screen.getByText('Nguồn dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('ECUS-HN')).toBeInTheDocument();
    expect(screen.getAllByText('ECUS-HCM').length).toBe(2);
    expect(screen.getAllByText('Mở khóa').length).toBeGreaterThan(0);
    expect(screen.getByText(/Khóa lúc: 27\/03\/2026 10:45 • Vượt ngưỡng cảnh báo/i)).toBeInTheDocument();

    expect(screen.getByText('Nguồn đang khóa')).toBeInTheDocument();
    expect(screen.getByText(/Khóa bởi: He thong • 27\/03\/2026 10:45/i)).toBeInTheDocument();
    expect(screen.getByText(/Lý do: Vượt ngưỡng cảnh báo/i)).toBeInTheDocument();
  });

  it('gọi đúng callback lock/unlock và fallback đúng khi không có dữ liệu', () => {
    const onLockSource = vi.fn();
    const onUnlockSource = vi.fn();
    const { rerender } = render(
      <DataHealthPolicySourcesPanel
        {...createProps({
          onLockSource,
          onUnlockSource,
        })}
      />
    );

    fireEvent.click(screen.getByText('Khóa nguồn'));
    fireEvent.click(screen.getAllByText('Mở khóa')[0]);

    expect(onLockSource).toHaveBeenCalledWith('ECUS-HN');
    expect(onUnlockSource).toHaveBeenCalledWith('ECUS-HCM');

    rerender(
      <DataHealthPolicySourcesPanel
        {...createProps({
          statusSummary: {
            awaitingActionLabel: 0,
            pendingReviewLabel: 0,
            lockedLabel: 0,
            lastEvaluatedAtLabel: 'Chưa có',
          },
          sources: [],
          lockedSources: [],
          actionsDisabled: true,
        })}
      />
    );

    expect(screen.getByText('Chưa có thống kê nguồn dữ liệu.')).toBeInTheDocument();
    expect(screen.getByText('Không có nguồn nào bị khóa.')).toBeInTheDocument();
  });
});
