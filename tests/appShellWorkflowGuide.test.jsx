import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AppShellWorkflowGuide from '@/components/appShell/AppShellWorkflowGuide.jsx';

describe('AppShellWorkflowGuide', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders shell workflow actions and step links', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();

    render(
      <AppShellWorkflowGuide
        eyebrow="Report center"
        headline="Tách dashboard và export thành workflow riêng."
        actions={[{ label: 'Mở dashboard KPI', onClick: onPrimary, variant: 'primary' }]}
        steps={[
          {
            number: 1,
            title: '1. Chốt phạm vi',
            detail: 'Khóa kỳ báo cáo.',
            targetId: 'report-scope',
          },
          {
            number: 2,
            title: '2. Dashboard',
            detail: 'Đọc dashboard KPI.',
            targetId: 'report-dashboard',
          },
        ]}
      />,
    );

    expect(screen.getByText(/Tách dashboard và export thành workflow riêng\./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /1\. Chốt phạm vi/i })).toHaveAttribute('href', '#report-scope');

    await user.click(screen.getByRole('button', { name: /Mở dashboard KPI/i }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('collapses and persists workflow guide state by domain key', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <AppShellWorkflowGuide
        preferenceId="reports"
        headline="Report workflow"
        actions={[{ label: 'Mở report center', onClick: vi.fn(), variant: 'primary' }]}
        steps={[
          {
            number: 1,
            title: '1. Chốt phạm vi',
            detail: 'Khóa kỳ báo cáo.',
            targetId: 'report-scope',
          },
          {
            number: 2,
            title: '2. Dashboard',
            detail: 'Đọc dashboard KPI.',
            targetId: 'report-dashboard',
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Thu gọn hướng dẫn/i }));

    expect(screen.getByText(/Hướng dẫn đã được thu gọn/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /1\. Chốt phạm vi/i })).not.toBeInTheDocument();

    rerender(
      <AppShellWorkflowGuide
        preferenceId="reports"
        headline="Report workflow"
        actions={[{ label: 'Mở report center', onClick: vi.fn(), variant: 'primary' }]}
        steps={[
          {
            number: 1,
            title: '1. Chốt phạm vi',
            detail: 'Khóa kỳ báo cáo.',
            targetId: 'report-scope',
          },
          {
            number: 2,
            title: '2. Dashboard',
            detail: 'Đọc dashboard KPI.',
            targetId: 'report-dashboard',
          },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: /Mở lại hướng dẫn/i })).toBeInTheDocument();

    rerender(
      <AppShellWorkflowGuide
        preferenceId="import"
        headline="Import workflow"
        actions={[{ label: 'Mở import', onClick: vi.fn(), variant: 'primary' }]}
        steps={[
          {
            number: 1,
            title: '1. Nạp nguồn',
            detail: 'Chọn file đầu vào.',
            targetId: 'import-source',
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /1\. Nạp nguồn/i })).toBeInTheDocument();
  });
});
