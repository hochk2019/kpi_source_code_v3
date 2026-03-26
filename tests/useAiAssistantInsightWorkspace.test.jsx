import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAssistantInsightWorkspace } from '@/components/ai-assistant/hooks/useAiAssistantInsightWorkspace.js';
import {
  fetchAiDataSnapshot,
  fetchAiInsights,
  fetchAiSnapshotHistory,
  fetchAiSnapshotHistoryEntry,
  requestAiCompletion,
  runAiInsightJob,
  submitAiInsightFeedback,
  updateAiInsightSettings,
} from '@/lib/aiClient.js';
import {
  buildSnapshotCacheKey,
  getLocalSnapshotCacheEntry,
} from '@/components/ai-assistant/snapshotCache.js';

vi.mock('@/shared/toast', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/aiClient.js', () => ({
  fetchAiDataSnapshot: vi.fn(),
  fetchAiInsights: vi.fn(),
  fetchAiSnapshotHistory: vi.fn(),
  fetchAiSnapshotHistoryEntry: vi.fn(),
  requestAiCompletion: vi.fn(),
  runAiInsightJob: vi.fn(),
  submitAiInsightFeedback: vi.fn(),
  updateAiInsightSettings: vi.fn(),
}));

vi.mock('@/components/ai-assistant/snapshotCache.js', () => ({
  buildSnapshotCacheKey: vi.fn(),
  getLocalSnapshotCacheEntry: vi.fn(),
  storeLocalSnapshotCacheEntry: vi.fn(),
}));

vi.mock('@/lib/reports.js', () => ({
  computeQuickRange: vi.fn(() => ({ from: '2025-08-01', to: '2025-08-31' })),
}));

const summaryRangeOptions = [{ value: 'this_month', label: 'Tháng này' }];

const baseSnapshot = {
  range: { from: '2025-08-01', to: '2025-08-31' },
  summary: {
    declarations: 12,
    import: 7,
    export: 5,
    kpi: 180,
    items: 20,
    licenses: 3,
    licenseSamples: ['A12'],
  },
  adjustments: {
    totals: {
      approved: 2,
      pending: 1,
      rejected: 0,
      totalPoints: 15,
      pointsApproved: 12,
      pointsPending: 3,
    },
  },
  topStaff: [{ name: 'An', totalKpi: 120, declarations: 8 }],
  topTeams: [{ name: 'Team 1', totalKpi: 180, declarations: 12 }],
  trends: {
    monthly: [{ month: '2025-08', declarations: 12, kpi: 180 }],
  },
};

