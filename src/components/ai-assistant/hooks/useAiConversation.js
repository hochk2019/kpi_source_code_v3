import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from '@/shared/toast';
import {
  clearAiHistory,
  fetchAiHistory,
  requestAiCompletion,
  saveAiHistory,
} from '@/lib/aiClient.js';
import {
  createMessageId,
  getLocalHistoryKey,
  limitHistory,
  prepareMessagesForStorage,
  readLocalHistory,
  removeLocalHistory,
  sanitizeHistoryMessage,
  writeLocalHistory,
} from '@/components/ai-assistant/historyStore.js';

export function useAiConversation({
  canUse,
  username,
  assistantModes,
  profileDefaultProvider,
}) {
  const safeModes = useMemo(
    () => (
      Array.isArray(assistantModes) && assistantModes.length > 0
        ? assistantModes
        : [{ id: 'general', label: 'Tổng quát', scope: 'general', prefillContext: '' }]
    ),
    [assistantModes]
  );
  const defaultMode = safeModes[0];
  const isAuthenticated = !!username;
  const historyStorageKey = useMemo(() => getLocalHistoryKey(username), [username]);

  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState(defaultMode.prefillContext ?? '');
  const [scope, setScope] = useState(defaultMode.scope || 'general');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [modeId, setModeId] = useState(defaultMode.id);
  const [historyKeyword, setHistoryKeyword] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);

  const historyLoadErrorShownRef = useRef(false);
  const historyPersistErrorShownRef = useRef(false);
  const lastSavedSnapshotRef = useRef(JSON.stringify([]));

  const activeMode = useMemo(
    () => safeModes.find((mode) => mode.id === modeId) || defaultMode,
    [defaultMode, modeId, safeModes]
  );

  const appendMessage = useCallback((entry) => {
    const sanitized = sanitizeHistoryMessage(entry);
    if (!sanitized) {
      return;
    }
    setMessages((prev) => {
      const next = Array.isArray(prev) ? prev.slice() : [];
      next.push(sanitized);
      const limited = limitHistory(next);
      return Array.isArray(limited) ? limited : next;
    });
  }, []);

  const handleModeChange = useCallback((nextModeId) => {
    setModeId(nextModeId);
    const preset = safeModes.find((mode) => mode.id === nextModeId);
    if (preset?.scope) {
      setScope(preset.scope);
    }
    if (preset) {
      setContext(preset.prefillContext ?? '');
    }
  }, [safeModes]);

  const handleSuggestionClick = useCallback((suggestion) => {
    if (!suggestion) {
      return;
    }
    if (suggestion.scope) {
      setScope(suggestion.scope);
    }
    if (suggestion.context !== undefined) {
      setContext(suggestion.context);
    }
    if (suggestion.prompt) {
      setPrompt(suggestion.prompt);
    }
  }, []);

  useEffect(() => {
    if (!canUse) {
      setMessages([]);
      setHistoryLoading(false);
      setHistoryReady(false);
      lastSavedSnapshotRef.current = JSON.stringify([]);
      historyLoadErrorShownRef.current = false;
      historyPersistErrorShownRef.current = false;
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryReady(false);
    historyLoadErrorShownRef.current = false;

    (async () => {
      try {
        let loaded = [];
        if (isAuthenticated) {
          const serverMessages = await fetchAiHistory();
          loaded = prepareMessagesForStorage(serverMessages);
        } else {
          loaded = readLocalHistory(historyStorageKey);
        }

        if (cancelled) {
          return;
        }

        setMessages(loaded);
        lastSavedSnapshotRef.current = JSON.stringify(prepareMessagesForStorage(loaded));
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error('Không thể tải lịch sử trợ lý AI', err);
        if (!historyLoadErrorShownRef.current) {
          toast.error(err?.message || 'Không thể tải lịch sử trò chuyện AI.');
          historyLoadErrorShownRef.current = true;
        }

        const fallback = isAuthenticated ? [] : readLocalHistory(historyStorageKey);
        setMessages(fallback);
        lastSavedSnapshotRef.current = JSON.stringify(prepareMessagesForStorage(fallback));
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
          setHistoryReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canUse, historyStorageKey, isAuthenticated]);

  useEffect(() => {
    if (!canUse || !historyReady) {
      return;
    }

    const sanitized = prepareMessagesForStorage(messages);
    const snapshot = JSON.stringify(sanitized);
    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    let cancelled = false;

    const persist = async () => {
      try {
        if (isAuthenticated) {
          if (sanitized.length === 0) {
            await clearAiHistory();
          } else {
            await saveAiHistory(sanitized);
          }
        } else if (sanitized.length === 0) {
          removeLocalHistory(historyStorageKey);
        } else {
          writeLocalHistory(historyStorageKey, sanitized);
        }

        if (!cancelled) {
          lastSavedSnapshotRef.current = snapshot;
          historyPersistErrorShownRef.current = false;
        }
      } catch (err) {
        console.error('Không thể lưu lịch sử trợ lý AI', err);
        if (!historyPersistErrorShownRef.current) {
          toast.error(err?.message || 'Không thể lưu lịch sử trò chuyện AI.');
          historyPersistErrorShownRef.current = true;
        }
      }
    };

    persist();
    return () => {
      cancelled = true;
    };
  }, [canUse, historyReady, historyStorageKey, isAuthenticated, messages]);

  useEffect(() => {
    if (!selectedProviderId && profileDefaultProvider) {
      setSelectedProviderId(profileDefaultProvider);
    }
  }, [profileDefaultProvider, selectedProviderId]);

  const filteredMessages = useMemo(() => {
    const keyword = historyKeyword.trim().toLowerCase();
    if (!keyword) {
      return messages;
    }
    return messages.filter((message) => {
      const text = `${message?.text || ''}`.toLowerCase();
      const scopeText = `${message?.scope || ''}`.toLowerCase();
      return text.includes(keyword) || scopeText.includes(keyword);
    });
  }, [historyKeyword, messages]);

  const hasHistoryFilter = historyKeyword.trim().length > 0;

  const handleSendPrompt = useCallback(async (event) => {
    event.preventDefault();
    if (!canUse || sending) {
      return;
    }
    if (!historyReady) {
      toast.error('Đang tải lịch sử hội thoại, vui lòng thử lại sau vài giây.');
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    const scopeValue = (activeMode?.scope || scope || 'general').trim() || 'general';
    const contextText = context.trim();
    const providerId = selectedProviderId || undefined;
    const userMessage = {
      id: createMessageId(),
      role: 'user',
      text: trimmedPrompt,
      scope: scopeValue,
      createdAt: new Date().toISOString(),
    };

    appendMessage(userMessage);
    setPrompt('');
    setSending(true);

    try {
      const result = await requestAiCompletion({
        prompt: trimmedPrompt,
        context: contextText,
        providerId,
        scope: scopeValue,
        systemPrompt: activeMode?.systemPrompt,
      });

      const assistantMessage = {
        id: createMessageId(),
        role: 'assistant',
        text: result.message || '',
        providerId: result.providerId || providerId || profileDefaultProvider || null,
        cached: !!result.cached,
        usage: result.usage || null,
        scope: result.scope || scopeValue,
        createdAt: new Date().toISOString(),
      };

      appendMessage(assistantMessage);
      toast.success(result.cached ? 'Đã trả lời từ cache.' : 'Đã nhận phản hồi từ trợ lý AI.');
    } catch (err) {
      const errorMessage = err?.message || 'Không thể gọi trợ lý AI.';
      const errorEntry = {
        id: createMessageId(),
        role: 'error',
        text: errorMessage,
        scope: scopeValue,
        createdAt: new Date().toISOString(),
      };
      appendMessage(errorEntry);
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  }, [
    activeMode,
    appendMessage,
    canUse,
    context,
    historyReady,
    profileDefaultProvider,
    prompt,
    scope,
    selectedProviderId,
    sending,
  ]);

  const handleClearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    activeMode,
    context,
    filteredMessages,
    handleClearHistory,
    handleModeChange,
    handleSendPrompt,
    handleSuggestionClick,
    hasHistoryFilter,
    historyKeyword,
    historyLoading,
    historyReady,
    messages,
    modeId,
    prompt,
    scope,
    selectedProviderId,
    sending,
    setContext,
    setHistoryKeyword,
    setPrompt,
    setScope,
    setSelectedProviderId,
  };
}
