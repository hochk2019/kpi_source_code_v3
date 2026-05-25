import React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DataHealthPolicyConfigSection from '@/components/data-health-dashboard/DataHealthPolicyConfigSection.jsx';

function createProps(overrides = {}) {
  return {
    canEditPolicy: true,
    policyLoading: false,
    policySaving: false,
    policyError: '',
    policyActionsDisabled: false,
    policyInputsDisabled: false,
    policyForm: {
      autoNotifyAfterDays: 3,
      notifyCooldownHours: 12,
      evaluationWindowDays: 7,
      autoLockAfterGroups: 5,
      minGroupSizeForLock: 2,
      autoUnlockAfterDays: 14,
      autoLockEnabled: true,
    },
    policySourcesPanel: {
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
      ],
      lockedSources: [],
      actionsDisabled: false,
      onLockSource: vi.fn(),
      onUnlockSource: vi.fn(),
    },
    onReloadPolicy: vi.fn(),
    onSavePolicy: vi.fn(),
    onPolicyFieldChange: vi.fn(),
    ...overrides,
  };
}

describe('DataHealthPolicyConfigSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị policy form và source panel đã tách', () => {
    render(<DataHealthPolicyConfigSection {...createProps()} />);

    expect(screen.getByText('Chính sách tự động trùng 11 số')).toBeInTheDocument();
    expect(screen.getByLabelText('Số ngày nhắc nhở tự động')).toHaveValue(3);
    expect(screen.getByLabelText('Thời gian chờ giữa các lần nhắc (giờ)')).toHaveValue(12);
    expect(screen.getByLabelText('Cửa sổ đánh giá (ngày)')).toHaveValue(7);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Nguồn dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('ECUS-HN')).toBeInTheDocument();
  });

  it('phát sự kiện reload/save và cập nhật field về component cha', () => {
    const onReloadPolicy = vi.fn();
    const onSavePolicy = vi.fn();
    const onPolicyFieldChange = vi.fn();

    render(
      <DataHealthPolicyConfigSection
        {...createProps({
          onReloadPolicy,
          onSavePolicy,
          onPolicyFieldChange,
        })}
      />
    );

    fireEvent.click(screen.getByText('Tải lại'));
    fireEvent.click(screen.getByText('Lưu cấu hình'));
    fireEvent.change(screen.getByLabelText('Số ngày nhắc nhở tự động'), {
      target: { value: '9' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    expect(onReloadPolicy).toHaveBeenCalledTimes(1);
    expect(onSavePolicy).toHaveBeenCalledTimes(1);
    expect(onPolicyFieldChange).toHaveBeenCalledWith('autoNotifyAfterDays', 9);
    expect(onPolicyFieldChange).toHaveBeenCalledWith('autoLockEnabled', false);
  });

  it('hiển thị trạng thái read-only và lỗi khi không có quyền sửa', () => {
    render(
      <DataHealthPolicyConfigSection
        {...createProps({
          canEditPolicy: false,
          policyError: 'Không thể cập nhật chính sách',
          policyInputsDisabled: true,
          policyActionsDisabled: true,
        })}
      />
    );

    expect(
      screen.getByText('Tài khoản hiện chỉ có quyền xem cấu hình, không thể chỉnh sửa thông số.')
    ).toBeInTheDocument();
    expect(screen.getByText('Không thể cập nhật chính sách')).toBeInTheDocument();
    expect(screen.getByText('Lưu cấu hình')).toBeDisabled();
    expect(screen.getByLabelText('Số ngày nhắc nhở tự động')).toHaveAttribute('readonly');
  });
});
