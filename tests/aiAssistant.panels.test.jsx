import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import AiAssistantChatPanel from '@/components/ai-assistant/panels/AiAssistantChatPanel.jsx';
import AiAssistantConfigPanel from '@/components/ai-assistant/panels/AiAssistantConfigPanel.jsx';
import AiAssistantHistoryPanel from '@/components/ai-assistant/panels/AiAssistantHistoryPanel.jsx';
import AiAssistantStatusSidebar from '@/components/ai-assistant/panels/AiAssistantStatusSidebar.jsx';

function createPanelProps() {
  return {
    controlClass: 'control-class',
    compactControlClass: 'compact-control-class',
    secondaryButtonClass: 'secondary-button-class',
    formatDateTime: (value) => `fmt:${value}`,
    formatUsage: (usage) => (usage?.total_tokens ?? usage?.totalTokens ? `usage:${usage.total_tokens ?? usage.totalTokens}` : null),
  };
}

describe('AiAssistant panels', () => {
  it('renders chat panel and forwards key actions', () => {
    const handlePingConnection = vi.fn();
    const handleSuggestionClick = vi.fn();
    const base = createPanelProps();

    render(
      <AiAssistantChatPanel
        {...base}
        assistantModes={[{ id: 'business', label: 'Tư vấn', scope: 'business' }]}
        canManage
        configState={{
          availableProviders: [{ id: 'ollama-local', label: 'Ollama nội bộ', isDefault: true }],
          handlePingConnection,
          loadProfile: vi.fn(),
          pingLoading: false,
          pingPrompt: 'Ping hệ thống',
          pingProviderId: 'ollama-local',
          pingState: {
            status: 'success',
            provider: { id: 'ollama-local', label: 'Ollama nội bộ' },
            message: 'pong',
            timestamp: '2025-08-03T07:00:00.000Z',
            usage: { total_tokens: 6 },
          },
          pingUsageSummary: 'Tổng: 6',
          profileDefaultProvider: { id: 'ollama-local', type: 'ollama', label: 'Ollama nội bộ' },
          profileLoading: false,
          providerOptions: [{ id: 'ollama-local', label: 'Ollama nội bộ', isDefault: true }],
          setPingPrompt: vi.fn(),
          setPingProviderId: vi.fn(),
        }}
        conversation={{
          activeMode: {
            scope: 'business',
            description: 'Mô tả chế độ',
            suggestions: [{ label: 'Checklist nhanh', prompt: 'Checklist nhanh' }],
          },
          context: '',
          handleClearHistory: vi.fn(),
          handleModeChange: vi.fn(),
          handleSendPrompt: (event) => event.preventDefault(),
          handleSuggestionClick,
          historyLoading: false,
          messages: [{ id: 'm1', role: 'assistant', text: 'Xin chào' }],
          modeId: 'business',
          prompt: '',
          scope: 'business',
          selectedProviderId: 'ollama-local',
          sending: false,
          setContext: vi.fn(),
          setPrompt: vi.fn(),
          setScope: vi.fn(),
          setSelectedProviderId: vi.fn(),
        }}
        historyPanel={<div>History stub</div>}
        insightState={{
          feedbackSubmitting: {},
          handleCloseHistoryEntry: vi.fn(),
          handleInsightFeedback: vi.fn(),
          handleRefreshInsights: vi.fn(),
          handleRunInsightJob: vi.fn(),
          handleToggleNotify: vi.fn(),
          handleViewHistoryEntry: vi.fn(),
          insightRunLoading: false,
          insights: [
            {
              insightId: 'ins-1',
              createdAt: '2025-08-03T07:00:00.000Z',
              status: 'success',
              response: 'Insight thử nghiệm.',
              meta: { rangeLabel: '2025-08-01 → 2025-08-02' },
              tokens: { total: 12 },
              feedback: { helpful: 0, notHelpful: 0, viewer: null },
            },
          ],
          insightsError: '',
          insightsLoading: false,
          insightsMeta: {
            schedule: { nextRun: '2025-08-04T07:00:00.000Z' },
            state: { lastRunAt: '2025-08-03T07:00:00.000Z', lastStatus: 'success' },
          },
          notifyOnAnomaly: true,
          notifySaving: false,
        }}
        snapshotState={{
          handleFetchSnapshot: vi.fn(),
          handleGenerateSummary: vi.fn(),
          loadSnapshotHistory: vi.fn(),
          selectedHistoryEntry: null,
          selectedHistoryMetrics: [],
          snapshotError: '',
          snapshotHistory: [],
          snapshotHistoryError: '',
          snapshotHistoryLoading: false,
          snapshotLoading: false,
          snapshotPreviewMetrics: ['Có 12 tờ khai'],
          snapshotRange: 'this_month',
          summaryError: '',
          summaryLoading: false,
          summaryResult: null,
          setSnapshotRange: vi.fn(),
        }}
        summaryRangeOptions={[{ value: 'this_month', label: 'Tháng này' }]}
      />
    );

    expect(screen.getByText('Chat với trợ lý AI')).toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu câu hỏi/i)).toBeInTheDocument();
    expect(screen.getByText('Insight thử nghiệm.')).toBeInTheDocument();
    expect(screen.getByText('History stub')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối' }));
    fireEvent.click(screen.getByRole('button', { name: 'Checklist nhanh' }));

    expect(handlePingConnection).toHaveBeenCalledTimes(1);
    expect(handleSuggestionClick).toHaveBeenCalledWith({ label: 'Checklist nhanh', prompt: 'Checklist nhanh' });
  });

  it('renders config panel with internal provider status', () => {
    const handleTestProvider = vi.fn();
    const base = createPanelProps();

    render(
      <AiAssistantConfigPanel
        {...base}
        formatUsage={base.formatUsage}
        providerPresets={[{ key: 'custom', label: 'Tùy chỉnh' }]}
        configState={{
          configError: '',
          configLoading: false,
          configSaving: false,
          draft: {
            enabled: true,
            defaultProvider: 'ollama-local',
            fallbackProvider: '',
            maxTokens: 2048,
            temperature: 0.4,
            maxInputLength: 6000,
            timeoutMs: 30000,
            systemPrompt: 'Bạn là trợ lý nội bộ',
            caching: { enabled: true, ttlMinutes: 10, maxEntries: 50 },
            providers: [
              {
                id: 'ollama-local',
                type: 'ollama',
                label: 'Ollama cục bộ',
                enabled: true,
                endpoint: 'http://localhost:11434',
                deployment: '',
                apiVersion: '',
                apiKeyEnv: 'OLLAMA_HOST',
                model: 'llama3.1:8b',
                temperature: 0.4,
                maxTokens: 2048,
                apiKey: '',
                apiKeyPreview: '',
                hasStoredKey: false,
                clearStoredKey: false,
              },
            ],
          },
          draftDefaultProvider: { id: 'ollama-local', type: 'ollama', label: 'Ollama cục bộ' },
          handleAddProvider: vi.fn(),
          handleCachingChange: vi.fn(),
          handleConfigReset: vi.fn(),
          handleConfigSubmit: (event) => event.preventDefault(),
          handleDraftFieldChange: vi.fn(),
          handleProviderChange: vi.fn(),
          handleRemoveProvider: vi.fn(),
          handleTestProvider,
          loadConfig: vi.fn(),
          newProviderPreset: 'custom',
          providerTests: {
            'ollama-local': {
              status: 'success',
              message: 'Sẵn sàng',
              usage: { total_tokens: 42 },
              checkedAt: '2025-08-03T08:00:00.000Z',
            },
          },
          setNewProviderPreset: vi.fn(),
        }}
      />
    );

    expect(screen.getByText('Cấu hình trợ lý AI')).toBeInTheDocument();
    expect(
      screen.getByText(/mô hình Ollama/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Trực tuyến')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra khóa API' }));
    expect(handleTestProvider).toHaveBeenCalledWith('ollama-local');
  });

  it('renders history panel with active filter state', () => {
    const base = createPanelProps();
    const setHistoryKeyword = vi.fn();

    const { rerender } = render(
      <AiAssistantHistoryPanel
        {...base}
        config={{ providers: [{ id: 'ollama-local', label: 'Ollama cục bộ' }] }}
        conversation={{
          filteredMessages: [
            {
              id: 'm1',
              role: 'assistant',
              text: 'Báo cáo KPI',
              providerId: 'ollama-local',
              createdAt: '2025-08-03T07:00:00.000Z',
              usage: { total_tokens: 10 },
            },
          ],
          hasHistoryFilter: false,
          historyKeyword: '',
          historyLoading: false,
          messages: [{ id: 'm1', role: 'assistant', text: 'Báo cáo KPI' }],
          setHistoryKeyword,
        }}
        profile={{ providers: [{ id: 'ollama-local', label: 'Ollama cục bộ' }] }}
      />
    );

    expect(screen.getByText('1 đoạn hội thoại')).toBeInTheDocument();
    expect(screen.getByText(/Nhà cung cấp/i)).toBeInTheDocument();

    rerender(
      <AiAssistantHistoryPanel
        {...base}
        config={{ providers: [{ id: 'ollama-local', label: 'Ollama cục bộ' }] }}
        conversation={{
          filteredMessages: [],
          hasHistoryFilter: true,
          historyKeyword: 'không khớp',
          historyLoading: false,
          messages: [{ id: 'm1', role: 'assistant', text: 'Báo cáo KPI' }],
          setHistoryKeyword,
        }}
        profile={{ providers: [{ id: 'ollama-local', label: 'Ollama cục bộ' }] }}
      />
    );

    expect(screen.getByText('0/1 đoạn khớp')).toBeInTheDocument();
    expect(screen.getByText('Không tìm thấy hội thoại phù hợp với từ khóa.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(setHistoryKeyword).toHaveBeenCalledWith('');
  });

  it('renders status sidebar and clears cache', () => {
    const handleClearCache = vi.fn();
    const base = createPanelProps();

    render(
      <AiAssistantStatusSidebar
        {...base}
        canManage
        configState={{
          cacheSummary: [
            {
              key: 'cache-1',
              providerId: 'ollama-local',
              promptPreview: 'Tóm tắt KPI',
              responsePreview: 'KPI tăng 10%',
              createdAt: '2025-08-03T07:00:00.000Z',
              actor: 'admin',
              usage: { total_tokens: 20 },
            },
          ],
          clearCacheLoading: false,
          config: { providers: [{ id: 'ollama-local', label: 'Ollama cục bộ' }] },
          configLoading: false,
          handleClearCache,
          loadProfile: vi.fn(),
          profile: {
            enabled: true,
            defaultProvider: 'ollama-local',
            fallbackProvider: '',
            updatedAt: '2025-08-03T07:00:00.000Z',
            caching: { enabled: true, ttlMinutes: 10, maxEntries: 50 },
            providers: [{ id: 'ollama-local', label: 'Ollama cục bộ', enabled: true }],
          },
          profileError: '',
          profileLoading: false,
        }}
      />
    );

    expect(screen.getByText('Trạng thái')).toBeInTheDocument();
    expect(screen.getAllByText('Ollama cục bộ').length).toBeGreaterThan(0);
    expect(screen.getByText('Tóm tắt KPI')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa cache' }));
    expect(handleClearCache).toHaveBeenCalledTimes(1);
  });
});
