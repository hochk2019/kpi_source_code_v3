import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
import AiAssistantChatPanel from '@/components/ai-assistant/panels/AiAssistantChatPanel.jsx';
import AiAssistantConfigPanel from '@/components/ai-assistant/panels/AiAssistantConfigPanel.jsx';
import AiAssistantHistoryPanel from '@/components/ai-assistant/panels/AiAssistantHistoryPanel.jsx';
import AiAssistantStatusSidebar from '@/components/ai-assistant/panels/AiAssistantStatusSidebar.jsx';
import { useAiAssistantConfig } from '@/components/ai-assistant/hooks/useAiAssistantConfig.js';
import { useAiConversation } from '@/components/ai-assistant/hooks/useAiConversation.js';
import { computeQuickRange } from '@/lib/reports.js';

function formatDateTime(value) {
  if (!value) {
    return 'Chưa có';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Chưa có';
  }

  return date.toLocaleString('vi-VN');
}

function formatUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return null;
  }

  const prompt = usage.prompt_tokens ?? usage.promptTokens;
  const completion = usage.completion_tokens ?? usage.completionTokens;
  const total = usage.total_tokens ?? usage.totalTokens;
  const parts = [];

  if (Number.isFinite(prompt)) {
    parts.push(`Prompt: ${prompt}`);
  }
  if (Number.isFinite(completion)) {
    parts.push(`Hoàn thành: ${completion}`);
  }
  if (Number.isFinite(total)) {
    parts.push(`Tổng: ${total}`);
  }

  return parts.length > 0 ? parts.join(' • ') : null;
}

const AI_PROVIDER_PRESETS = [
  {
    key: 'openai-gpt4o',
    label: 'OpenAI GPT-4o mini',
    idBase: 'openai-gpt4o',
    type: 'openai',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
  },
  {
    key: 'anthropic-claude',
    label: 'Anthropic Claude 3.5 Sonnet',
    idBase: 'anthropic-claude',
    type: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiVersion: '2023-06-01',
    temperature: 0.2,
    maxTokens: 1024,
  },
  {
    key: 'google-gemini',
    label: 'Google AI Studio Gemini',
    idBase: 'google-ai-studio',
    type: 'google-ai-studio',
    endpoint: 'https://generativelanguage.googleapis.com',
    model: 'gemini-1.5-flash',
    apiKeyEnv: 'GOOGLE_AI_STUDIO_API_KEY',
    temperature: 0.3,
    maxTokens: 1024,
  },
  {
    key: 'azure-custom',
    label: 'Azure OpenAI (tùy chỉnh)',
    idBase: 'azure-openai',
    type: 'azure',
    endpoint: '',
    deployment: '',
    apiVersion: '2024-08-01-preview',
    apiKeyEnv: 'AZURE_OPENAI_KEY',
    temperature: 0.2,
    maxTokens: 2048,
  },
  {
    key: 'deepseek',
    label: 'DeepSeek Chat',
    idBase: 'deepseek-chat',
    type: 'deepseek',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    temperature: 0.2,
    maxTokens: 2048,
  },
  {
    key: 'qwen',
    label: 'Alibaba Qwen',
    idBase: 'qwen-plus',
    type: 'qwen',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    apiKeyEnv: 'QWEN_API_KEY',
    temperature: 0.2,
    maxTokens: 2048,
  },
  {
    key: 'baidu',
    label: 'Baidu Qianfan ERNIE',
    idBase: 'baidu-ernie',
    type: 'baidu',
    endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
    model: 'ernie-speed-128k',
    apiKeyEnv: 'BAIDU_QIANFAN_ACCESS_TOKEN',
    temperature: 0.2,
    maxTokens: 1024,
  },
  {
    key: 'zai',
    label: 'Z.AI Chat',
    idBase: 'zai-chat',
    type: 'zai',
    endpoint: 'https://api.z-ai.com/v1',
    model: 'zai-chat-pro',
    apiKeyEnv: 'ZAI_API_KEY',
    temperature: 0.2,
    maxTokens: 2048,
  },
  {
    key: 'custom',
    label: 'Nhà cung cấp tùy chỉnh',
    idBase: 'custom-provider',
    type: 'custom',
    endpoint: '',
    model: '',
  },
];

