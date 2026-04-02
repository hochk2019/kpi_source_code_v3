import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ReportViewer.jsx', () => ({
  default: function MockReportViewer() {
    return <div>Mock Report Viewer</div>;
  },
}));

vi.mock('@/components/ExportAuditReport.jsx', () => ({
  default: function MockExportAuditReport() {
    return <div>Mock Export Audit</div>;
  },
}));

import ReportCenterPanel from '@/components/workflows/ReportCenterPanel.jsx';

describe('ReportCenterPanel', () => {
  it('shows consistent empty state when audit trail is unavailable', () => {
    render(
      <ReportCenterPanel
        canExport
        canViewAudit={false}
        currentUser={{ username: 'analyst', role: 'viewer' }}
      />,
    );

    expect(screen.getByText(/Audit trail chưa khả dụng/i)).toBeInTheDocument();
    expect(screen.getByText(/Export và lịch gửi vẫn khả dụng/i)).toBeInTheDocument();
  });
});
