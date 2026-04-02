import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  AppShellEmptyState,
  AppShellErrorState,
  AppShellLoadingState,
} from '@/components/appShell/AppShellAsyncStates.jsx';

describe('AppShellAsyncStates', () => {
  it('renders shared loading copy', () => {
    render(
      <AppShellLoadingState
        title="Đang tải báo cáo KPI"
        description="Shell đang khởi tạo report center."
      />,
    );

    expect(screen.getByText(/Đang tải báo cáo KPI/i)).toBeInTheDocument();
    expect(screen.getByText(/Shell đang khởi tạo report center/i)).toBeInTheDocument();
  });

  it('supports empty and error actions consistently', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <div>
        <AppShellEmptyState title="Chưa có dữ liệu" description="Hãy đổi workflow." />
        <AppShellErrorState
          title="Không thể tải dữ liệu"
          description="Vui lòng thử lại."
          actionLabel="Thử lại"
          onAction={onRetry}
        />
      </div>,
    );

    expect(screen.getByText(/Chưa có dữ liệu/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Thử lại/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
