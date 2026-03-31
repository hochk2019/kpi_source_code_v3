/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/localAuth.js', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '@/auth/localAuth.js';
import { fetchNotificationHistory, subscribeNotificationStream } from '@/lib/notificationClient.js';

describe('notificationClient canonical routes', () => {
  const originalEventSource = window.EventSource;

  beforeEach(() => {
    fetchWithAuth.mockReset();
    window.EventSource = originalEventSource;
  });

  afterEach(() => {
    window.EventSource = originalEventSource;
    vi.restoreAllMocks();
  });

  it('loads notification history from canonical /api/v4 endpoint', async () => {
    fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, events: [] }),
    });

    await fetchNotificationHistory(25);

    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v4/alerts/notifications?limit=25', { cache: 'no-store' });
  });

  it('opens SSE stream from canonical /api/v4 endpoint', () => {
    const closeSpy = vi.fn();
    const eventSourceCtor = vi.fn(function EventSourceMock() {
      this.addEventListener = vi.fn();
      this.close = closeSpy;
      this.onmessage = null;
    });

    window.EventSource = eventSourceCtor;

    const unsubscribe = subscribeNotificationStream(() => {});

    expect(eventSourceCtor).toHaveBeenCalledWith('/api/v4/alerts/notifications/stream', { withCredentials: true });

    unsubscribe();
    expect(closeSpy).toHaveBeenCalled();

  });
});
