import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/components/workflows/ReportCenterPanel.jsx', () => ({
  default: function ReportCenterPanelCrashStub() {
    throw new Error('report center crashed');
  },
}));

import KPICalculator from '@/components/KPICalculator.jsx';

describe('KPICalculator tab error boundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('giữ shell hoạt động khi tab báo cáo ném lỗi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <KPICalculator
        auth={{ username: 'guest', role: 'viewer', permissions: {} }}
        activeTab="reports"
      />,
    );

    expect(screen.getByText('KPI Control Center')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể hiển thị Báo cáo KPI.');
    expect(screen.getByText(/Chi tiết kỹ thuật: report center crashed/i)).toBeInTheDocument();
  });
});
