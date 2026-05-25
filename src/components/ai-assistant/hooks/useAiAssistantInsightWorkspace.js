import { useCallback, useEffect, useMemo, useState } from 'react';

import { toast } from '@/shared/toast';
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
  storeLocalSnapshotCacheEntry,
} from '@/components/ai-assistant/snapshotCache.js';
import { computeQuickRange } from '@/lib/reports.js';

function buildRangeParams(snapshotRange, summaryRangeOptions) {
  const option = summaryRangeOptions.find((item) => item.value === snapshotRange);
  const range = computeQuickRange(snapshotRange) || {};
  const params = {};

  if (range.from) {
    params.from = range.from;
  }
  if (range.to) {
    params.to = range.to;
  }

  return {
    params,
    label: option?.label || 'Khoảng đã chọn',
    range,
  };
}

function buildSnapshotSummaryPrompt(snapshot, rangeLabel, numberFormatter, kpiFormatter) {
  if (!snapshot || !snapshot.summary) {
    return 'Không có dữ liệu KPI để tóm tắt.';
  }

  const summary = snapshot.summary;
  const adjustments = snapshot.adjustments?.totals || {};
  const topStaff = (snapshot.topStaff || [])
    .slice(0, 3)
    .map(
      (item) =>
        `${item.name || 'Chưa gán'}: ${kpiFormatter.format(item.totalKpi || 0)} điểm (${numberFormatter.format(
          item.declarations || 0
        )} tờ khai)`
    )
    .join('; ') || 'Không có dữ liệu nhân viên nổi bật';
  const topTeams = (snapshot.topTeams || [])
    .slice(0, 3)
    .map(
      (item) =>
        `${item.name || 'Chưa gán tổ đội'}: ${kpiFormatter.format(item.totalKpi || 0)} điểm (${numberFormatter.format(
          item.declarations || 0
        )} tờ khai)`
    )
    .join('; ') || 'Không có dữ liệu tổ đội nổi bật';
  const monthlyTrend = (snapshot.trends?.monthly || [])
    .slice(-3)
    .map(
      (item) =>
        `${item.month}: ${numberFormatter.format(item.declarations || 0)} tờ khai, ${kpiFormatter.format(
          item.kpi || 0
        )} điểm`
    )
    .join('; ') || 'Chưa có dữ liệu xu hướng';
  const licenseSamples =
    (summary.licenseSamples || []).slice(0, 5).join(', ') || 'Không có mã giấy phép tiêu biểu';
  const rangeText =
    snapshot.range?.from && snapshot.range?.to
      ? `${snapshot.range.from} → ${snapshot.range.to}`
      : rangeLabel;
  const lines = [
    `Khoảng thời gian phân tích: ${rangeText} (${numberFormatter.format(summary.declarations || 0)} tờ khai)`,
    `Tổng tờ khai: ${numberFormatter.format(summary.declarations || 0)} (Nhập: ${numberFormatter.format(
      summary.import || 0
    )}, Xuất: ${numberFormatter.format(summary.export || 0)})`,
    `Điểm KPI cộng dồn: ${kpiFormatter.format(summary.kpi || 0)} • Mục hàng: ${numberFormatter.format(
      summary.items || 0
    )} • Giấy phép: ${numberFormatter.format(summary.licenses || 0)}`,
    `Điều chỉnh KPI - Đang chờ: ${numberFormatter.format(adjustments.pending || 0)} (≈ ${kpiFormatter.format(
      adjustments.pointsPending || 0
    )} điểm), Đã duyệt: ${numberFormatter.format(adjustments.approved || 0)} (≈ ${kpiFormatter.format(
      adjustments.pointsApproved || 0
    )} điểm)`,
    `Top nhân viên: ${topStaff}`,
    `Top tổ đội: ${topTeams}`,
    `Xu hướng 3 kỳ gần nhất: ${monthlyTrend}`,
    `Mã giấy phép nổi bật: ${licenseSamples}`,
  ];

  return `Bạn là chuyên gia KPI nội bộ. Hãy tóm tắt dữ liệu dưới đây bằng 4-6 gạch đầu dòng tiếng Việt, nêu rõ điểm mạnh, điểm yếu và rủi ro nếu có. Kết thúc bằng một câu khuyến nghị hành động cụ thể.\nDữ liệu:\n${lines.join(
    '\n'
  )}`;
}

