import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

import {

  BarChart3,

  BookOpenCheck,

  Building2,

  ClipboardList,

  Command as CommandIcon,

  FileSpreadsheet,

  Filter,

  HelpCircle,

  History,

  Layers3,

  ListChecks,

  LogIn,

  LogOut,

  MessageSquare,

  MoonStar,

  MonitorSmartphone,

  Pin,

  PinOff,

  Search,

  Settings2,

  Sparkles,

  Sun,

  Users,

} from 'lucide-react';

import { emitCommand, subscribeCommand } from '@/lib/commandBus.js';

import { getAppShellAccess, getVisibleAppTabs } from '@/lib/appShellNavigation.js';
import { SearchField } from '@/components/designSystem/shellPrimitives.jsx';

import { useTheme } from '@/designSystem/useTheme.js';



const PIN_STORAGE_KEY = 'kpi_command_center_pins_v1';

const USAGE_STORAGE_KEY = 'kpi_command_center_usage_v1';



function loadJsonFromStorage(key, fallback) {

  if (typeof window === 'undefined') {

    return fallback;

  }

  try {

    const raw = window.localStorage.getItem(key);

    if (!raw) return fallback;

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === 'object' ? parsed : fallback;

  } catch {

    return fallback;

  }

}



function saveJsonToStorage(key, value) {

  if (typeof window === 'undefined') {

    return;

  }

  try {

    window.localStorage.setItem(key, JSON.stringify(value));

  } catch (error) {

    console.warn('Không thể lưu trạng thái Command Center', error);

  }

}



const GROUP_TITLES = {

  navigation: 'Điều hướng nhanh',

  data: 'Dữ liệu & vận hành',

  support: 'Hỗ trợ & đào tạo',

  display: 'Giao diện & cá nhân hóa',

  account: 'Tài khoản',

  automation: 'Tự động hoá & tiện ích',

};

const NAVIGATION_ICONS = {

  mst: Users,

  hq: Building2,

  import: FileSpreadsheet,

  teams: Users,

  rules: Settings2,

  adjustments: Layers3,

  reports: BarChart3,

  health: ListChecks,

  ai: Sparkles,

  accounts: Settings2,

  audit: ClipboardList,

  'export-audit': History,

};



