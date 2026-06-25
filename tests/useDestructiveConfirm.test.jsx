import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import {
  useDestructiveConfirm,
  getDestructiveDefaults,
} from '@/hooks/useDestructiveConfirm';

/**
 * Unit tests for useDestructiveConfirm — destructive action confirmation hook.
 *
 * Validates: Requirements 4.3
 */

const confirmSpy = vi.fn(() => Promise.resolve(true));

vi.mock('@/hooks/useAppDialog', () => ({
  useAppDialog: () => ({
    alert: vi.fn(() => Promise.resolve()),
    confirm: confirmSpy,
  }),
}));

// i18n keys resolve to Vietnamese defaults; we assert against those.
describe('getDestructiveDefaults', () => {
  it('returns delete defaults', () => {
    expect(getDestructiveDefaults('delete')).toEqual({
      title: 'Xác nhận xóa',
      confirmLabel: 'Xóa',
    });
  });

  it('returns overwrite defaults', () => {
    expect(getDestructiveDefaults('overwrite')).toEqual({
      title: 'Xác nhận ghi đè',
      confirmLabel: 'Ghi đè',
    });
  });

  it('returns reset defaults', () => {
    expect(getDestructiveDefaults('reset')).toEqual({
      title: 'Xác nhận đặt lại',
      confirmLabel: 'Đặt lại',
    });
  });
});

describe('useDestructiveConfirm', () => {
  beforeEach(() => {
    confirmSpy.mockClear();
  });

  it('confirmDelete invokes confirm with destructive variant and delete defaults', async () => {
    const { result } = renderHook(() => useDestructiveConfirm());

    await result.current.confirmDelete('Tài khoản sẽ bị xóa vĩnh viễn.');

    expect(confirmSpy).toHaveBeenCalledWith('Tài khoản sẽ bị xóa vĩnh viễn.', {
      title: 'Xác nhận xóa',
      confirmLabel: 'Xóa',
      variant: 'destructive',
    });
  });

  it('confirmOverwrite invokes confirm with overwrite defaults', async () => {
    const { result } = renderHook(() => useDestructiveConfirm());

    await result.current.confirmOverwrite('Dữ liệu hiện tại sẽ bị ghi đè.');

    expect(confirmSpy).toHaveBeenCalledWith('Dữ liệu hiện tại sẽ bị ghi đè.', {
      title: 'Xác nhận ghi đè',
      confirmLabel: 'Ghi đè',
      variant: 'destructive',
    });
  });

  it('confirmReset invokes confirm with reset defaults', async () => {
    const { result } = renderHook(() => useDestructiveConfirm());

    await result.current.confirmReset('Cấu hình sẽ trở về mặc định.');

    expect(confirmSpy).toHaveBeenCalledWith('Cấu hình sẽ trở về mặc định.', {
      title: 'Xác nhận đặt lại',
      confirmLabel: 'Đặt lại',
      variant: 'destructive',
    });
  });

  it('allows overriding title and confirmLabel', async () => {
    const { result } = renderHook(() => useDestructiveConfirm());

    await result.current.confirmDelete('Xóa nhóm?', {
      title: 'Xóa nhóm tổ đội',
      confirmLabel: 'Xóa nhóm',
    });

    expect(confirmSpy).toHaveBeenCalledWith('Xóa nhóm?', {
      title: 'Xóa nhóm tổ đội',
      confirmLabel: 'Xóa nhóm',
      variant: 'destructive',
    });
  });

  it('returns the confirm result', async () => {
    confirmSpy.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useDestructiveConfirm());

    await expect(result.current.confirmReset('reset?')).resolves.toBe(false);
  });
});
