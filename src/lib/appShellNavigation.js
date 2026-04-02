export const APP_SHELL_FALLBACK_TAB = 'dashboard';
export const APP_SHELL_SECTION_QUERY_PARAM = 'section';
export const APP_SHELL_TAB_QUERY_PARAM = 'tab';

export const APP_NAVIGATION_SECTION_DEFINITIONS = Object.freeze([
  {
    id: 'overview',
    label: 'Tổng quan',
    description: 'Điểm vào mặc định để nắm sức khỏe vận hành và lối tắt ưu tiên.',
  },
  {
    id: 'operations',
    label: 'Vận hành',
    description: 'Nhập liệu, gán MST và vận hành đối tác đầu vào.',
  },
  {
    id: 'performance',
    label: 'Hiệu suất',
    description: 'Tổ đội, quy tắc KPI và báo cáo điều hành.',
  },
  {
    id: 'observability',
    label: 'Giám sát',
    description: 'Theo dõi sức khỏe dữ liệu và trợ giúp vận hành.',
  },
  {
    id: 'governance',
    label: 'Quản trị',
    description: 'Tài khoản, audit trail và truy vết export.',
  },
]);

export const APP_TAB_DEFINITIONS = Object.freeze([
  {
    id: 'dashboard',
    sectionId: 'overview',
    label: 'Tổng quan KPI',
    tooltip: 'Điểm vào mặc định để xem lối tắt, trạng thái và bề mặt điều hành chính',
    commandLabel: 'Đi tới dashboard Tổng quan KPI',
    commandDescription: 'Mở điểm vào mặc định với tóm tắt shell, thao tác nhanh và trạng thái vận hành',
    commandKeywords: ['dashboard', 'tong quan', 'overview', 'home', 'landing', 'kpi'],
  },
  {
    id: 'mst',
    sectionId: 'operations',
    label: 'Gán MST',
    tooltip: 'Quản lý gán MST cho doanh nghiệp và người phụ trách',
    commandLabel: 'Đi tới tab Gán MST',
    commandDescription: 'Quản lý gán MST cho doanh nghiệp và người phụ trách',
    commandKeywords: ['mst', 'gan mst', 'doanh nghiep', 'nguoi phu trach'],
  },
  {
    id: 'hq',
    sectionId: 'operations',
    label: 'Đại Lý HQ',
    tooltip: 'Quản lý danh sách đại lý hải quan hợp tác',
    commandLabel: 'Đi tới tab Đại Lý HQ',
    commandDescription: 'Mở danh sách đại lý hải quan hợp tác và cấu hình liên quan',
    commandKeywords: ['dai ly hq', 'dai ly hai quan', 'hai quan'],
  },
  {
    id: 'import',
    sectionId: 'operations',
    label: 'Import Data',
    tooltip: 'Nhập và đồng bộ dữ liệu tờ khai từ ECUS',
    commandLabel: 'Đi tới tab Import Data',
    commandDescription: 'Nhập file Excel, đồng bộ ECUS và xử lý trùng',
    commandKeywords: ['import', 'excel', 'ecus', 'dong bo', 'du lieu'],
  },
  {
    id: 'teams',
    sectionId: 'performance',
    label: 'Quản lý Tổ đội',
    tooltip: 'Thiết lập tổ đội và phân bổ chỉ tiêu',
    commandLabel: 'Đi tới tab Quản lý Tổ đội',
    commandDescription: 'Điều phối tổ đội, KPI mục tiêu và phân công nhân sự',
    commandKeywords: ['to doi', 'team', 'phan cong'],
  },
  {
    id: 'rules',
    sectionId: 'performance',
    label: 'Quy tắc KPI',
    tooltip: 'Cấu hình quy tắc tính điểm KPI',
    commandLabel: 'Đi tới tab Quy tắc KPI',
    commandDescription: 'Thiết lập quy tắc tính điểm KPI và mốc hiệu lực',
    commandKeywords: ['quy tac', 'kpi', 'rule'],
  },
  {
    id: 'adjustments',
    sectionId: 'performance',
    label: 'Điểm KPI +/- Thêm',
    tooltip: 'Cộng/trừ điểm KPI bổ sung theo tháng',
    commandLabel: 'Đi tới tab Điểm KPI +/- Thêm',
    commandDescription: 'Ghi nhận cộng trừ điểm KPI thủ công cho từng kỳ',
    commandKeywords: ['kpi', 'cong tru', 'dieu chinh'],
  },
  {
    id: 'reports',
    sectionId: 'performance',
    label: 'Báo cáo KPI',
    tooltip: 'Xem và xuất báo cáo KPI tổng hợp',
    commandLabel: 'Đi tới tab Báo cáo KPI',
    commandDescription: 'Mở dashboard KPI tổng hợp và biểu đồ mới nhất',
    commandKeywords: ['bao cao', 'dashboard', 'kpi', 'thong ke'],
  },
  {
    id: 'health',
    sectionId: 'observability',
    label: 'Sức khỏe dữ liệu',
    tooltip: 'Theo dõi dữ liệu trùng, cảnh báo và trạng thái đồng bộ',
    commandLabel: 'Mở tab Sức khỏe dữ liệu',
    commandDescription: 'Xem trùng 11 số đầu, timeout SQL và cảnh báo',
    commandKeywords: ['suc khoe', 'du lieu', 'trung lap', 'canh bao'],
    isVisible: (access) => access.canViewDataHealth,
  },
  {
    id: 'ai',
    sectionId: 'observability',
    label: 'Trợ lý AI',
    tooltip: 'Trợ lý AI nội bộ hỗ trợ KPI và tờ khai',
    commandLabel: 'Mở tab Trợ lý AI',
    commandDescription: 'Truy cập trợ lý AI với lịch sử hội thoại đã lưu',
    commandKeywords: ['ai', 'tro ly', 'chatbot'],
    isVisible: (access) => access.canUseAi,
  },
  {
    id: 'accounts',
    sectionId: 'governance',
    label: 'Tài khoản',
    tooltip: 'Quản trị tài khoản đăng nhập hệ thống',
    commandLabel: 'Quản trị tài khoản người dùng',
    commandDescription: 'Tạo, khoá hoặc phân quyền tài khoản đăng nhập',
    commandKeywords: ['tai khoan', 'admin', 'phan quyen'],
    isVisible: (access) => access.canManageAccounts,
  },
  {
    id: 'audit',
    sectionId: 'governance',
    label: 'Nhật ký',
    tooltip: 'Xem nhật ký thao tác hệ thống',
    commandLabel: 'Đi tới tab Nhật ký',
    commandDescription: 'Theo dõi nhật ký thao tác và biến động hệ thống',
    commandKeywords: ['nhat ky', 'audit', 'lich su'],
    isVisible: (access) => access.canViewAudit,
  },
  {
    id: 'export-audit',
    sectionId: 'governance',
    label: 'Lịch sử export',
    tooltip: 'Tra cứu lịch sử tải báo cáo Excel',
    commandLabel: 'Đi tới tab Lịch sử export',
    commandDescription: 'Tra cứu lịch sử tải báo cáo Excel và người thực hiện',
    commandKeywords: ['lich su export', 'export', 'bao cao excel'],
    isVisible: (access) => access.canViewAudit,
  },
]);

