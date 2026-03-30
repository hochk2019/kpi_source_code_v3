import { describe, expect, it } from 'vitest';

import {
  getSuggestedSupportResources,
  resolveSupportContext,
} from '@/components/support/supportContextCatalog.js';

describe('supportContextCatalog', () => {
  it('merges general guidance with tab-specific references', () => {
    const context = resolveSupportContext('import');

    expect(context.label).toBe('Import Data');
    expect(context.docReferences.map((reference) => reference.path)).toEqual(
      expect.arrayContaining([
        'docs/USER_GUIDE.md',
        'docs/operations/ecus-sync-monitoring.md',
      ]),
    );
    expect(context.faqs.length).toBeGreaterThan(0);
  });

  it('ranks suggested resources by contextual keywords', () => {
    const resources = [
      {
        id: 'ai-playbook',
        title: 'Sổ tay trợ lý AI',
        description: 'Hướng dẫn snapshot và prompt.',
        tags: ['ai'],
      },
      {
        id: 'import-checklist',
        title: 'Checklist làm sạch dữ liệu tờ khai',
        description: 'Kiểm tra import và vận hành ECUS.',
        tags: ['import', 'operations'],
      },
      {
        id: 'reporting-lab',
        title: 'Phân tích KPI nâng cao',
        description: 'Dashboard báo cáo.',
        tags: ['reports'],
      },
    ];

    const suggested = getSuggestedSupportResources(resources, resolveSupportContext('import'));

    expect(suggested[0]?.id).toBe('import-checklist');
    expect(suggested.some((resource) => resource.id === 'ai-playbook')).toBe(false);
  });
});
