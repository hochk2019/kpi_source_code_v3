import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import SupportCenter from '@/components/SupportCenter.jsx';

expect.extend({ toHaveNoViolations });

vi.mock('@/lib/feedbackClient.js', () => ({
  fetchTrainingResources: vi.fn().mockResolvedValue([
    {
      id: 'sample',
      title: 'Hướng dẫn thử nghiệm',
      description: 'Mô tả ngắn gọn cho tài liệu thử nghiệm.',
      duration: '5 phút',
      level: 'Cơ bản',
      format: 'Slide',
      tags: ['demo'],
      link: '#',
    },
  ]),
  fetchFeedbackSummary: vi.fn().mockResolvedValue({ total: 2, latestAt: new Date().toISOString(), averageRating: 4.5 }),
  submitFeedback: vi.fn().mockResolvedValue({ ok: true }),
  prefetchEngagementData: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe('SupportCenter accessibility', () => {
  it('không có lỗi truy cập cơ bản khi mở dialog', async () => {
    const { getByRole } = render(<SupportCenter />);
    const trigger = getByRole('button', { name: /hỗ trợ & đào tạo/i });
    fireEvent.click(trigger);
    // chờ Radix mount nội dung dialog
    await new Promise((resolve) => setTimeout(resolve, 0));
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
