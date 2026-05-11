import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/components/workflows/ReportCenterPanel.jsx', () => ({
  default: function ReportCenterPanelCrashStub() {
    throw new Error('report center crashed');
  },
}));

import KPICalculator from '@/components/KPICalculator.tsx';

describe('KPICalculator tab error boundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('giữ shell hoạt động khi tab báo cáo ném lỗi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <KPICalculator
        auth={{
          username: 'guest',
          role: 'viewer',
          permissions: { reportsExport: true, auditView: true },
        }}
        activeTab="reports"
      />,
    );

    expect(screen.getByText('KPI Command')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Không thể hiển thị nội dung trang\.|Không thể hiển thị Báo cáo KPI/i,
    );
    expect(screen.getByText(/Chi tiết kỹ thuật: report center crashed/i)).toBeInTheDocument();
  });
});