const ASSISTANT_MODES = [
  {
    id: 'business',
    label: 'Tư vấn nghiệp vụ',
    scope: 'business',
    description: 'Giải đáp quy trình nghiệp vụ, chính sách KPI và phối hợp giữa các bộ phận.',
    systemPrompt:
      'Bạn là chuyên gia nghiệp vụ hải quan tại Golden Logistics. Hãy cung cấp câu trả lời chi tiết, bám sát quy trình nội bộ, '
      + 'đưa ra khuyến nghị hành động rõ ràng và nhấn mạnh các bước kiểm soát rủi ro.',
    prefillContext:
      'Ưu tiên nhắc lại bước phê duyệt KPI, trách nhiệm từng vai trò và thời gian xử lý theo quy định nội bộ.',
    suggestions: [
      {
        label: 'Quy trình duyệt KPI tháng',
        prompt: 'Tóm tắt quy trình duyệt KPI tháng cho tổ đội mới tham gia hệ thống.',
      },
      {
        label: 'Chuẩn hóa phân công nhân viên',
        prompt: 'Gợi ý cách phân công nhân viên phụ trách tờ khai khi thiếu thông tin từ ECUS.',
      },
      {
        label: 'Checklist bàn giao dữ liệu',
        prompt: 'Liệt kê checklist bàn giao dữ liệu giữa bộ phận nhập liệu và trưởng nhóm.',
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Thống kê nhanh',
    scope: 'analytics',
    description: 'Thực hiện tổng hợp số liệu KPI, so sánh xu hướng và nêu điểm bất thường.',
    systemPrompt:
      'Bạn là chuyên gia phân tích dữ liệu KPI. Hãy sử dụng giọng điệu súc tích, cung cấp số liệu theo bảng/bullet, '
      + 'nhấn mạnh các chênh lệch đáng chú ý và đề xuất hành động xử lý.',
    prefillContext:
      'Sử dụng dữ liệu KPI đã đồng bộ 6 kỳ gần nhất. Ưu tiên hiển thị số liệu dạng bảng, phần trăm tăng/giảm.',
    suggestions: [
      {
        label: 'So sánh KPI theo tổ',
        prompt: 'So sánh KPI 3 tháng gần nhất của các tổ đội và đánh giá xu hướng tăng/giảm.',
      },
      {
        label: 'Top nhân viên tăng trưởng',
        prompt: 'Liệt kê top 5 nhân viên có mức tăng KPI cao nhất so với kỳ trước.',
      },
      {
        label: 'Cảnh báo tụt hạng',
        prompt: 'Phát hiện tổ đội nào đang tụt hạng KPI liên tiếp và đề xuất cách cải thiện.',
      },
    ],
  },
  {
    id: 'data-entry',
    label: 'Trợ giúp nhập liệu',
    scope: 'data-entry',
    description: 'Hướng dẫn chuẩn hóa tờ khai, loại trừ trùng lặp và cập nhật giấy phép nhanh chóng.',
    systemPrompt:
      'Bạn là trợ lý hỗ trợ nhập liệu tờ khai. Hãy cung cấp hướng dẫn từng bước, nêu rõ vị trí thao tác trong hệ thống và '
      + 'nhắc nhở kiểm tra dữ liệu trùng hoặc thiếu.',
    prefillContext:
      'Tập trung vào module Import Data, chức năng làm sạch trùng 11 số đầu và xử lý cảnh báo thiếu nhân viên/tổ đội.',
    suggestions: [
      {
        label: 'Làm sạch trùng 11 số',
        prompt: 'Hướng dẫn thao tác xóa bản trùng 11 số đầu nhưng vẫn giữ bản mới nhất.',
      },
      {
        label: 'Đối soát giấy phép',
        prompt: 'Các bước rà soát lại giấy phép sau khi import Excel để tránh cộng trùng.',
      },
      {
        label: 'Xử lý cảnh báo thiếu thông tin',
        prompt: 'Chi tiết từng bước xử lý cảnh báo tờ khai thiếu nhân viên hoặc tổ đội.',
      },
    ],
  },
];

const CONTROL_CLASS =
  'rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0';
const CONTROL_CLASS_COMPACT =
  'rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0';
const SECONDARY_BUTTON_CLASS =
  'rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60';
const SUMMARY_RANGE_OPTIONS = [
  { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'this_quarter', label: 'Quý này' },
];

export default function AiAssistant({ currentUser }) {
  const permissions = currentUser?.permissions || {};
  const canUse = permissions.aiAssistUse === true || permissions.aiAssistManage === true;
  const canManage = permissions.aiAssistManage === true;
  const username = currentUser?.username || '';

  const configState = useAiAssistantConfig({
    canManage,
    canUse,
    providerPresets: AI_PROVIDER_PRESETS,
  });
  const { profile } = configState;

  const conversation = useAiConversation({
    assistantModes: ASSISTANT_MODES,
    canUse,
    profileDefaultProvider: profile?.defaultProvider || '',
    username,
  });
  const { selectedProviderId } = conversation;

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

  const buildRangeParams = useCallback(() => {
    const option = SUMMARY_RANGE_OPTIONS.find((item) => item.value === snapshotRange);
    const range = computeQuickRange(snapshotRange);
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
  }, [snapshotRange]);

  const buildSnapshotSummaryPrompt = useCallback((snapshot, rangeLabel) => {
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
  }, [kpiFormatter, numberFormatter]);

  const handleFetchSnapshot = useCallback(async ({ force = false } = {}) => {
    const { params, label } = buildRangeParams();
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
  }, [buildRangeParams]);

  const handleGenerateSummary = useCallback(async () => {
    setSummaryError('');
    setSummaryResult(null);
    setSummaryLoading(true);

    try {
      const { params, label } = buildRangeParams();
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
        prompt: buildSnapshotSummaryPrompt(snapshot, label),
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
  }, [buildRangeParams, buildSnapshotSummaryPrompt, selectedProviderId, snapshotData]);

  const snapshotPreviewMetrics = useMemo(() => {
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
  }, [kpiFormatter, numberFormatter, snapshotData]);

  const selectedHistoryMetrics = useMemo(() => {
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
  }, [kpiFormatter, numberFormatter, selectedHistoryEntry]);

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

  const historyPanel = useMemo(
    () => (
      <AiAssistantHistoryPanel
        config={configState.config}
        conversation={conversation}
        controlClass={CONTROL_CLASS}
        formatDateTime={formatDateTime}
        formatUsage={formatUsage}
        profile={configState.profile}
        secondaryButtonClass={SECONDARY_BUTTON_CLASS}
      />
    ),
    [configState.config, configState.profile, conversation]
  );

  return (
    <div className="space-y-6">
      {!canUse ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tài khoản hiện chưa được cấp quyền sử dụng trợ lý AI. Vui lòng liên hệ quản trị viên để được kích hoạt quyền
          <span className="font-medium"> aiAssistUse</span>.
        </div>
      ) : null}

      {canUse ? (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <AiAssistantChatPanel
            assistantModes={ASSISTANT_MODES}
            canManage={canManage}
            configState={configState}
            compactControlClass={CONTROL_CLASS_COMPACT}
            controlClass={CONTROL_CLASS}
            conversation={conversation}
            formatDateTime={formatDateTime}
            formatUsage={formatUsage}
            historyPanel={historyPanel}
            insightState={insightState}
            secondaryButtonClass={SECONDARY_BUTTON_CLASS}
            snapshotState={snapshotState}
            summaryRangeOptions={SUMMARY_RANGE_OPTIONS}
          />

          <div className="flex flex-col gap-4">
            <AiAssistantStatusSidebar
              canManage={canManage}
              configState={configState}
              formatDateTime={formatDateTime}
              formatUsage={formatUsage}
            />

            {canManage ? (
              <AiAssistantConfigPanel
                compactControlClass={CONTROL_CLASS_COMPACT}
                configState={configState}
                controlClass={CONTROL_CLASS}
                formatUsage={formatUsage}
                providerPresets={AI_PROVIDER_PRESETS}
                secondaryButtonClass={SECONDARY_BUTTON_CLASS}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
