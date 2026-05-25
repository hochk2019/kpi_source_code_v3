import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setTheme } = vi.hoisted(() => ({
  setTheme: vi.fn(),
}));
const { getSharedItem, subscribeSharedItem } = vi.hoisted(() => {
  const listeners = new Map();

  return {
    getSharedItem: vi.fn(),
    subscribeSharedItem: vi.fn((key, listener) => {
      if (!listeners.has(key)) {
        listeners.set(key, new Set());
      }
      listeners.get(key).add(listener);
      return () => listeners.get(key)?.delete(listener);
    }),
  };
});

let commandSubscriber = () => {};

vi.mock('@/lib/commandBus.js', () => ({
  emitCommand: vi.fn(),
  subscribeCommand: (handler) => {
    commandSubscriber = handler;
    return () => {
      commandSubscriber = () => {};
    };
  },
}));

vi.mock('@/lib/storageClient.js', () => ({
  getItem: getSharedItem,
  setItem: vi.fn(),
  subscribe: subscribeSharedItem,
}));

import { useCommandCenterState } from '@/components/command-center/useCommandCenterState.js';

function CommandCenterStateHarness({ currentUser }) {
  const state = useCommandCenterState({
    currentUser,
    setTheme,
    themePreference: 'system',
  });

  return (
    <div>
      <output data-testid="open">{String(state.open)}</output>
      <output data-testid="query">{state.query}</output>
      <output data-testid="pinned">{state.pinned.join(',')}</output>
      <output data-testid="visible-count">{String(state.visibleCommands.length)}</output>
      <button type="button" onClick={state.openDialog}>
        open
      </button>
      <button type="button" onClick={() => state.updateQuery('đại lý')}>
        search-agency
      </button>
    </div>
  );
}

describe('useCommandCenterState', () => {
  const currentUser = {
    username: 'admin',
    role: 'admin',
    permissions: {
      accountManage: true,
      aiAssistManage: true,
      dataHealthManage: true,
    },
  };

  beforeEach(() => {
    getSharedItem.mockReset();
    subscribeSharedItem.mockClear();
    commandSubscriber = () => {};
    window.localStorage?.clear?.();
  });

  afterEach(() => {
    cleanup();
  });

  it('hydrate pin state từ shared storage và lọc command theo query', async () => {
    const user = userEvent.setup();
    getSharedItem.mockImplementation((key) =>
      key === 'kpi_command_center_pins_v1' ? JSON.stringify(['navigate:hq']) : null,
    );

    render(<CommandCenterStateHarness currentUser={currentUser} />);

    expect(screen.getByTestId('pinned')).toHaveTextContent('navigate:hq');

    await user.click(screen.getByRole('button', { name: /^open$/i }));
    await user.click(screen.getByRole('button', { name: /search-agency/i }));

    expect(screen.getByTestId('open')).toHaveTextContent('true');
    expect(screen.getByTestId('query')).toHaveTextContent('đại lý');
    expect(Number(screen.getByTestId('visible-count').textContent)).toBeGreaterThan(0);
  });

  it('mở dialog khi nhận signal từ command bus', async () => {
    render(<CommandCenterStateHarness currentUser={currentUser} />);

    commandSubscriber('open:command-center');

    await waitFor(() => {
      expect(screen.getByTestId('open')).toHaveTextContent('true');
    });
  });
});