const APP_TAB_DEFINITION_MAP = new Map(APP_TAB_DEFINITIONS.map((tab) => [tab.id, tab]));
const APP_SECTION_DEFINITION_MAP = new Map(
  APP_NAVIGATION_SECTION_DEFINITIONS.map((section) => [section.id, section]),
);

export function getAppShellAccess(currentUser) {
  const permissions = currentUser?.permissions || {};
  return {
    canManageAccounts: !!permissions.accountManage,
    canUseAi: !!permissions.aiAssistUse || !!permissions.aiAssistManage,
    canViewAudit: !!permissions.auditView || !!permissions.accountManage,
    canViewDataHealth: !!permissions.dataHealthView || !!permissions.dataHealthManage,
  };
}

export function getVisibleAppTabs(currentUser) {
  const access = getAppShellAccess(currentUser);
  return APP_TAB_DEFINITIONS.filter((tab) => {
    if (typeof tab.isVisible !== 'function') {
      return true;
    }
    return tab.isVisible(access);
  });
}

export function getVisibleAppTabIds(currentUser) {
  return new Set(getVisibleAppTabs(currentUser).map((tab) => tab.id));
}

export function getAppTabDefinition(tabId) {
  return APP_TAB_DEFINITION_MAP.get(tabId) || null;
}

