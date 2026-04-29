import { describe, expect, it, vi } from 'vitest';

const sonnerMock = {
  default: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  promise: vi.fn(),
  custom: vi.fn(),
  dismiss: vi.fn(),
};

vi.mock('sonner', () => {
  const fn = (...args) => sonnerMock.default(...args);
  fn.success = sonnerMock.success;
  fn.error = sonnerMock.error;
  fn.warning = sonnerMock.warning;
  fn.info = sonnerMock.info;
  fn.promise = sonnerMock.promise;
  fn.custom = sonnerMock.custom;
  fn.dismiss = sonnerMock.dismiss;
  return { toast: fn };
});

const { toast } = await import('@/shared/toast.js');

describe('toast', () => {
  it('success fires sonner.success with default duration', () => {
    toast.success('Saved');
    expect(sonnerMock.success).toHaveBeenCalledWith(
      expect.stringContaining('Saved'),
      expect.objectContaining({ duration: 4500 }),
    );
  });

  it('sticky fires with duration Infinity', () => {
    toast.sticky('Đang đồng bộ ECUS…', { kind: 'info' });
    expect(sonnerMock.default).toHaveBeenCalledWith(
      expect.stringContaining('Đang đồng bộ ECUS'),
      expect.objectContaining({ duration: Number.POSITIVE_INFINITY }),
    );
  });

  it('sticky supports description', () => {
    toast.sticky('Đang export', { kind: 'warning', description: 'Vui lòng chờ' });
    const opts = sonnerMock.default.mock.calls.at(-1)[1];
    expect(opts.duration).toBe(Number.POSITIVE_INFINITY);
    expect(opts.description).toContain('Vui lòng chờ');
  });

  it('dismiss forwards to sonner.dismiss', () => {
    toast.dismiss('some-id');
    expect(sonnerMock.dismiss).toHaveBeenCalledWith('some-id');
  });
});
