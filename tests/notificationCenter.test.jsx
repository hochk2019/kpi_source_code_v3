import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { fetchNotificationHistory } = vi.hoisted(() => ({
  fetchNotificationHistory: vi.fn(),
}));

let streamHandler = () => {};

vi.mock('@/lib/notificationClient.js', () => ({
  fetchNotificationHistory,
  subscribeNotificationStream: (handler) => {
    streamHandler = handler;
    return () => {
      streamHandler = () => {};
    };
  },
}));

vi.mock('@/lib/commandBus.js', () => ({
  subscribeCommand: () => () => {},
}));

import NotificationCenter from '@/components/NotificationCenter.tsx';

function getUnreadBadge() {
  return document.querySelector('button[aria-label="Thông báo hệ thống"] span.bg-red-500');
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    streamHandler = () => {};
    fetchNotificationHistory.mockReset();
    fetchNotificationHistory.mockResolvedValue([
      {
        id: 'history-1',
        type: 'sync',
        title: 'Lịch sử gần nhất',
        message: 'Đã đồng bộ thành công',
        severity: 'success',
        createdAt: '2026-03-30T09:00:00.000Z',
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('giữ unread badge cho tới khi người dùng đánh dấu tất cả đã đọc', async () => {
    const user = userEvent.setup();

    render(<NotificationCenter />);

    await waitFor(() => {
      expect(fetchNotificationHistory).toHaveBeenCalledWith(20);
    });

    streamHandler({
      id: 'stream-1',
      type: 'alert',
      title: 'Cảnh báo mới',
      message: 'Có lỗi đồng bộ cần kiểm tra',
      severity: 'warning',
      createdAt: '2026-03-30T10:00:00.000Z',
    });

    await waitFor(() => {
      expect(getUnreadBadge()).not.toBeNull();
      expect(getUnreadBadge()).toHaveTextContent('1');
    });

    await user.click(screen.getByRole('button', { name: 'Thông báo hệ thống' }));

    const dialogButton = screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' });
    expect(dialogButton).toBeEnabled();
    expect(screen.getByText('Cảnh báo mới')).toBeInTheDocument();
    expect(screen.getByText('Mới')).toBeInTheDocument();
    expect(getUnreadBadge()).not.toBeNull();

    await user.click(dialogButton);

    await waitFor(() => {
      expect(screen.queryByText('Mới')).not.toBeInTheDocument();
      expect(getUnreadBadge()).toBeNull();
      expect(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeDisabled();
    });
  });

  it('vẫn nhóm lịch sử theo ngày và không hiện bulk action khả dụng khi không có unread', async () => {
    const user = userEvent.setup();

    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: 'Thông báo hệ thống' }));

    expect(await screen.findByText('Lịch sử gần nhất')).toBeInTheDocument();
    expect(screen.getByText('30/3/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeDisabled();
    expect(within(screen.getByRole('button', { name: 'Thông báo hệ thống' })).queryByText('1')).toBeNull();
  });
});