function buildSnapshotPreviewMetrics(snapshotData, numberFormatter, kpiFormatter) {
  if (!snapshotData?.summary) {
    return null;
  }

  const summary = snapshotData.summary;
  const adjustments = snapshotData.adjustments?.totals || {};
  const topStaff = (snapshotData.topStaff || [])
    .slice(0, 2)
    .map(
      (item) =>
        `${item.name || 'Chưa gán'} (${kpiFormatter.format(item.totalKpi || 0)} điểm, ${numberFormatter.format(
          item.declarations || 0
        )} tờ khai)`
    )
    .join(', ') || 'Không có';
  const topTeams = (snapshotData.topTeams || [])
    .slice(0, 2)
    .map(
      (item) =>
        `${item.name || 'Chưa gán tổ đội'} (${kpiFormatter.format(item.totalKpi || 0)} điểm, ${numberFormatter.format(
          item.declarations || 0
        )} tờ khai)`
    )
    .join(', ') || 'Không có';

  return [
    `Tờ khai: ${numberFormatter.format(summary.declarations || 0)} (Nhập ${numberFormatter.format(
      summary.import || 0
    )} / Xuất ${numberFormatter.format(summary.export || 0)})`,
    `Điểm KPI: ${kpiFormatter.format(summary.kpi || 0)} • Mục hàng: ${numberFormatter.format(
      summary.items || 0
    )} • Giấy phép: ${numberFormatter.format(summary.licenses || 0)}`,
    `Điều chỉnh - Đang chờ: ${numberFormatter.format(adjustments.pending || 0)}, Đã duyệt: ${numberFormatter.format(
      adjustments.approved || 0
    )}`,
    `Top nhân viên: ${topStaff}`,
    `Top tổ đội: ${topTeams}`,
  ];
}

function buildSelectedHistoryMetrics(selectedHistoryEntry, numberFormatter, kpiFormatter) {
  if (!selectedHistoryEntry?.snapshot?.summary) {
    return [];
  }

  const snapshot = selectedHistoryEntry.snapshot;
  const summary = snapshot.summary;
  const adjustments = snapshot.adjustments?.totals || {};
  const lines = [
    `Tổng tờ khai: ${numberFormatter.format(summary.declarations || 0)} (Nhập ${numberFormatter.format(
      summary.import || 0
    )} / Xuất ${numberFormatter.format(summary.export || 0)})`,
    `Điểm KPI: ${kpiFormatter.format(summary.kpi || 0)}`,
    `Điều chỉnh KPI: ${numberFormatter.format(adjustments.approved || 0)} duyệt · ${numberFormatter.format(
      adjustments.pending || 0
    )} chờ · ${numberFormatter.format(adjustments.rejected || 0)} từ chối (tổng ảnh hưởng ${kpiFormatter.format(
      adjustments.totalPoints || 0
    )})`,
  ];

  const topStaffLine = (snapshot.topStaff || [])
    .slice(0, 3)
    .map(
      (item) =>
        `${item.name || 'Chưa gán'} (${numberFormatter.format(item.declarations || 0)} tờ khai, ${kpiFormatter.format(
          item.totalKpi || 0
        )} KPI)`
    )
    .join('; ');
  if (topStaffLine) {
    lines.push(`Nhân sự nổi bật: ${topStaffLine}`);
  }

  const topTeamsLine = (snapshot.topTeams || [])
    .slice(0, 3)
    .map(
      (item) =>
        `${item.name || 'Chưa gán tổ'} (${numberFormatter.format(item.declarations || 0)} tờ khai, ${kpiFormatter.format(
          item.totalKpi || 0
        )} KPI)`
    )
    .join('; ');
  if (topTeamsLine) {
    lines.push(`Tổ đội nổi bật: ${topTeamsLine}`);
  }

  return lines;
}

