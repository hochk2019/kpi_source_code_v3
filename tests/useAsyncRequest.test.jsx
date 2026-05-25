import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useAsyncRequest from '@/hooks/useAsyncRequest.js';

describe('useAsyncRequest', () => {
  it('settles successful immediate requests when initialArgs is omitted', async () => {
    const task = vi.fn(async () => 'done');

    const { result } = renderHook(() =>
      useAsyncRequest(task, {
        immediate: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe('done');
    });

    expect(result.current.error).toBe('');
    expect(task).toHaveBeenCalledTimes(1);
  });
});
