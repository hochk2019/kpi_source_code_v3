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
  Settings2,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';

import { listAccounts } from '@/auth/localAuth.js';
import { emitCommand } from '@/lib/commandBus.js';
import { getAppShellAccess, getVisibleAppTabs } from '@/lib/appShellNavigation';

export const COMMAND_CENTER_GROUP_TITLES = Object.freeze({
  pinned: 'Đã ghim',
  recent: 'Gần đây',
  navigation: 'Điều hướng nhanh',
  reports: 'Báo cáo & phát hành',
  data: 'Dữ liệu & vận hành',
  support: 'Hỗ trợ & đào tạo',
  display: 'Giao diện & cá nhân hóa',
  account: 'Tài khoản',
  automation: 'Tự động hoá & tiện ích',
});

const NAVIGATION_ICONS = Object.freeze({
  dashboard: BarChart3,
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
});

function buildReportShortcutCommands(currentUser) {
  const canExportReports = currentUser?.permissions?.reportsExport !== false;
  const commands = [
    {
      id: 'reports:scope',
      group: 'reports',
      label: 'Báo cáo KPI: chốt phạm vi',
      description: 'Mở report center tại bước chọn kỳ và phạm vi báo cáo',
      icon: Filter,
      keywords: ['bao cao', 'report center', 'pham vi', 'ky', 'scope'],
      run: () => emitCommand('navigate:tab', { tab: 'reports', focus: 'scope' }),
    },
    {
      id: 'reports:dashboard',
      group: 'reports',
      label: 'Báo cáo KPI: dashboard insight',
      description: 'Đi tới khu insight và drill-down của report center',
      icon: BarChart3,
      keywords: ['bao cao', 'dashboard', 'insight', 'drill down', 'thong ke'],
      run: () => emitCommand('navigate:tab', { tab: 'reports', focus: 'dashboard' }),
    },
  ];

  if (canExportReports) {
    commands.push({
      id: 'reports:export',
      group: 'reports',
      label: 'Báo cáo KPI: phát hành & export',
      description: 'Nhảy thẳng tới khu lịch gửi, export và truy vết báo cáo',
      icon: History,
      keywords: ['bao cao', 'export', 'phat hanh', 'lich gui', 'audit'],
      run: () => emitCommand('navigate:tab', { tab: 'reports', focus: 'export' }),
    });
  }

  return commands;
}

function buildAccountSearchCommands(currentUser) {
  const access = getAppShellAccess(currentUser);
  if (!access.canManageAccounts) {
    return [];
  }

  return listAccounts()
    .slice()
    .sort((leftAccount, rightAccount) => {
      const left = `${leftAccount?.name || ''} ${leftAccount?.username || ''}`.trim();
      const right = `${rightAccount?.name || ''} ${rightAccount?.username || ''}`.trim();
      return left.localeCompare(right, 'vi');
    })
    .map((account) => {
      const teamMeta = account?.teamName ? ` • ${account.teamName}` : '';
      const memberMeta = account?.memberName ? ` • ${account.memberName}` : '';

      return {
        id: `account:user:${account.username}`,
        group: 'account',
        label: `Người dùng: ${account.name || account.username}`,
        description: `${account.username} • ${account.role || 'viewer'}${teamMeta}${memberMeta}`,
        icon: Users,
        keywords: [
          'nguoi dung',
          'tai khoan',
          account?.username || '',
          account?.name || '',
          account?.role || '',
          account?.teamName || '',
          account?.memberName || '',
        ].filter(Boolean),
        run: () => emitCommand('navigate:tab', { tab: 'accounts' }),
      };
    });
}

export function buildCommandCenterCommands({
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
    ...buildReportShortcutCommands(currentUser),
    ...buildAccountSearchCommands(currentUser),
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

  return commands.filter((command) => !command.hidden);
}