describe('useAiAssistantInsightWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSnapshotCacheKey.mockReturnValue('cache-key');
    getLocalSnapshotCacheEntry.mockReturnValue(null);
    fetchAiInsights.mockResolvedValue({
      insights: [],
      meta: {
        state: { lastRunAt: null, lastStatus: 'never' },
        schedule: { nextRun: null },
        settings: { notifyOnAnomaly: false },
        history: { entries: [] },
      },
    });
    fetchAiSnapshotHistory.mockResolvedValue([]);
    fetchAiDataSnapshot.mockResolvedValue(baseSnapshot);
    fetchAiSnapshotHistoryEntry.mockResolvedValue(null);
    requestAiCompletion.mockResolvedValue({
      message: 'Tóm tắt KPI thử nghiệm',
      cached: false,
      providerId: 'provider-1',
      usage: { total_tokens: 42 },
    });
    runAiInsightJob.mockResolvedValue({ insight: { insightId: 'insight-new' } });
    submitAiInsightFeedback.mockResolvedValue({
      totals: { helpful: 2, notHelpful: 0 },
      feedback: { helpful: true, comment: null, updatedAt: '2025-08-03T07:10:00.000Z' },
    });
    updateAiInsightSettings.mockResolvedValue({ notifyOnAnomaly: true });
  });

  it('loads insights on mount and syncs settings/history state', async () => {
    fetchAiInsights.mockResolvedValueOnce({
      insights: [{ insightId: 'ins-1', response: 'Insight thử nghiệm.', feedback: { helpful: 0, notHelpful: 0 } }],
      meta: {
        state: { lastRunAt: '2025-08-03T07:00:00.000Z', lastStatus: 'success' },
        schedule: { nextRun: '2025-08-04T07:00:00.000Z' },
        settings: { notifyOnAnomaly: true },
        history: { entries: [{ id: 'hist-1', generatedAt: '2025-08-03T07:00:00.000Z' }] },
      },
    });

    const { result } = renderHook(() =>
      useAiAssistantInsightWorkspace({
        canManage: true,
        canUse: true,
        selectedProviderId: 'provider-1',
        summaryRangeOptions,
      })
    );

    await waitFor(() => expect(result.current.insightState.insights).toHaveLength(1));
    expect(result.current.insightState.notifyOnAnomaly).toBe(true);
    expect(result.current.snapshotState.snapshotHistory).toEqual([{ id: 'hist-1', generatedAt: '2025-08-03T07:00:00.000Z' }]);
  });

  it('uses cached snapshot and generates summary with selected provider', async () => {
    getLocalSnapshotCacheEntry.mockReturnValue({ snapshot: baseSnapshot });

    const { result } = renderHook(() =>
      useAiAssistantInsightWorkspace({
        canManage: true,
        canUse: true,
        selectedProviderId: 'provider-1',
        summaryRangeOptions,
      })
    );

    await waitFor(() => expect(fetchAiInsights).toHaveBeenCalled());

    await act(async () => {
      await result.current.snapshotState.handleFetchSnapshot();
    });

    expect(fetchAiDataSnapshot).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.snapshotState.snapshotPreviewMetrics).not.toBeNull());

    await act(async () => {
      await result.current.snapshotState.handleGenerateSummary();
    });

    expect(requestAiCompletion).toHaveBeenCalledWith({
      scope: 'report_summary',
      providerId: 'provider-1',
      prompt: expect.stringContaining('Khoảng thời gian phân tích: 2025-08-01 → 2025-08-31'),
    });
    expect(result.current.snapshotState.summaryResult?.text).toBe('Tóm tắt KPI thử nghiệm');
  });

  it('updates feedback, notify setting, and selected history entry', async () => {
    fetchAiInsights.mockResolvedValueOnce({
      insights: [
        {
          insightId: 'ins-1',
          response: 'Insight thử nghiệm.',
          feedback: { helpful: 0, notHelpful: 0, viewer: null },
        },
      ],
      meta: {
        state: { lastRunAt: null, lastStatus: 'never' },
        schedule: { nextRun: null },
        settings: { notifyOnAnomaly: false },
        history: { entries: [{ id: 'hist-1', generatedAt: '2025-08-03T07:00:00.000Z' }] },
      },
    });
    fetchAiSnapshotHistoryEntry.mockResolvedValue({
      id: 'hist-1',
      generatedAt: '2025-08-03T07:00:00.000Z',
      range: { from: '2025-08-01', to: '2025-08-02' },
      snapshot: {
        summary: { declarations: 12, import: 7, export: 5, kpi: 180 },
        adjustments: { totals: { approved: 1, pending: 0, rejected: 0, totalPoints: 12 } },
        topStaff: [{ name: 'An', declarations: 8, totalKpi: 120 }],
        topTeams: [{ name: 'Team 1', declarations: 12, totalKpi: 180 }],
      },
    });

    const { result } = renderHook(() =>
      useAiAssistantInsightWorkspace({
        canManage: true,
        canUse: true,
        selectedProviderId: 'provider-1',
        summaryRangeOptions,
      })
    );

    await waitFor(() => expect(result.current.insightState.insights).toHaveLength(1));

    await act(async () => {
      await result.current.insightState.handleInsightFeedback('ins-1', true);
    });

    await waitFor(() => expect(result.current.insightState.insights[0].feedback.helpful).toBe(2));

    await act(async () => {
      await result.current.insightState.handleToggleNotify();
    });

    await waitFor(() => expect(result.current.insightState.notifyOnAnomaly).toBe(true));

    await act(async () => {
      await result.current.insightState.handleViewHistoryEntry('hist-1');
    });

    await waitFor(() => expect(result.current.snapshotState.selectedHistoryEntry?.id).toBe('hist-1'));
    expect(result.current.snapshotState.selectedHistoryMetrics[0]).toContain('Tổng tờ khai: 12');
  });
});
