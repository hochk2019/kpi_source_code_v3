import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getItem, setItem, subscribe } = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock('@/lib/storageClient.js', () => ({
  getItem,
  setItem,
  subscribe,
}));

import {
  COMMAND_CENTER_PIN_STORAGE_KEY,
  parseCommandCenterPins,
  readCommandCenterPins,
  subscribeToCommandCenterPins,
  writeCommandCenterPins,
} from '@/components/command-center/pinStorage.js';

describe('command center pin shared storage helpers', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    subscribe.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ưu tiên shared cache và lọc dữ liệu pin không hợp lệ', () => {
    getItem.mockReturnValue(JSON.stringify(['navigate:hq', '', 'navigate:hq', 42]));

    expect(readCommandCenterPins(null)).toEqual(['navigate:hq']);
  });

  it('ghi pin mới vào shared storage và local fallback', () => {
    const localStorage = {
      setItem: vi.fn(),
    };

    const nextPins = writeCommandCenterPins(['navigate:hq', 'navigate:reports', 'navigate:hq'], localStorage);

    expect(nextPins).toEqual(['navigate:hq', 'navigate:reports']);
    expect(setItem).toHaveBeenCalledWith(
      COMMAND_CENTER_PIN_STORAGE_KEY,
      JSON.stringify(['navigate:hq', 'navigate:reports']),
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      COMMAND_CENTER_PIN_STORAGE_KEY,
      JSON.stringify(['navigate:hq', 'navigate:reports']),
    );
  });

  it('phát lại state pin đã hydrate khi shared storage cập nhật', () => {
    const listener = vi.fn();
    getItem.mockReturnValue(JSON.stringify(['navigate:reports']));

    const unsubscribe = subscribeToCommandCenterPins(listener, null);
    subscribe.mock.calls[0][1]();

    expect(subscribe).toHaveBeenCalledWith(COMMAND_CENTER_PIN_STORAGE_KEY, expect.any(Function));
    expect(listener).toHaveBeenCalledWith(['navigate:reports']);

    unsubscribe();
  });

  it('fallback về danh sách rỗng nếu payload pin không parse được', () => {
    expect(parseCommandCenterPins('not-json', ['navigate:hq'])).toEqual(['navigate:hq']);
    expect(parseCommandCenterPins(JSON.stringify({ bad: true }), ['navigate:hq'])).toEqual([]);
  });
});
