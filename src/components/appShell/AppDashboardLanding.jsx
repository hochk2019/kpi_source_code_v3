import React from 'react';
import { ArrowRight, Info } from 'lucide-react';

import { AppShellEmptyState } from '@/components/appShell/AppShellAsyncStates.jsx';
import { buildAppDashboardSummaryState } from '@/components/appShell/appDashboardSummary.js';

function DashboardSummaryCard({ label, value, detail, tone = 'default' }) {
  return (
    <article className="ds-dashboard__summary-card flex flex-col gap-1 relative items-center justify-center p-6 border rounded-xl bg-white/60 backdrop-blur-md shadow-sm" data-tone={tone}>
      <div className="flex items-center gap-1.5 absolute top-4 left-4">
        <p className="ds-dashboard__summary-label">{label}</p>
        <button className="text-gray-400 hover:text-blue-500" title={detail} aria-label="More Info">
          <Info size={14} />
        </button>
      </div>
      <p className="ds-dashboard__summary-value text-4xl font-bold mt-4">{value}</p>
    </article>
  );
}

function DashboardQuickAction({ label, detail, onClick, icon = ArrowRight }) {
  const ActionIcon = icon;

  return (
    <button type="button" className="ds-dashboard__quick-action" onClick={onClick}>
      <span className="ds-dashboard__quick-action-icon" aria-hidden="true">
        <ActionIcon size={16} strokeWidth={1.75} />
      </span>
      <span className="ds-dashboard__quick-action-copy">
        <span className="ds-dashboard__quick-action-label">{label}</span>
        <span className="ds-dashboard__quick-action-detail">{detail}</span>
      </span>
      <span className="ds-dashboard__quick-action-arrow" aria-hidden="true">
        <ArrowRight size={16} strokeWidth={1.75} />
      </span>
    </button>
  );
}

export default function AppDashboardLanding({
  currentUser,
  sections = [],
  onNavigate,
  onOpenCommandCenter,
  canUseAi = false,
  canViewAudit = false,
  canViewDataHealth = false,
}) {
  const {
    enabledAssistCount,
    isGuest,
    operatorName,
    quickActions,
    visibleModuleCount,
    workflowSections,
  } = buildAppDashboardSummaryState({
    currentUser,
    sections,
    onNavigate,
    onOpenCommandCenter,
    canUseAi,
    canViewAudit,
    canViewDataHealth,
  });

  return (
    <section
      id="app-workflow-dashboard-landing"
      tabIndex={-1}
      className="ds-dashboard"
      aria-label="Dashboard tổng quan KPI"
    >
      <div className="ds-dashboard__hero">
        <div className="ds-dashboard__hero-copy">
          <p className="ds-dashboard__eyebrow">Điểm vào mặc định</p>
          <div className="flex items-center gap-2">
            <h3 className="ds-dashboard__title">Tổng quan KPI</h3>
            <button
              className="text-gray-400 hover:text-blue-500 mt-1"
              title={isGuest
                ? 'Bạn đang ở chế độ xem giới hạn. Chọn đúng luồng để bắt đầu thay vì rơi thẳng vào một màn hình chuyên sâu.'
                : `${operatorName}, đây là điểm vào ưu tiên để kiểm tra sức khỏe vận hành, chọn luồng kế tiếp và giảm thời gian tìm tab.`}
            >
              <Info size={20} />
            </button>
          </div>
        </div>

        <div className="ds-dashboard__status-rail" aria-label="Trạng thái hiện tại">
          <span className="ds-dashboard__status-pill">
            {isGuest ? 'Chế độ khách' : `Vai trò ${currentUser?.role || 'viewer'}`}
          </span>
          <span className="ds-dashboard__status-pill">{visibleModuleCount} module khả dụng</span>
          <span className="ds-dashboard__status-pill">{workflowSections.length} cụm công việc</span>
        </div>
      </div>

      <div className="ds-dashboard__summary-grid">
        <DashboardSummaryCard
          label="Cụm điều hướng"
          value={workflowSections.length.toLocaleString('vi-VN')}
          detail="Nhóm shell đang mở cho tài khoản hiện tại."
        />
        <DashboardSummaryCard
          label="Module tác nghiệp"
          value={visibleModuleCount.toLocaleString('vi-VN')}
          detail="Tổng số tab mà người dùng hiện tại có thể truy cập."
          tone="accent"
        />
        <DashboardSummaryCard
          label="Bề mặt hỗ trợ"
          value={enabledAssistCount.toLocaleString('vi-VN')}
          detail="Health, AI và audit được bật theo quyền hiện tại."
        />
      </div>

      <div className="ds-dashboard__grid">
        <section className="ds-dashboard__panel bg-white/60 backdrop-blur-md shadow-sm border border-gray-100/50" aria-labelledby="dashboard-quick-actions-title">
          <div className="ds-dashboard__panel-header flex items-center justify-between">
            <h4 id="dashboard-quick-actions-title" className="ds-dashboard__panel-title">
              Tác vụ truy cập nhanh
            </h4>
            <button className="text-gray-400 hover:text-blue-500" title="Ưu tiên những đường đi bắt đầu workflow thay vì mở tab rồi tự dò bề mặt chi tiết.">
              <Info size={16} />
            </button>
          </div>
          <div className="ds-dashboard__quick-actions">
            {quickActions.map((action) => (
              <DashboardQuickAction key={action.label} {...action} />
            ))}
          </div>
        </section>

        <section className="ds-dashboard__panel bg-white/60 backdrop-blur-md shadow-sm border border-gray-100/50" aria-labelledby="dashboard-module-map-title">
          <div className="ds-dashboard__panel-header flex items-center justify-between">
            <h4 id="dashboard-module-map-title" className="ds-dashboard__panel-title">
              Bản đồ module
            </h4>
            <button className="text-gray-400 hover:text-blue-500" title="Mỗi cụm chỉ giữ các module thật sự nhìn thấy được với tài khoản hiện tại.">
              <Info size={16} />
            </button>
          </div>

          <div className="ds-dashboard__module-groups">
            {workflowSections.length ? (
              workflowSections.map((section) => (
                <article key={section.id} className="ds-dashboard__module-group">
                  <div className="ds-dashboard__module-group-header">
                    <h5 className="ds-dashboard__module-group-title">{section.label}</h5>
                    <span className="ds-dashboard__module-group-count">
                      {section.tabs.length.toLocaleString('vi-VN')} module
                    </span>
                  </div>
                  <p className="ds-dashboard__module-group-copy">{section.description}</p>
                  <div className="ds-dashboard__module-tags">
                    {section.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className="ds-dashboard__module-tag"
                        onClick={() => onNavigate?.(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <AppShellEmptyState
                title="Chưa có module khả dụng"
                description="Tài khoản hiện tại chưa được cấp module tác nghiệp ngoài dashboard tổng quan."
                actionLabel={onOpenCommandCenter ? 'Mở Command Center' : ''}
                onAction={onOpenCommandCenter}
              />
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
