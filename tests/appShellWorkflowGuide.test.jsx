import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AppShellWorkflowGuide from '@/components/appShell/AppShellWorkflowGuide.jsx';

describe('AppShellWorkflowGuide', () => {
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
});