export function getAppNavigationSectionDefinition(sectionId) {
  return APP_SECTION_DEFINITION_MAP.get(sectionId) || null;
}

export function getVisibleAppNavigationSections(currentUser) {
  const visibleTabs = getVisibleAppTabs(currentUser);
  const sections = APP_NAVIGATION_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    tabs: [],
  }));
  const sectionMap = new Map(sections.map((section) => [section.id, section]));

  visibleTabs.forEach((tab) => {
    const section = sectionMap.get(tab.sectionId);
    if (section) {
      section.tabs.push(tab);
    }
  });

  return sections.filter((section) => section.tabs.length > 0);
}

function createSearchParams(search) {
  if (search instanceof URLSearchParams) {
    return new URLSearchParams(search);
  }
  if (typeof search === 'string') {
    return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  }
  return new URLSearchParams(search || '');
}

export function resolveVisibleAppTab(
  requestedTab,
  currentUser,
  fallbackTab = APP_SHELL_FALLBACK_TAB,
  requestedSection = null,
) {
  const visibleTabs = getVisibleAppTabs(currentUser);
  const visibleIds = new Set(visibleTabs.map((tab) => tab.id));
  if (requestedTab && visibleIds.has(requestedTab)) {
    return requestedTab;
  }
  if (requestedSection) {
    const sectionMatch = visibleTabs.find((tab) => tab.sectionId === requestedSection);
    if (sectionMatch) {
      return sectionMatch.id;
    }
  }
  if (visibleIds.has(fallbackTab)) {
    return fallbackTab;
  }
  return visibleTabs[0]?.id || fallbackTab;
}

export function parseAppShellLocation(search, currentUser, fallbackTab = APP_SHELL_FALLBACK_TAB) {
  const params = createSearchParams(search);
  const requestedSection = params.get(APP_SHELL_SECTION_QUERY_PARAM);
  const requestedTab = params.get(APP_SHELL_TAB_QUERY_PARAM);
  const tab = resolveVisibleAppTab(requestedTab, currentUser, fallbackTab, requestedSection);

  return {
    requestedSection,
    requestedTab,
    section: getAppTabDefinition(tab)?.sectionId || null,
    tab,
  };
}

export function serializeAppShellLocation({
  search = '',
  tab,
  currentUser,
  fallbackTab = APP_SHELL_FALLBACK_TAB,
} = {}) {
  const params = createSearchParams(search);
  const resolvedTab = resolveVisibleAppTab(tab, currentUser, fallbackTab);
  const resolvedSection = getAppTabDefinition(resolvedTab)?.sectionId || null;

  if (resolvedSection) {
    params.set(APP_SHELL_SECTION_QUERY_PARAM, resolvedSection);
  } else {
    params.delete(APP_SHELL_SECTION_QUERY_PARAM);
  }

  if (resolvedTab) {
    params.set(APP_SHELL_TAB_QUERY_PARAM, resolvedTab);
  } else {
    params.delete(APP_SHELL_TAB_QUERY_PARAM);
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : '';
}