export function useAiAssistantInsightWorkspace({
  canManage,
  canUse,
  selectedProviderId,
  summaryRangeOptions,
}) {
  const [snapshotRange, setSnapshotRange] = useState('this_month');
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');
  const [snapshotData, setSnapshotData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryResult, setSummaryResult] = useState(null);
  const [insights, setInsights] = useState([]);
  const [insightsMeta, setInsightsMeta] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [insightRunLoading, setInsightRunLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState({});
  const [snapshotHistory, setSnapshotHistory] = useState([]);
  const [snapshotHistoryLoading, setSnapshotHistoryLoading] = useState(false);
  const [snapshotHistoryError, setSnapshotHistoryError] = useState('');
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);
  const [notifyOnAnomaly, setNotifyOnAnomaly] = useState(false);
  const [notifySaving, setNotifySaving] = useState(false);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('vi-VN'), []);
  const kpiFormatter = useMemo(
    () => new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    []
  );

  const loadInsights = useCallback(async () => {
    if (!canUse) {
      return;
    }

    setInsightsLoading(true);
    setInsightsError('');

    try {
      const { insights: fetchedInsights, meta } = await fetchAiInsights({ limit: 6, historyLimit: 6 });
      setInsights(Array.isArray(fetchedInsights) ? fetchedInsights : []);
      setInsightsMeta(meta || null);

      if (meta?.history?.entries) {
        setSnapshotHistory(meta.history.entries);
      }
      if (meta?.settings) {
        setNotifyOnAnomaly(meta.settings.notifyOnAnomaly === true);
      }
    } catch (err) {
      const message = err?.message || 'Không thể tải insight AI.';
      setInsightsError(message);
      toast.error(message);
    } finally {
      setInsightsLoading(false);
    }
  }, [canUse]);

  const loadSnapshotHistory = useCallback(async (limit = 6) => {
    if (!canUse) {
      return;
    }

    setSnapshotHistoryLoading(true);
    setSnapshotHistoryError('');

    try {
      const entries = await fetchAiSnapshotHistory({ limit });
      setSnapshotHistory(entries);
      setSelectedHistoryEntry((prev) => {
        if (!prev) {
          return prev;
        }
        return entries.find((item) => item.id === prev.id) || null;
      });
    } catch (err) {
      const message = err?.message || 'Không thể tải lịch sử snapshot KPI.';
      setSnapshotHistoryError(message);
      toast.error(message);
    } finally {
      setSnapshotHistoryLoading(false);
    }
  }, [canUse]);

  useEffect(() => {
    if (canUse) {
      loadInsights();
    }
  }, [canUse, loadInsights]);

  const handleFetchSnapshot = useCallback(async ({ force = false } = {}) => {
    const { params, label } = buildRangeParams(snapshotRange, summaryRangeOptions);
    const cacheKey = buildSnapshotCacheKey(params);

    if (!force) {
      const cached = getLocalSnapshotCacheEntry(cacheKey);
      if (cached?.snapshot) {
        setSnapshotData(cached.snapshot);
        setSnapshotError('');
        toast.success('Đã dùng snapshot KPI đã lưu tạm trong phiên.');
        return;
      }
    }

    setSnapshotLoading(true);
    setSnapshotError('');

    try {
      const snapshot = await fetchAiDataSnapshot(params);
      setSnapshotData(snapshot);

      if (!snapshot || (snapshot.summary?.declarations ?? 0) === 0) {
        const message = 'Không tìm thấy dữ liệu KPI trong khoảng đã chọn.';
        setSnapshotError(message);
        toast.error(message);
      } else {
        storeLocalSnapshotCacheEntry(cacheKey, snapshot);
        toast.success(`Đã lấy snapshot KPI (${label.toLowerCase()}).`);
      }
    } catch (err) {
      const message = err?.message || 'Không thể lấy snapshot dữ liệu.';
      setSnapshotError(message);
      toast.error(message);
    } finally {
      setSnapshotLoading(false);
    }
  }, [snapshotRange, summaryRangeOptions]);

  const handleGenerateSummary = useCallback(async () => {
    setSummaryError('');
    setSummaryResult(null);
    setSummaryLoading(true);

    try {
      const { params, label } = buildRangeParams(snapshotRange, summaryRangeOptions);
      const cacheKey = buildSnapshotCacheKey(params);
      let snapshot = snapshotData;

      if (!snapshot) {
        const cached = getLocalSnapshotCacheEntry(cacheKey);
        if (cached?.snapshot) {
          snapshot = cached.snapshot;
          setSnapshotData(snapshot);
        } else {
          try {
            setSnapshotLoading(true);
            snapshot = await fetchAiDataSnapshot(params);
            setSnapshotData(snapshot);
            storeLocalSnapshotCacheEntry(cacheKey, snapshot);
          } finally {
            setSnapshotLoading(false);
          }
        }
      }

      if (!snapshot || (snapshot.summary?.declarations ?? 0) === 0) {
        throw new Error('Không có dữ liệu KPI trong khoảng đã chọn để tóm tắt.');
      }

      const result = await requestAiCompletion({
        scope: 'report_summary',
        providerId: selectedProviderId || undefined,
        prompt: buildSnapshotSummaryPrompt(snapshot, label, numberFormatter, kpiFormatter),
      });

      setSummaryResult({
        text: result.message || '',
        providerId: result.providerId || selectedProviderId || null,
        usage: result.usage || null,
        cached: !!result.cached,
        generatedAt: new Date().toISOString(),
        rangeLabel: label,
      });
      toast.success(result.cached ? 'Đã lấy tóm tắt KPI từ cache AI.' : 'Đã tạo tóm tắt KPI.');
    } catch (err) {
      const message = err?.message || 'Không thể tạo tóm tắt KPI.';
      setSummaryError(message);
      toast.error(message);
    } finally {
      setSummaryLoading(false);
    }
  }, [kpiFormatter, numberFormatter, selectedProviderId, snapshotData, snapshotRange, summaryRangeOptions]);

  const snapshotPreviewMetrics = useMemo(
    () => buildSnapshotPreviewMetrics(snapshotData, numberFormatter, kpiFormatter),
    [kpiFormatter, numberFormatter, snapshotData]
  );

  const selectedHistoryMetrics = useMemo(
    () => buildSelectedHistoryMetrics(selectedHistoryEntry, numberFormatter, kpiFormatter),
    [kpiFormatter, numberFormatter, selectedHistoryEntry]
  );

  const handleRefreshInsights = useCallback(() => {
    loadInsights();
  }, [loadInsights]);

  const handleRunInsightJob = useCallback(async () => {
    if (insightRunLoading) {
      return;
    }

    setInsightRunLoading(true);
    try {
      const result = await runAiInsightJob();
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.skipped && result.reason === 'no_data') {
        toast.info('Không có dữ liệu KPI mới trong khoảng thời gian mặc định.');
      } else if (result?.cached) {
        toast.success('Đã sử dụng insight gần nhất.');
      } else if (result?.insight) {
        toast.success('Đã sinh insight KPI mới.');
      } else {
        toast.success('Đã chạy insight AI.');
      }
      await loadInsights();
    } catch (err) {
      toast.error(err?.message || 'Không thể chạy insight AI.');
    } finally {
      setInsightRunLoading(false);
    }
  }, [insightRunLoading, loadInsights]);

  const handleInsightFeedback = useCallback(async (insightId, helpful) => {
    if (!insightId) {
      return;
    }

    setFeedbackSubmitting((prev) => ({ ...prev, [insightId]: true }));

    try {
      const response = await submitAiInsightFeedback(insightId, { helpful });
      const totals = response?.totals || { helpful: 0, notHelpful: 0 };
      const viewerFeedback = response?.feedback
        ? {
            helpful: response.feedback.helpful,
            comment: response.feedback.comment || null,
            updatedAt: response.feedback.updatedAt || null,
          }
        : { helpful, comment: null, updatedAt: new Date().toISOString() };

      setInsights((prev) =>
        prev.map((item) => {
          if (item.insightId !== insightId) {
            return item;
          }
          return {
            ...item,
            feedback: {
              helpful: totals.helpful ?? 0,
              notHelpful: totals.notHelpful ?? 0,
              viewer: viewerFeedback,
            },
          };
        })
      );
      toast.success('Đã ghi nhận phản hồi cho insight.');
    } catch (err) {
      toast.error(err?.message || 'Không thể gửi phản hồi insight.');
    } finally {
      setFeedbackSubmitting((prev) => {
        const next = { ...prev };
        delete next[insightId];
        return next;
      });
    }
  }, []);

  const handleToggleNotify = useCallback(async () => {
    if (!canManage) {
      return;
    }

    const nextValue = !notifyOnAnomaly;
    setNotifySaving(true);

    try {
      const settings = await updateAiInsightSettings({ notifyOnAnomaly: nextValue });
      setNotifyOnAnomaly(settings?.notifyOnAnomaly === true);
      toast.success(
        settings?.notifyOnAnomaly === true
          ? 'Đã bật thông báo khi insight cảnh báo bất thường.'
          : 'Đã tắt thông báo insight bất thường.'
      );
    } catch (err) {
      toast.error(err?.message || 'Không thể cập nhật tuỳ chọn insight bất thường.');
    } finally {
      setNotifySaving(false);
    }
  }, [canManage, notifyOnAnomaly]);

  const handleViewHistoryEntry = useCallback(async (entryId) => {
    if (!entryId) {
      return;
    }

    const existing = snapshotHistory.find((item) => item.id === entryId);
    if (existing?.snapshot) {
      setSelectedHistoryEntry(existing);
      return;
    }

    try {
      setSnapshotHistoryLoading(true);
      const fetched = await fetchAiSnapshotHistoryEntry(entryId);
      if (fetched) {
        setSnapshotHistory((prev) => {
          const next = Array.isArray(prev) ? prev.slice() : [];
          const index = next.findIndex((item) => item.id === fetched.id);
          if (index !== -1) {
            next[index] = fetched;
          } else {
            next.unshift(fetched);
          }
          return next;
        });
        setSelectedHistoryEntry(fetched);
      }
    } catch (err) {
      toast.error(err?.message || 'Không thể tải snapshot KPI đã lưu.');
    } finally {
      setSnapshotHistoryLoading(false);
    }
  }, [snapshotHistory]);

  const handleCloseHistoryEntry = useCallback(() => {
    setSelectedHistoryEntry(null);
  }, []);

  const snapshotState = useMemo(
    () => ({
      handleFetchSnapshot,
      handleGenerateSummary,
      loadSnapshotHistory,
      selectedHistoryEntry,
      selectedHistoryMetrics,
      snapshotError,
      snapshotHistory,
      snapshotHistoryError,
      snapshotHistoryLoading,
      snapshotLoading,
      snapshotPreviewMetrics,
      snapshotRange,
      summaryError,
      summaryLoading,
      summaryResult,
      setSnapshotRange,
    }),
    [
      handleFetchSnapshot,
      handleGenerateSummary,
      loadSnapshotHistory,
      selectedHistoryEntry,
      selectedHistoryMetrics,
      snapshotError,
      snapshotHistory,
      snapshotHistoryError,
      snapshotHistoryLoading,
      snapshotLoading,
      snapshotPreviewMetrics,
      snapshotRange,
      summaryError,
      summaryLoading,
      summaryResult,
    ]
  );

  const insightState = useMemo(
    () => ({
      feedbackSubmitting,
      handleCloseHistoryEntry,
      handleInsightFeedback,
      handleRefreshInsights,
      handleRunInsightJob,
      handleToggleNotify,
      handleViewHistoryEntry,
      insightRunLoading,
      insights,
      insightsError,
      insightsLoading,
      insightsMeta,
      notifyOnAnomaly,
      notifySaving,
    }),
    [
      feedbackSubmitting,
      handleCloseHistoryEntry,
      handleInsightFeedback,
      handleRefreshInsights,
      handleRunInsightJob,
      handleToggleNotify,
      handleViewHistoryEntry,
      insightRunLoading,
      insights,
      insightsError,
      insightsLoading,
      insightsMeta,
      notifyOnAnomaly,
      notifySaving,
    ]
  );

  return {
    insightState,
    snapshotState,
  };
}
