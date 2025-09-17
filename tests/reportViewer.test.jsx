import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import ReportViewer from '@/components/ReportViewer.jsx';
import { DECL_KEY, RULES_KEY } from '@/lib/store.js';

// đảm bảo dữ liệu localStorage sạch trước mỗi test
beforeEach(() => {
  localStorage.clear();
});

describe('ReportViewer', () => {
  it('hiển thị tổng số tờ khai và thông tin quy tắc đang áp dụng', () => {
    const rows = [
      { so_tk: 'TK001', date: '2024-08-01' },
      { so_tk: 'TK002', date: '2024-08-03' },
      { so_tk: 'TK003', date: '2024-08-05' },
    ];
    const rules = { name: 'Rules tháng 8', applyFrom: '2024-08-01' };

    localStorage.setItem(DECL_KEY, JSON.stringify(rows));
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));

    const html = renderToString(<ReportViewer />);

    expect(html).toMatch(/<span>3(?:<!-- -->)? tờ khai<\/span>/);
    expect(html).toMatch(/Rules tháng 8(?:<!-- -->)? — (?:<!-- -->)?Áp dụng từ 2024-08-01/);
  });
});
