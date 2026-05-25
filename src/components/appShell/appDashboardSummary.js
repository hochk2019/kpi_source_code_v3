import { Activity, LayoutDashboard, Search, ShieldCheck, Sparkles } from 'lucide-react';

export function buildAppDashboardSummaryState({
  currentUser,
  sections = [],
  onNavigate,
  onOpenCommandCenter,
  canUseAi = false,
  canViewAudit = false,
  canViewDataHealth = false,
}) {
  const workflowSections = sections.filter((section) => section.id !== 'overview');
  const visibleModuleCount = workflowSections.reduce(
    (count, section) => count + section.tabs.length,
    0,
  );
  const enabledAssistCount = [canUseAi, canViewAudit, canViewDataHealth].filter(Boolean).length;
  const operatorName = currentUser?.name || currentUser?.username || 'Người vận hành';
  const isGuest = !currentUser?.username || currentUser.username === 'guest';

  const quickActions = [
    {
      label: 'Bắt đầu với Import dữ liệu',
      detail: 'Đi thẳng vào bước nạp nguồn để nhập file hoặc kiểm tra workspace import.',
      icon: LayoutDashboard,
      onClick: () => onNavigate?.('import', 'source'),
    },
    {
      label: 'Mở dashboard báo cáo KPI',
      detail: 'Chuyển tới report center để đọc insight và drill-down theo kỳ.',
      icon: Activity,
      onClick: () => onNavigate?.('reports', 'dashboard'),
    },
    canViewDataHealth
      ? {
          label: 'Kiểm tra sức khỏe dữ liệu',
          detail: 'Rà soát đồng bộ, duplicate và cảnh báo trước khi xử lý sâu.',
          icon: ShieldCheck,
          onClick: () => onNavigate?.('health', 'sync'),
        }
      : null,
    canUseAi
      ? {
          label: 'Gọi trợ lý AI',
          detail: 'Mở bề mặt hỗ trợ nội bộ khi cần tra cứu nhanh hoặc phối hợp vận hành.',
          icon: Sparkles,
          onClick: () => onNavigate?.('ai'),
        }
      : {
          label: 'Mở Command Center',
          detail: 'Dùng tìm kiếm lệnh để đi nhanh tới module hoặc thao tác cần thiết.',
          icon: Search,
          onClick: () => onOpenCommandCenter?.(),
        },
  ].filter(Boolean);

  return {
    enabledAssistCount,
    isGuest,
    operatorName,
    quickActions,
    visibleModuleCount,
    workflowSections,
  };
}

export default buildAppDashboardSummaryState;
