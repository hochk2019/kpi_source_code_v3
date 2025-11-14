import { describe, it, expect } from 'vitest';

import { computeDeclSyncConflicts } from '@/lib/store.js';

describe('computeDeclSyncConflicts', () => {
  const baseline = '2024-06-01T00:00:00.000Z';

  it('phát hiện xung đột khi lịch sử chỉnh sửa trùng với thay đổi incoming', () => {
    const previousRows = [
      {
        so_tk: '12345678901',
        nhanh: 'HQ01',
        agency: 'Đại lý A',
        nhan_vien: 'Lan',
      },
    ];
    const nextRows = [
      {
        so_tk: '12345678901',
        nhanh: 'HQ01',
        agency: 'Đại lý B',
        nhan_vien: 'Lan',
      },
    ];
    const historyProvider = () => [
      {
        ts: '2024-06-05T08:15:00.000Z',
        actor: 'minh.nguyen',
        changes: [
          { field: 'agency', before: 'Đại lý A', after: 'Đại lý C' },
        ],
      },
    ];

    const conflicts = computeDeclSyncConflicts(previousRows, nextRows, {
      historyProvider,
      baselineTimestamp: baseline,
    });

    expect(conflicts).toHaveLength(1);
    const conflict = conflicts[0];
    expect(conflict.key).toBe('12345678901__HQ01');
    expect(conflict.fields).toEqual([
      {
        field: 'agency',
        label: 'Đại lý',
        before: 'Đại lý A',
        after: 'Đại lý B',
      },
    ]);
    expect(conflict.lastManualActor).toBe('minh.nguyen');
  });

  it('bỏ qua lịch sử cũ hơn thời điểm chạy đồng bộ', () => {
    const previousRows = [
      {
        so_tk: '55544433322',
        nhanh: 'HQ02',
        team: 'Team Alpha',
      },
    ];
    const nextRows = [
      {
        so_tk: '55544433322',
        nhanh: 'HQ02',
        team: 'Team Beta',
      },
    ];
    const historyProvider = () => [
      {
        ts: '2024-05-20T09:00:00.000Z',
        actor: 'huong.pham',
        changes: [
          { field: 'team', before: 'Team Alpha', after: 'Team Z' },
        ],
      },
    ];

    const conflicts = computeDeclSyncConflicts(previousRows, nextRows, {
      historyProvider,
      baselineTimestamp: baseline,
    });

    expect(conflicts).toHaveLength(0);
  });

  it('trả về mảng rỗng khi không có thay đổi trùng khớp lịch sử', () => {
    const previousRows = [
      {
        so_tk: '99988877766',
        nhanh: 'HQ03',
        agency: 'Đại lý X',
      },
    ];
    const nextRows = [
      {
        so_tk: '99988877766',
        nhanh: 'HQ03',
        agency: 'Đại lý X',
      },
    ];

    const conflicts = computeDeclSyncConflicts(previousRows, nextRows, {
      historyProvider: () => [],
    });

    expect(conflicts).toHaveLength(0);
  });
});
