import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/MSTAssignment.jsx', () => ({
  default: () => <div>MST workspace body</div>,
}));

vi.mock('@/components/KPIAdjustments.jsx', () => ({
  default: () => <div>Adjustment workspace body</div>,
}));

vi.mock('@/components/ReportViewer.jsx', () => ({
  default: () => <div>Report dashboard body</div>,
}));

vi.mock('@/components/ExportAuditReport.jsx', () => ({
  default: () => <div>Export audit widget</div>,
}));

import MSTWorkflowPanel from '@/components/workflows/MSTWorkflowPanel.jsx';
import KPIAdjustmentsWorkflowPanel from '@/components/workflows/KPIAdjustmentsWorkflowPanel.jsx';
import ReportCenterPanel from '@/components/workflows/ReportCenterPanel.jsx';

describe('operator workflow panels', () => {
  it('renders MST workflow shell and hands off audit navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<MSTWorkflowPanel currentUser={{ username: 'admin' }} onNavigate={onNavigate} />);

    expect(screen.getByText(/Hàng chờ MST/i)).toBeInTheDocument();
    expect(screen.getByText('MST workspace body')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mở audit trail/i }));
    expect(onNavigate).toHaveBeenCalledWith('audit');
  });

  it('renders KPI adjustment workflow shell with dedicated review stage', () => {
    render(<KPIAdjustmentsWorkflowPanel currentUser={{ username: 'admin' }} onNavigate={vi.fn()} />);

    expect(screen.getByText(/Chọn kỳ điều chỉnh/i)).toBeInTheDocument();
    expect(screen.getByText('Adjustment workspace body')).toBeInTheDocument();
    expect(screen.getByText(/Xuất bản tác động/i)).toBeInTheDocument();
  });

  it('renders report center export surface separately when audit is allowed', () => {
    render(
      <ReportCenterPanel
        canExport
        canViewAudit
        currentUser={{ username: 'admin' }}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Chốt phạm vi báo cáo/i)).toBeInTheDocument();
    expect(screen.getByText('Report dashboard body')).toBeInTheDocument();
    expect(screen.getByText('Export audit widget')).toBeInTheDocument();
  });
});
