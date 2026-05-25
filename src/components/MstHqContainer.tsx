import { useState } from "react";
import { Building2, FileSpreadsheet, History } from "lucide-react";
import { PageHeader } from "@/components/designSystem/PageHeader";
import { PermissionBanner } from "@/components/designSystem/primitives";
import { t } from "@/lib/i18n.js";
import type { AuthAccountView } from "@/types";

// Lazy load the heavy components
import MSTAssignment from "./MSTAssignment";
import HQAgencyManager from "./HQAgencyManager";

interface MstHqContainerProps {
  currentUser: AuthAccountView | null;
  canManageMst?: boolean;
  canManageHq?: boolean;
}

const tabs = [
  { id: "mst", label: "Gán MST", icon: FileSpreadsheet },
  { id: "hq", label: "Đại Lý HQ", icon: Building2 },
  { id: "history", label: "Lịch sử", icon: History },
];

export default function MstHqContainer({
  currentUser,
  canManageMst = true,
  canManageHq = true,
}: MstHqContainerProps) {
  const [activeTab, setActiveTab] = useState("mst");

  // Determine permission message
  let permissionBanner = null;
  if (!canManageMst && !canManageHq) {
    permissionBanner = {
      level: "warning" as const,
      title: t("mstHq.noPermission.title") || "Không có quyền truy cập",
      description:
        t("mstHq.noPermission.desc") ||
        "Bạn không có quyền quản lý MST và Đại lý HQ.",
    };
  } else if (!canManageMst && activeTab === "mst") {
    permissionBanner = {
      level: "info" as const,
      title: t("mstHq.readonly.mst") || "Chế độ xem MST",
      description:
        t("mstHq.readonly.mstDesc") ||
        "Bạn chỉ có thể xem thông tin gán MST, không thể chỉnh sửa.",
    };
  } else if (!canManageHq && activeTab === "hq") {
    permissionBanner = {
      level: "info" as const,
      title: t("mstHq.readonly.hq") || "Chế độ xem Đại lý HQ",
      description:
        t("mstHq.readonly.hqDesc") ||
        "Bạn chỉ có thể xem thông tin đại lý HQ, không thể chỉnh sửa.",
    };
  }

  return (
    <div className="mst-hq-container space-y-3">
      <PageHeader
        eyebrow="VẬN HÀNH"
        title="Gán MST & Đại lý HQ"
        info="Quản lý gán MST cho doanh nghiệp và đại lý hải quan"
        meta={[activeTab === "mst" ? "Quản lý MST" : activeTab === "hq" ? "Đại lý HQ" : "Lịch sử"]}
      />

      {permissionBanner && (
        <PermissionBanner
          level={permissionBanner.level}
          title={permissionBanner.title}
          description={permissionBanner.description}
        />
      )}

      {/* Page Tabs */}
      <div className="border-b border-ds-border-subtle">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-ds-accent text-ds-accent"
                    : "border-transparent text-ds-text-secondary hover:text-ds-text-primary"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {activeTab === "mst" && (
          <MSTAssignment currentUser={currentUser} />
        )}

        {activeTab === "hq" && (
          <HQAgencyManager currentUser={currentUser} />
        )}

        {activeTab === "history" && (
          <div className="text-sm text-ds-text-muted">
            {t("mstHq.history.comingSoon") ||
              "Lịch sử thay đổi MST và Đại lý HQ sẽ hiển thị tại đây."}
          </div>
        )}
      </div>
    </div>
  );
}