function buildCommands({

  currentUser,

  onRequestLogin,

  onRequestLogout,

  onRequestChangePassword,

  setTheme,

  themePreference,

}) {

  const isLoggedIn = Boolean(currentUser?.username && currentUser.username !== 'guest');

  const access = getAppShellAccess(currentUser);

  const loginHandler = typeof onRequestLogin === 'function' ? onRequestLogin : () => {};

  const logoutHandler = typeof onRequestLogout === 'function' ? onRequestLogout : () => {};

  const changePasswordHandler =

    typeof onRequestChangePassword === 'function' ? onRequestChangePassword : () => {};

  const themeHandler = typeof setTheme === 'function' ? setTheme : () => {};

  const commands = [
    ...getVisibleAppTabs(currentUser).map((tab) => ({
      id: `navigate:${tab.id}`,
      group: 'navigation',
      label: tab.commandLabel || `Đi tới tab ${tab.label}`,
      description: tab.commandDescription || tab.tooltip,
      icon: NAVIGATION_ICONS[tab.id] || CommandIcon,
      keywords: tab.commandKeywords || [],
      run: () => emitCommand('navigate:tab', { tab: tab.id }),
    })),

    {

      id: 'data:favorites',

      group: 'data',

      label: 'Quản lý bộ lọc yêu thích',

      description: 'Áp dụng nhanh preset bộ lọc trong Import Data',

      icon: Filter,

      keywords: ['bo loc', 'preset', 'yeu thich'],

      run: () => emitCommand('navigate:tab', { tab: 'import', focus: 'favorites' }),

    },

    {

      id: 'data:sync-status',

      group: 'data',

      label: 'Kiểm tra trạng thái đồng bộ ECUS',

      description: 'Mở bảng theo dõi đồng bộ và nhật ký lỗi gần nhất',

      icon: History,

      keywords: ['dong bo', 'ecus', 'nhat ky'],

      run: () => emitCommand('navigate:tab', { tab: 'health', focus: 'sync' }),

      hidden: !access.canViewDataHealth,

    },

    {

      id: 'support:open-center',

      group: 'support',

      label: 'Mở Trung tâm hỗ trợ & đào tạo',

      description: 'Xem tài liệu hướng dẫn và tiến độ đào tạo cá nhân',

      icon: BookOpenCheck,

      keywords: ['dao tao', 'tai lieu', 'huong dan'],

      run: () => emitCommand('open:support', { tab: 'training' }),

    },

    {

      id: 'support:feedback',

      group: 'support',

      label: 'Gửi góp ý cho đội vận hành',

      description: 'Mở thẳng tab góp ý trong trung tâm hỗ trợ',

      icon: MessageSquare,

      keywords: ['feedback', 'gop y', 'phan hoi'],

      run: () => emitCommand('open:support', { tab: 'feedback' }),

    },

    {

      id: 'support:notifications',

      group: 'support',

      label: 'Xem thông báo hệ thống',

      description: 'Theo dõi sự kiện đồng bộ, cảnh báo và nhắc việc',

      icon: HelpCircle,

      keywords: ['thong bao', 'notification'],

      run: () => emitCommand('open:notifications'),

    },

    {

      id: 'display:theme-light',

      group: 'display',

      label: 'Chuyển sang giao diện sáng',

      description: 'Tông sáng phù hợp môi trường văn phòng',

      icon: Sun,

      keywords: ['theme', 'giao dien', 'light'],

      run: () => themeHandler('light'),

      hidden: themePreference === 'light',

    },

    {

      id: 'display:theme-dark',

      group: 'display',

      label: 'Chuyển sang giao diện tối',

      description: 'Giảm chói mắt khi làm việc ban đêm',

      icon: MoonStar,

      keywords: ['theme', 'dark', 'toi'],

      run: () => themeHandler('dark'),

      hidden: themePreference === 'dark',

    },

    {

      id: 'display:theme-system',

      group: 'display',

      label: 'Theo dõi theme của Windows',

      description: 'Tự đồng bộ với chế độ sáng/tối của hệ điều hành',

      icon: MonitorSmartphone,

      keywords: ['theme', 'system'],

      run: () => themeHandler('system'),

      hidden: themePreference === 'system',

    },

    {

      id: 'display:theme-contrast',

      group: 'display',

      label: 'Bật theme tương phản cao',

      description: 'Tăng độ tương phản, hỗ trợ người khiếm thị',

      icon: CommandIcon,

      keywords: ['theme', 'high contrast', 'tương phản'],

      run: () => themeHandler('high-contrast'),

      hidden: themePreference === 'high-contrast',

    },

    {

      id: 'automation:export-dashboard',

      group: 'automation',

      label: 'Mở hướng dẫn xuất dashboard PNG',

      description: 'Xem nhanh cách xuất hình ảnh dashboard KPI',

      icon: BarChart3,

      keywords: ['xuat', 'png', 'bao cao'],

      run: () => emitCommand('navigate:tab', { tab: 'reports', focus: 'export' }),

    },

  ];



  if (isLoggedIn) {

    commands.push(

      {

        id: 'account:change-password',

        group: 'account',

        label: 'Đổi mật khẩu đăng nhập',

        description: 'Tăng cường bảo mật cho tài khoản nội bộ',

        icon: Settings2,

        keywords: ['mat khau', 'bao mat'],

        run: changePasswordHandler,

      },

      {

        id: 'account:logout',

        group: 'account',

        label: 'Đăng xuất khỏi hệ thống',

        description: 'Kết thúc phiên làm việc hiện tại',

        icon: LogOut,

        keywords: ['dang xuat', 'logout'],

        run: logoutHandler,

      },

    );

  } else {

    commands.push({

      id: 'account:login',

      group: 'account',

      label: 'Đăng nhập quản trị',

      description: 'Mở hộp thoại đăng nhập tài khoản admin',

      icon: LogIn,

      keywords: ['dang nhap', 'admin'],

      run: loginHandler,

    });

  }



  return commands.filter((item) => !item.hidden);

}



