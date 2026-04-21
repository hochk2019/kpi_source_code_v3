import React, { useMemo } from 'react';
import {
  Bot,
  ShieldAlert,
  Settings2,
  MessageSquare,
  History,
  Activity,
} from 'lucide-react';

import AiAssistantChatPanel from '@/components/ai-assistant/panels/AiAssistantChatPanel.jsx';
import AiAssistantConfigPanel from '@/components/ai-assistant/panels/AiAssistantConfigPanel.jsx';
import AiAssistantHistoryPanel from '@/components/ai-assistant/panels/AiAssistantHistoryPanel.jsx';
import AiAssistantStatusSidebar from '@/components/ai-assistant/panels/AiAssistantStatusSidebar.jsx';
import { useAiAssistantConfig } from '@/components/ai-assistant/hooks/useAiAssistantConfig.js';
import { useAiConversation } from '@/components/ai-assistant/hooks/useAiConversation.js';
import { useAiAssistantInsightWorkspace } from '@/components/ai-assistant/hooks/useAiAssistantInsightWorkspace.js';

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
  'rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-sm transition-all focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-800';
const CONTROL_CLASS_COMPACT =
  'rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-1 text-sm text-slate-800 shadow-sm transition-all focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-800';
const SECONDARY_BUTTON_CLASS =
  'rounded-lg border border-slate-200/60 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
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
  const { insightState, snapshotState } = useAiAssistantInsightWorkspace({
    canManage,
    canUse,
    selectedProviderId: conversation.selectedProviderId,
    summaryRangeOptions: SUMMARY_RANGE_OPTIONS,
  });

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
    <div className="space-y-6 animate-in fade-in duration-500">
      {!canUse ? (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/80 backdrop-blur-sm px-5 py-4 shadow-sm dark:border-amber-500/20 dark:bg-amber-900/10">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-amber-100 p-2 dark:bg-amber-500/20">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Chưa có quyền truy cập</h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400/80">
                Tài khoản hiện chưa được cấp quyền sử dụng trợ lý AI. Vui lòng liên hệ quản trị viên để được kích hoạt quyền{' '}
                <code className="rounded bg-amber-200/60 px-1.5 py-0.5 text-xs font-mono font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
                  aiAssistUse
                </code>.
              </p>
            </div>
          </div>
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

          <div className="flex flex-col gap-5">
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
