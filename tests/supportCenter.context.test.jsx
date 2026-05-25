import React from 'react';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SupportCenter from '@/components/SupportCenter.tsx';
import { emitCommand } from '@/lib/commandBus.js';
import * as feedbackClient from '@/lib/feedbackClient.js';

vi.mock('@/lib/feedbackClient.js', () => ({
  fetchTrainingResources: vi.fn(),
  fetchFeedbackSummary: vi.fn(),
  submitFeedback: vi.fn(),
  prefetchEngagementData: vi.fn(),
}));

describe('SupportCenter contextual help', () => {
  beforeEach(() => {
    window.localStorage.clear();
    feedbackClient.fetchTrainingResources.mockResolvedValue([
      {
        id: 'import-checklist',
        title: 'Checklist làm sạch dữ liệu tờ khai',
        description: 'Checklist import, ECUS và data hygiene.',
        duration: '10 phút',
        level: 'Trung cấp',
        format: 'Checklist',
        tags: ['import', 'operations'],
        link: 'https://example.com/import-checklist',
      },
      {
        id: 'ai-playbook',
        title: 'Sổ tay sử dụng trợ lý AI',
        description: 'Prompt và snapshot KPI.',
        duration: '12 phút',
        level: 'Trung cấp',
        format: 'Bài viết',
        tags: ['ai'],
        link: 'https://example.com/ai-playbook',
      },
    ]);
    feedbackClient.fetchFeedbackSummary.mockResolvedValue({
      total: 2,
      latestAt: new Date().toISOString(),
      averageRating: 4.5,
    });
    feedbackClient.submitFeedback.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows contextual FAQ and repo references for the current tab', async () => {
    render(<SupportCenter currentTabId="import" />);

    fireEvent.click(screen.getByRole('button', { name: /hỗ trợ & đào tạo/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(await screen.findByText(/Theo ngữ cảnh: Import Data/i)).toBeInTheDocument();
    expect(screen.getByText('docs/operations/ecus-sync-monitoring.md')).toBeInTheDocument();
    expect(await screen.findAllByText('Checklist làm sạch dữ liệu tờ khai')).toHaveLength(2);
  });

  it('lets command payload override the help context and active tab', async () => {
    render(<SupportCenter currentTabId="reports" />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    emitCommand('open:support', { tab: 'feedback', contextTab: 'ai' });

    expect(await screen.findByText(/Theo ngữ cảnh: Trợ lý AI/i)).toBeInTheDocument();
    expect(screen.getByText('docs/operations/ai-insights.md')).toBeInTheDocument();
    expect(await screen.findByLabelText(/Chủ đề phản hồi/i)).toBeInTheDocument();
  });
});