function formatResults(commands, pinnedIds, usage, query) {

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = commands.filter((command) => {

    if (!normalizedQuery) {

      return true;

    }

    const haystack = [command.label, command.description, ...(command.keywords || [])]

      .filter(Boolean)

      .join(' ')

      .toLowerCase();

    return haystack.includes(normalizedQuery);

  });



  const decorated = filtered

    .map((command) => {

      const usageInfo = usage?.[command.id] || { count: 0, lastUsedAt: null };

      return { ...command, usageInfo };

    })

    .sort((a, b) => {

      if (!normalizedQuery) {

        const aPinned = pinnedIds.includes(a.id);

        const bPinned = pinnedIds.includes(b.id);

        if (aPinned && !bPinned) return -1;

        if (!aPinned && bPinned) return 1;

        if (a.usageInfo.count !== b.usageInfo.count) {

          return b.usageInfo.count - a.usageInfo.count;

        }

      }

      return a.label.localeCompare(b.label, 'vi');

    });



  const groups = [];

  const groupMap = new Map();

  for (const command of decorated) {

    const key = command.group || 'khac';

    if (!groupMap.has(key)) {

      groupMap.set(key, []);

    }

    groupMap.get(key).push(command);

  }

  for (const [group, items] of groupMap.entries()) {

    groups.push({

      type: 'header',

      id: `header:${group}`,

      title: GROUP_TITLES[group] || 'Khác',

    });

    for (const item of items) {

      groups.push({ type: 'command', command: item });

    }

  }

  return groups;

}



function loadPins() {

  const raw = loadJsonFromStorage(PIN_STORAGE_KEY, []);

  return Array.isArray(raw) ? raw.filter((item) => typeof item === 'string') : [];

}



function loadUsage() {

  const raw = loadJsonFromStorage(USAGE_STORAGE_KEY, {});

  return raw && typeof raw === 'object' ? raw : {};

}



