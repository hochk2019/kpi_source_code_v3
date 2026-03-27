export const PERMISSION_DETAILS = Object.freeze({
  importEdit: {
    label: "Import Data – chỉnh sửa & lưu",
    description: "Cho phép nhập file ECUS, hợp nhất và ghi dữ liệu vào kho KPI.",
    category: "Nhập liệu & đồng bộ",
  },
  importUpload: {
    label: "Import Data – tải file",
    description: "Cho phép tải file Excel tờ khai lên hệ thống để xem trước và chuẩn bị import.",
    category: "Nhập liệu & đồng bộ",
  },
  mstEdit: {
    label: "Gán MST – chỉnh sửa",
    description: "Cập nhật mã số thuế, phân công nhân viên và đại lý hải quan phụ trách.",
    category: "Tổ chức & đối tác",
  },
  rulesEdit: {
    label: "Quy tắc KPI – chỉnh sửa",
    description: "Thay đổi công thức, trọng số và điều kiện tính điểm KPI.",
    category: "Cấu hình & kiểm soát",
  },
  teamsEdit: {
    label: "Quản lý tổ đội – chỉnh sửa",
    description: "Điều chỉnh cơ cấu tổ đội, phân bổ nhân viên và chỉ tiêu.",
    category: "Tổ chức & đối tác",
  },
  syncManage: {
    label: "Đồng bộ ECUS – cấu hình & chạy tay",
    description: "Thiết lập lịch đồng bộ và chạy đồng bộ ECUS thủ công khi cần.",
    category: "Nhập liệu & đồng bộ",
  },
  reportsExport: {
    label: "Báo cáo KPI – xuất file",
    description: "Tải báo cáo KPI ra Excel và tải nhanh biểu đồ tổng hợp.",
    category: "Báo cáo & giám sát",
  },
  alertsManage: {
    label: "Quản lý cảnh báo thiếu thông tin",
    description: "Xử lý cảnh báo tờ khai thiếu dữ liệu, ghi nhận trạng thái hoàn tất.",
    category: "Giám sát dữ liệu",
  },
  auditView: {
    label: "Xem nhật ký hệ thống",
    description: "Tra cứu lịch sử thao tác và truy vết hoạt động người dùng.",
    category: "Báo cáo & giám sát",
  },
  accountManage: {
    label: "Quản lý tài khoản",
    description: "Tạo, khóa, đặt lại mật khẩu và phân quyền người dùng.",
    category: "Quản trị hệ thống",
  },
  adjustSubmit: {
    label: "Điểm KPI +/- thêm – gửi đề xuất",
    description: "Tạo phiếu cộng/trừ điểm KPI bổ sung cho từng nhân viên.",
    category: "Điều chỉnh KPI",
  },
  adjustApprove: {
    label: "Điểm KPI +/- thêm – duyệt đề xuất",
    description: "Phê duyệt hoặc từ chối các phiếu điều chỉnh KPI bổ sung.",
    category: "Điều chỉnh KPI",
  },
  adjustOverridePoints: {
    label: "Điểm KPI +/- thêm – ghi đè điểm chuẩn",
    description:
      "Cho phép sửa điểm chuẩn mỗi đơn vị/điểm bổ sung thay vì dùng cấu hình mặc định (trừ hạng mục đặc biệt).",
    category: "Điều chỉnh KPI",
  },
  aiAssistUse: {
    label: "Trợ lý AI – sử dụng",
    description: "Trao đổi với trợ lý AI nội bộ và xem lịch sử hội thoại.",
    category: "Trợ lý AI",
  },
  aiAssistManage: {
    label: "Trợ lý AI – cấu hình",
    description: "Quản lý nguồn tri thức, prompt và quyền truy cập trợ lý AI.",
    category: "Trợ lý AI",
  },
  dataHealthView: {
    label: "Sức khỏe dữ liệu – xem dashboard",
    description: "Theo dõi dữ liệu trùng, cảnh báo và chất lượng đồng bộ.",
    category: "Giám sát dữ liệu",
  },
  dataHealthManage: {
    label: "Sức khỏe dữ liệu – cấu hình & khóa nguồn",
    description: "Chỉnh ngưỡng cảnh báo, khóa/mở khóa nguồn và lưu chính sách.",
    category: "Giám sát dữ liệu",
  },
});

export const PERMISSION_CATEGORY_ORDER = Object.freeze([
  "Nhập liệu & đồng bộ",
  "Tổ chức & đối tác",
  "Giám sát dữ liệu",
  "Cấu hình & kiểm soát",
  "Báo cáo & giám sát",
  "Điều chỉnh KPI",
  "Trợ lý AI",
  "Quản trị hệ thống",
  "Khác",
]);

export const CONTROL_CLASS =
  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0";

export const GROUP_TOGGLE_BUTTON_CLASS =
  "inline-flex items-center gap-1 rounded border border-transparent px-2 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:border-[color:var(--ds-border-subtle)] hover:bg-[color:var(--ds-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent-ring)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60";

function getPermissionCategoryOrder(category) {
  const index = PERMISSION_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? PERMISSION_CATEGORY_ORDER.length : index;
}

export function buildPermissionDefinitions(permissionKeys) {
  return permissionKeys
    .map((key) => {
      const details = PERMISSION_DETAILS[key] || {};
      return {
        key,
        label: details.label || key,
        description: details.description || "",
        category: details.category || "Khác",
      };
    })
    .sort((a, b) => {
      const categoryDiff = getPermissionCategoryOrder(a.category) - getPermissionCategoryOrder(b.category);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      return a.label.localeCompare(b.label, "vi", { sensitivity: "base" });
    });
}

export function buildGroupedPermissions(permissionDefinitions) {
  const groups = new Map();
  for (const definition of permissionDefinitions) {
    const category = definition.category || "Khác";
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category).push(definition);
  }
  return Array.from(groups.entries())
    .sort((a, b) => getPermissionCategoryOrder(a[0]) - getPermissionCategoryOrder(b[0]))
    .map(([category, items]) => ({
      category,
      items: items
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, "vi", { sensitivity: "base" })),
    }));
}