export default function CommandCenter({

  currentUser,

  onRequestLogin,

  onRequestLogout,

  onRequestChangePassword,

  className = '',

}) {

  const { theme, setTheme } = useTheme();

  const [open, setOpen] = useState(false);

  const [query, setQuery] = useState('');

  const [pinned, setPinned] = useState(() => loadPins());

  const [usage, setUsage] = useState(() => loadUsage());

  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef(null);
  const dialogId = useId();
  const dialogTitleId = useId();



  const commands = useMemo(

    () =>

      buildCommands({

        currentUser,

        onRequestLogin,

        onRequestLogout,

        onRequestChangePassword,

        setTheme,

        themePreference: theme,

      }),

    [currentUser, onRequestLogin, onRequestLogout, onRequestChangePassword, setTheme, theme],

  );



  const entries = useMemo(() => formatResults(commands, pinned, usage, query), [commands, pinned, usage, query]);

  const visibleCommands = entries.filter((entry) => entry.type === 'command');

  const activeCommand = visibleCommands[highlightedIndex]?.command || null;



  useEffect(() => {

    if (!open) {

      setQuery('');

      setHighlightedIndex(0);

      return;

    }

    const timer = window.setTimeout(() => {

      inputRef.current?.focus();

    }, 60);

    return () => window.clearTimeout(timer);

  }, [open]);



  useEffect(() => {

    const handleKeyDown = (event) => {

      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {

        event.preventDefault();

        setOpen((value) => !value);

      } else if (event.key === 'Escape') {

        setOpen(false);

      }

    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);

  }, []);

  useEffect(() => {
    const unsubscribe = subscribeCommand((id) => {
      if (id === 'open:command-center') {
        setOpen(true);
      }
    });

    return () => unsubscribe();
  }, []);



  const handleRunCommand = (command) => {

    if (!command || typeof command.run !== 'function') {

      return;

    }

    setOpen(false);

    setUsage((prev) => {

      const next = { ...prev };

      const entry = next[command.id] || { count: 0, lastUsedAt: null };

      entry.count += 1;

      entry.lastUsedAt = new Date().toISOString();

      next[command.id] = entry;

      saveJsonToStorage(USAGE_STORAGE_KEY, next);

      return next;

    });

    window.setTimeout(() => {

      try {

        command.run();

      } catch (error) {

        console.error('Không thể thực thi command', command.id, error);

      }

    }, 10);

  };



  const togglePin = (commandId) => {

    setPinned((prev) => {

      const next = prev.includes(commandId)

        ? prev.filter((item) => item !== commandId)

        : [...prev, commandId];

      saveJsonToStorage(PIN_STORAGE_KEY, next);

      return next;

    });

  };



  const handleKeyNavigation = (event) => {

    if (!visibleCommands.length) {

      return;

    }

    if (event.key === 'ArrowDown') {

      event.preventDefault();

      setHighlightedIndex((prev) => (prev + 1) % visibleCommands.length);

    } else if (event.key === 'ArrowUp') {

      event.preventDefault();

      setHighlightedIndex((prev) => (prev - 1 + visibleCommands.length) % visibleCommands.length);

    } else if (event.key === 'Enter') {

      event.preventDefault();

      handleRunCommand(activeCommand);

    }

  };



  return (

    <>

      <button

        type="button"

        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}

        className={`inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-600 shadow-sm transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent-ring)] dark:border-gray-700 dark:text-gray-200 dark:hover:bg-slate-800 ${className}`.trim()}

        data-tooltip="Mở Command Center (Ctrl+K)"

      >

        <Search className="h-4 w-4" />

        <span className="hidden sm:inline">Command Center</span>

      </button>

      {open ? (

        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-24 backdrop-blur-sm">

          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition dark:border-slate-700 dark:bg-slate-900"
          >

            <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4 dark:border-slate-700">
              <h2 id={dialogTitleId} className="sr-only">
                Command Center
              </h2>

              <SearchField
                ref={inputRef}
                label="Tìm thao tác trong Command Center"
                hideLabel
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyNavigation}
                placeholder="Tìm chức năng, biểu đồ, tài liệu hoặc thao tác..."
                className="flex-1"
                controlClassName="min-h-0 border-0 bg-transparent px-0"
                trailingContent={
                  <span className="hidden text-xs text-gray-400 sm:inline-flex sm:items-center sm:gap-1">
                    <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">Ctrl</kbd>
                    +
                    <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">K</kbd>
                  </span>
                }
              />


            </div>

            <div className="max-h-[60vh] overflow-y-auto px-2 py-3">

              {visibleCommands.length === 0 ? (

                <p className="px-3 py-8 text-sm text-gray-500 dark:text-gray-400">

                  Không tìm thấy kết quả phù hợp, hãy thử từ khóa khác.

                </p>

              ) : (

                <ul className="grid gap-1">

                  {entries.map((entry) => {

                    if (entry.type === 'header') {

                      return (

                        <li

                          key={entry.id}

                          className="px-3 pt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400 first:pt-0"

                        >

                          {entry.title}

                        </li>

                      );

                    }

                    const command = entry.command;

                    const Icon = command.icon || CommandIcon;

                    const commandIndex = visibleCommands.findIndex((item) => item.command.id === command.id);

                    const active = commandIndex === highlightedIndex;

                    const pinnedState = pinned.includes(command.id);

                    return (

                      <li key={command.id}>

                        <div

                          role="button"

                          tabIndex={0}

                          onClick={() => handleRunCommand(command)}

                          onKeyDown={(event) => {

                            if (event.key === 'Enter' || event.key === ' ') {

                              event.preventDefault();

                              handleRunCommand(command);

                            }

                          }}

                          onMouseEnter={() => setHighlightedIndex(commandIndex)}

                          className={`group flex w-full items-start justify-between gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent-ring)] ${

                            active

                              ? 'bg-amber-100/70 text-amber-900 shadow-sm dark:bg-amber-500/10 dark:text-amber-100'

                              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-slate-800'

                          }`}

                        >

                          <div className="flex flex-1 items-start gap-3">

                            <span

                              className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition group-hover:bg-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 ${

                                active ? 'bg-amber-500/20 dark:bg-amber-500/20' : ''

                              }`}

                            >

                              <Icon className="h-4 w-4" aria-hidden="true" />

                            </span>

                            <span>

                              <span className="block text-sm font-semibold leading-tight">{command.label}</span>

                              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{command.description}</span>

                            </span>

                          </div>

                          <div className="flex flex-col items-end gap-2 text-xs text-gray-400">

                            {command.usageInfo?.count ? (

                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-gray-400">

                                {command.usageInfo.count} lần

                              </span>

                            ) : null}

                            <button

                              type="button"

                              onClick={(event) => {

                                event.stopPropagation();

                                togglePin(command.id);

                              }}

                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:bg-gray-200 dark:hover:bg-slate-700 ${

                                pinnedState

                                  ? 'border-amber-400 text-amber-500'

                                  : 'border-transparent text-gray-400'

                              }`}

                              aria-label={pinnedState ? 'Bỏ ghim thao tác' : 'Ghim thao tác'}

                            >

                              {pinnedState ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}

                            </button>

                          </div>

                        </div>

                      </li>

                    );

                  })}

                </ul>

              )}

            </div>

            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-gray-400">

              <span>

                Gợi ý: sử dụng <kbd className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-600">↑↓</kbd> để di chuyển, <kbd className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-600">Enter</kbd> để chọn.

              </span>

              <button

                type="button"

                onClick={() => setOpen(false)}

                className="rounded border border-gray-300 px-2 py-1 text-gray-500 transition hover:bg-gray-100 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"

              >

                Đóng

              </button>

            </div>

          </div>

        </div>

      ) : null}

    </>

  );

}

