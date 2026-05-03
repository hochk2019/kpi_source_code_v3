/**
 * Simple i18n utility for the KPI system
 * Supports Vietnamese (default) and can be extended for other languages
 *
 * @example
 * import { t } from '@/lib/i18n.js';
 * t('account.createSuccess'); // "Tài khoản đã được tạo thành công"
 */

const translations = {
  vi: {
    // Common
    'common.loading': 'Đang tải...',
    'common.error': 'Lỗi',
    'common.success': 'Thành công',
    'common.cancel': 'Hủy',
    'common.confirm': 'Xác nhận',
    'common.save': 'Lưu',
    'common.delete': 'Xóa',
    'common.edit': 'Sửa',
    'common.create': 'Tạo',
    'common.search': 'Tìm kiếm',
    'common.close': 'Đóng',
    'common.back': 'Quay lại',
    'common.previous': 'Trước',
    'common.next': 'Tiếp theo',
    'common.page': 'Trang',
    'common.submit': 'Gửi',
    'common.reset': 'Nhập lại',
    'common.saving': 'Đang lưu...',
    'common.collapseAll': 'Thu gọn tất cả',
    'common.expandAll': 'Mở rộng tất cả',
    'common.scrollToTop': 'Cuộn lên đầu',
    'common.scrollToBottom': 'Cuộn xuống cuối',

    // Account Manager
    'account.title': 'Quản trị Tài khoản Hệ thống',
    'account.description': 'Quản lý tài khoản đăng nhập cho hệ thống KPI, gán quyền và nhân viên phụ trách theo từng tổ đội.',
    'account.createNew': 'Tạo tài khoản mới',
    'account.username': 'Tài khoản',
    'account.password': 'Mật khẩu',
    'account.confirmPassword': 'Xác nhận mật khẩu',
    'account.role': 'Vai trò',
    'account.permissions': 'Quyền chức năng',
    'account.staff': 'Nhân viên KPI',
    'account.createSuccess': 'Tài khoản đã được tạo thành công',
    'account.createError': 'Không thể tạo tài khoản',
    'account.deleteConfirm': 'Xác nhận xóa tài khoản',
    'account.deleteWarning': 'Tài khoản {username} sẽ bị xóa vĩnh viễn.',
    'account.deleteConfirmText': 'Nhập "{text}" để xác nhận',
    'account.deleteSuccess': 'Đã xóa tài khoản',
    'account.deleteError': 'Không thể xóa tài khoản',
    'account.searchPlaceholder': 'Tìm theo tài khoản, vai trò, tên nhân viên...',
    'account.total': 'Tổng {count} tài khoản',
    'account.createDescription': 'Điền thông tin đăng nhập, gắn nhân viên KPI (nếu có) và xác định quyền tương ứng trước khi tạo tài khoản.',
    'account.createTooltip': 'Tạo tài khoản mới với thông tin và quyền đã chọn',
    'account.resetTooltip': 'Xóa nội dung biểu mẫu và nhập lại từ đầu',
    'account.noResults': 'Không tìm thấy tài khoản nào',
    'account.validation.usernameRequired': 'Vui lòng nhập tên đăng nhập',
    'account.validation.passwordLength': 'Mật khẩu phải có ít nhất {min} ký tự',
    'account.validation.passwordMatch': 'Mật khẩu xác nhận không khớp',
    'account.validation.confirmDelete': 'Tên xác nhận không khớp',

    // Permissions
    'permission.title': 'Quản lý quyền',
    'permission.description': 'Điều chỉnh quyền truy cập cho tài khoản {username}.',
    'permission.selectAccount': 'Chọn tài khoản để điều chỉnh quyền.',
    'permission.notFound': 'Không tìm thấy thông tin tài khoản đã chọn.',
    'permission.category.import': 'Nhập liệu & đồng bộ',
    'permission.category.organization': 'Tổ chức & đối tác',
    'permission.category.monitoring': 'Giám sát dữ liệu',
    'permission.category.config': 'Cấu hình & kiểm soát',
    'permission.category.reporting': 'Báo cáo & giám sát',
    'permission.category.admin': 'Quản trị hệ thống',

    // Table columns
    'table.column.account': 'Tài khoản',
    'table.column.role': 'Vai trò',
    'table.column.staff': 'Nhân viên',
    'table.column.team': 'Tổ đội',
    'table.column.actions': 'Thao tác',

    // Permission actions
    'permission.edit': 'Sửa quyền',
    'permission.assign': 'Phân quyền',
    'permission.enabledCount': '{enabled}/{total} quyền đang bật',
    'permission.countShort': '{enabled}/{total} quyền',
    'permission.noAssignment': 'Chưa phân quyền',

    // Form labels
    'form.username': 'Tài khoản *',
    'form.password': 'Mật khẩu *',
    'form.confirmPassword': 'Xác nhận mật khẩu *',
    'form.role': 'Vai trò',
    'form.selectRole': 'Chọn vai trò',
    'form.searchStaff': 'Tìm theo tên nhân viên hoặc tổ đội…',
    'form.staffLabel': 'Nhân viên KPI',
    'form.staffAriaLabel': 'Nhân viên KPI cho tài khoản mới',
    'form.clearGroupLabel': 'Tùy chọn chung',
    'form.clearLabel': 'Không gắn nhân viên',
    'form.willLink': 'Sẽ gắn tài khoản với {name}',
    'form.optionalLink': 'Tùy chọn: gắn tài khoản với nhân viên trong danh sách KPI.',
    'form.noStaff': 'Chưa có nhân viên nào trong danh sách.',
    'form.displayName': 'Họ tên hiển thị',
    'form.displayNamePlaceholder': 'Tên người dùng',
    'form.passwordTemp': 'Mật khẩu tạm *',
    'form.permissions': 'Quyền chức năng',
    'form.permissionsDescription': 'Chọn quyền tương ứng cho tài khoản. Những quyền bị làm mờ thuộc nhóm chỉ dành cho quản trị viên.',

    // Error messages
    'error.loadAccounts': 'Không thể tải danh sách tài khoản',
    'error.createAccount': 'Không thể tạo tài khoản',
    'error.deleteAccount': 'Không thể xóa tài khoản',
    'error.updatePermissions': 'Không thể cập nhật quyền',
    'error.updateStaff': 'Không thể cập nhật nhân viên',
    'error.resetPassword': 'Không thể đặt lại mật khẩu',

    // Validation
    'validation.required': 'Vui lòng nhập {field}',
    'validation.minLength': '{field} phải có ít nhất {min} ký tự',
    'validation.match': '{field} không khớp',

    // StaffCombobox
    'staff.noSelection': 'Chọn nhân viên...',
    'staff.searchPlaceholder': 'Tìm nhân viên...',

    // Notification
    'notification.title': 'Thông báo hệ thống',
    'notification.loading': 'Đang tải…',
    'notification.itemCount': '{count} mục',
    'notification.empty': 'Chưa có thông báo nào.',
    'notification.markAllRead': 'Đánh dấu tất cả đã đọc',
    'notification.unknownDate': 'Khác',
    'notification.new': 'Mới',
    'notification.unknownType': 'thông báo',
    'notification.unknownTime': 'Không xác định',

    // Audit Log
    'audit.title': 'Nhật ký Hệ thống',
    'audit.description': 'Lưu trữ lịch sử thao tác người dùng, truy vết hoạt động cấu hình hệ thống và quản lý trạng thái sao lưu dữ liệu.',
    'audit.refresh': 'Làm mới',
    'audit.noRecords': 'Không có bản ghi phù hợp.',
    'audit.clearConfirm': 'Xóa toàn bộ nhật ký và ghi lại thao tác này?',
    'audit.clearNote': 'Xóa nhật ký thủ công',
    'audit.exportSuccess': 'Đang tải file nhật ký...',

    // Backup
    'backup.title': 'Quản lý Sao lưu CSDL',
    'backup.schedule': 'Lịch sao lưu CSDL',
    'backup.scheduleLabel': 'Lịch sao lưu tự động (cron)',
    'backup.cronHint': 'Nhập "never" để tắt tự động sao lưu.',
    'backup.retentionLabel': 'Số bản sao lưu giữ lại',
    'backup.retentionHint': 'Để trống hoặc nhập 0 để không giới hạn.',
    'backup.directoryLabel': 'Thư mục sao lưu',
    'backup.unlimited': 'Không giới hạn',
    'backup.copies': '{count} bản sao lưu',
    'backup.loadingError': 'Không thể tải thông tin sao lưu',
    'backup.loading': 'Đang tải thông tin sao lưu...',
    'backup.unknownSchedule': 'Không xác định',
    'backup.nextRun': 'Lần chạy tiếp theo',
    'backup.retentionError': 'Số bản sao lưu giữ lại phải là số nguyên không âm hoặc để trống.',
    'backup.updateError': 'Không thể cập nhật lịch sao lưu.',
    'backup.updateSuccess': 'Đã cập nhật lịch sao lưu CSDL.',
    'backup.runSuccess': 'Đã khởi chạy sao lưu thủ công.',
    'backup.runError': 'Không thể sao lưu ngay.',
    'backup.listError': 'Không thể tải danh sách bản sao lưu.',
    'backup.selectFileError': 'Vui lòng chọn file sao lưu cần khôi phục.',
    'backup.restoreConfirm': 'Khôi phục CSDL sẽ ghi đè dữ liệu hiện tại. Bạn có chắc chắn muốn tiếp tục?',
    'backup.restoreSuccess': 'Khôi phục CSDL thành công. Vui lòng tải lại trang để đồng bộ dữ liệu.',
    'backup.restoreError': 'Không thể khôi phục CSDL.',
    'backup.fileError': 'Không thể tải file nhật ký.',
    'backup.browserNotSupported': 'Trình duyệt không hỗ trợ tải thông tin sao lưu.',

    // Team Manager
    'team.toolbar.save': 'Lưu thay đổi',
    'team.toolbar.saveTooltip': 'Lưu thay đổi tổ đội',
    'team.toolbar.saveDisabledTooltip': 'Chỉ người được cấp quyền mới có thể lưu',
    'team.toolbar.revert': 'Hoàn tác về dữ liệu đã lưu',
    'team.toolbar.refreshMST': 'Tải lại dữ liệu MST',
    'team.toolbar.historyHide': 'Ẩn lịch sử',
    'team.toolbar.historyShow': 'Lịch sử cập nhật',
    'team.toolbar.historyHideTooltip': 'Ẩn bảng lịch sử thay đổi tổ đội và gán MST',
    'team.toolbar.historyShowTooltip': 'Xem lịch sử thay đổi tổ đội, team và trường MST liên quan',
    'team.toolbar.unsaved': 'Có thay đổi chưa lưu',
    'team.toolbar.readOnly': 'Chế độ chỉ xem — không thể lưu thay đổi',
    'team.toolbar.exportExcel': 'Export Excel',
    'team.toolbar.stats': 'Tổng cộng {teams} tổ đội — {members} thành viên',

    // Team Members
    'team.members.title': 'Thành viên team {name}',
    'team.members.newPlaceholder': 'Tên thành viên mới',
    'team.members.add': 'Thêm',
    'team.members.loginRequired': 'Đăng nhập bằng tài khoản được cấp quyền để thêm thành viên mới.',
    'team.members.empty': 'Chưa có thành viên trong team này.',
    'team.members.detailTitle': 'Chi tiết nhân sự',
    'team.members.nameLabel': 'Tên thành viên',
    'team.members.teamLabel': 'Thuộc tổ đội',
    'team.members.updateName': 'Cập nhật tên',
    'team.members.remove': 'Xóa khỏi team',
    'team.members.companies': 'Thành viên đang phụ trách {count} doanh nghiệp.',
    'team.members.selectHint': 'Chọn một thành viên từ màn hình danh sách để xem chi tiết và đối chiếu.',
    'team.members.roleLead': 'Lead',
    'team.members.roleStaff': 'Staff',
    'team.members.companiesCount': '{count} DN',
    'team.members.active': 'Active',

    // Team History
    'team.history.tabTeam': 'Tổ đội',
    'team.history.tabMST': 'MST',
    'team.history.tabTeamTooltip': 'Các lần lưu chỉnh sửa tổ đội',
    'team.history.tabMSTTooltip': 'Các lần chỉnh sửa trường MST (người phụ trách, hiệu lực)',
    'team.history.actorSystem': 'Hệ thống',
    'team.history.defaultDetail': 'Cập nhật tổ đội',
    'team.history.emptyTeam': 'Chưa ghi nhận lịch sử lưu tổ đội.',
    'team.history.emptyMST': 'Chưa ghi nhận lịch sử chỉnh sửa MST.',

    // Team Companies
    'team.companies.titleMember': 'Doanh nghiệp phụ trách của {name}',
    'team.companies.titleTeam': 'Doanh nghiệp theo {name}',
    'team.companies.count': '{count} doanh nghiệp đang được gán',
    'team.companies.viewAllTeam': 'Xem toàn bộ team',
    'team.companies.emptyMember': 'Thành viên này chưa được gán doanh nghiệp nào trong bảng MST.',
    'team.companies.emptyTeam': 'Team chưa được gán doanh nghiệp nào trong bảng MST.',
    'team.companies.role': 'Vai trò',
    'team.companies.importPerson': 'Phụ trách Nhập',
    'team.companies.exportPerson': 'Phụ trách Xuất',
    'team.companies.effectiveFrom': 'Áp dụng từ',

    // MST History Labels
    'mst.personImport': 'Người phụ trách Nhập',
    'mst.personExport': 'Người phụ trách Xuất',
    'mst.effectiveFrom': 'Áp dụng từ ngày',

    // KPI Adjustments - Status
    'kpi.status.pending': 'Chờ duyệt',
    'kpi.status.approved': 'Đã duyệt',
    'kpi.status.rejected': 'Đã từ chối',

    // KPI Adjustments - Form Panel
    'kpi.form.title': 'Thêm điểm KPI +/-',
    'kpi.form.description': 'Ghi nhận cộng/trừ điểm cho từng nhân viên.',
    'kpi.form.autoApproveSaving': 'Đang cập nhật...',
    'kpi.form.autoApproveOn': 'Tắt duyệt tự động',
    'kpi.form.autoApproveOff': 'Bật duyệt tự động',
    'kpi.form.refreshReference': 'Làm mới tham chiếu',
    'kpi.form.guide': 'Hướng dẫn',
    'kpi.form.defaultSettings': 'Cấu hình mặc định',
    'kpi.form.collapse': 'Thu gọn',
    'kpi.form.openForm': 'Mở form thêm điểm',
    'kpi.form.month': 'Tháng áp dụng',
    'kpi.form.staff': 'Nhân viên',
    'kpi.form.staffPlaceholder': 'Nhập tên nhân viên',
    'kpi.form.team': 'Tổ đội',
    'kpi.form.teamPlaceholder': 'Ví dụ: Team 1',
    'kpi.form.taxCode': 'Mã số thuế',
    'kpi.form.taxCodePlaceholder': 'Ví dụ: 0312345678',
    'kpi.form.taxCodeHint': 'Chọn MST để tự điền tên công ty tương ứng.',
    'kpi.form.company': 'Công ty',
    'kpi.form.companyPlaceholder': 'Nhập tên công ty hoặc chọn từ danh sách',
    'kpi.form.companyHint': 'Khi chọn công ty, hệ thống sẽ gợi ý lại MST nếu chưa chính xác.',
    'kpi.form.category': 'Hạng mục',
    'kpi.form.license': 'Mã giấy phép',
    'kpi.form.licensePlaceholder': 'Ví dụ: ZB02',
    'kpi.form.clearLicense': 'Xóa mã giấy phép',
    'kpi.form.delete': 'Xóa',
    'kpi.form.status': 'Trạng thái',
    'kpi.form.systemDefault': 'Theo hệ thống',
    'kpi.form.defaultPoints': 'Điểm mặc định',
    'kpi.form.extraPointsUnit': 'Điểm bổ sung mỗi đơn vị',
    'kpi.form.defaultMode': 'Chế độ mặc định',
    'kpi.form.modePoints': 'Điểm chế độ {mode}',
    'kpi.form.licenseCode': 'Mã {code}',
    'kpi.form.activeSettings': 'Cấu hình đang áp dụng',
    'kpi.form.settingsHint': 'Các giá trị dưới đây được dùng làm mặc định khi chọn hạng mục hiện tại.',
    'kpi.form.editCategorySettings': 'Chỉnh cấu hình hạng mục này',
    'kpi.form.modePointsLabel': 'Điểm theo chế độ',
    'kpi.form.note': 'Mô tả / ghi chú',
    'kpi.form.notePlaceholder': 'Nhập ghi chú, lý do cộng/trừ điểm...',
    'kpi.form.references': 'Tham chiếu tờ khai / quyết định',
    'kpi.form.referencesPlaceholder': 'Nhập số tờ khai, mỗi dòng một số hoặc ngăn cách bằng dấu phẩy',
    'kpi.form.suggestions': 'Gợi ý gần đây:',
    'kpi.form.noRecentDeclarations': 'Không có tờ khai gần đây.',
    'kpi.form.refreshList': 'Làm mới danh sách',
    'kpi.form.declarationSearch': 'Tra cứu tờ khai',
    'kpi.form.searchPlaceholder': 'Tìm theo số tờ khai, MST hoặc tên công ty',
    'kpi.form.searchHint': 'Chọn kết quả để thêm tham chiếu và tự điền thông tin doanh nghiệp.',
    'kpi.form.noResults': 'Không tìm thấy tờ khai phù hợp.',
    'kpi.form.searchPrompt': 'Nhập từ khoá để tra cứu tờ khai.',
    'kpi.form.add': 'Thêm',
    'kpi.form.selectGrade': 'Chọn mức đánh giá',
    'kpi.form.calculationMode': 'Chế độ tính điểm',

    // KPI Adjustments - List Panel
    'kpi.list.title': 'Danh sách điểm KPI +/-',
    'kpi.list.description': 'Lọc và duyệt các đề xuất cộng/trừ điểm.',
    'kpi.list.filterMonth': 'Lọc theo tháng',
    'kpi.list.filterStatus': 'Trạng thái',
    'kpi.list.filterMine': 'Chỉ hiển thị điểm bổ sung của tôi',
    'kpi.list.filterMineOn': 'Đang lọc theo chính bạn',
    'kpi.list.filterMineOff': 'Đang xem tất cả',
    'kpi.list.filterStaff': 'Lọc theo nhân viên',
    'kpi.list.all': 'Tất cả',
    'kpi.list.range': 'Hiển thị {start}-{end} / {total} mục',
    'kpi.list.empty': 'Không có mục nào khớp bộ lọc hiện tại',
    'kpi.list.page': 'Trang {page} / {count}',
    'kpi.list.prevPage': 'Trang trước',
    'kpi.list.nextPage': 'Trang sau',
    'kpi.list.selected': 'Đã chọn {count} mục trên trang hiện tại',
    'kpi.list.noneSelected': 'Chưa chọn mục nào để xử lý hàng loạt',
    'kpi.list.selectHint': 'Chọn các dòng đang hiển thị rồi duyệt hoặc từ chối cùng lúc để giảm thao tác lặp lại.',
    'kpi.list.deselect': 'Bỏ chọn',
    'kpi.list.approveSelected': 'Duyệt đã chọn ({count})',
    'kpi.list.rejectSelected': 'Từ chối đã chọn ({count})',

    // KPI Adjustments - Detail Dialog
    'kpi.detail.title': 'Chi tiết điều chỉnh KPI',
    'kpi.detail.description': 'Xem nhanh chi tiết điểm KPI trước khi duyệt.',
    'kpi.detail.staff': 'Nhân viên',
    'kpi.detail.team': 'Tổ đội',
    'kpi.detail.category': 'Hạng mục',
    'kpi.detail.status': 'Trạng thái',
    'kpi.detail.company': 'Công ty',
    'kpi.detail.taxCode': 'Mã số thuế',
    'kpi.detail.openMST': 'Mở MST',
    'kpi.detail.quantity': 'Số lượng',
    'kpi.detail.unitPoints': 'Điểm mỗi đơn vị',
    'kpi.detail.totalPoints': 'Tổng điểm',
    'kpi.detail.extraQuantity': 'Số lượng bổ sung',
    'kpi.detail.extraUnitPoints': 'Điểm bổ sung mỗi đơn vị',
    'kpi.detail.extraTotal': 'Điểm bổ sung',
    'kpi.detail.license': 'Giấy phép',
    'kpi.detail.note': 'Ghi chú',
    'kpi.detail.reference': 'Tham chiếu',
    'kpi.detail.noReference': 'Không có tham chiếu.',
    'kpi.detail.history': 'Lịch sử',
    'kpi.detail.rejectReason': 'Lý do từ chối (tuỳ chọn)',
    'kpi.detail.rejectPlaceholder': 'Ghi chú lý do từ chối...',
    'kpi.detail.clearLicense': 'Xóa mã giấy phép',
    'kpi.detail.delete': 'Xoá',
    'kpi.detail.approve': 'Duyệt',
    'kpi.detail.reject': 'Từ chối',

    // KPI Adjustments - Settings Dialog
    'kpi.settings.title': 'Cấu hình điểm KPI',
    'kpi.settings.focusLabel': 'Đang chỉnh nhanh cho: {category}',
    'kpi.settings.defaultPoints': 'Điểm mặc định',
    'kpi.settings.extraUnitPoints': 'Điểm bổ sung mỗi đơn vị',
    'kpi.settings.defaultMode': 'Chế độ mặc định',
    'kpi.settings.systemDefault': 'Theo hệ thống',
    'kpi.settings.modePoints': 'Điểm chế độ {mode}',
    'kpi.settings.licenseCode': 'Mã {code}',
    'kpi.settings.save': 'Lưu cấu hình',
    'kpi.settings.reset': 'Khôi phục mặc định',
    'kpi.settings.close': 'Đóng',
    'kpi.settings.adminHint': 'Chỉ áp dụng cho Admin/Quản lý. Để trống sẽ dùng giá trị hệ thống.',

    // KPI Adjustments - Common
    'kpi.common.notAssigned': 'Chưa gán',
    'kpi.common.dash': '—',
    'kpi.common.openDeclaration': 'Mở tờ khai {ref}',

    // KPI Adjustments - Errors (for console)
    'kpi.error.formatDate': 'Không thể định dạng thời gian điều chỉnh KPI',
    'kpi.error.defaultTeam': 'Không thể lấy thông tin tổ đội mặc định cho nhân viên',

    // AI Assistant
    'ai.noAccess': 'Chưa có quyền truy cập',
    'ai.noAccessDesc': 'Tài khoản hiện chưa được cấp quyền sử dụng trợ lý AI. Vui lòng liên hệ quản trị viên để được kích hoạt quyền {permission}.',
    'ai.date.none': 'Chưa có',
    'ai.usage.prompt': 'Prompt',
    'ai.usage.completion': 'Hoàn thành',
    'ai.usage.total': 'Tổng',
    'ai.provider.custom': 'Nhà cung cấp tùy chỉnh',
    'ai.mode.business': 'Tư vấn nghiệp vụ',
    'ai.mode.businessDesc': 'Giải đáp quy trình nghiệp vụ, chính sách KPI và phối hợp giữa các bộ phận.',
    'ai.mode.analytics': 'Thống kê nhanh',
    'ai.mode.analyticsDesc': 'Thực hiện tổng hợp số liệu KPI, so sánh xu hướng và nêu điểm bất thường.',
    'ai.mode.dataEntry': 'Trợ giúp nhập liệu',
    'ai.mode.dataEntryDesc': 'Hướng dẫn chuẩn hóa tờ khai, loại trừ trùng lặp và cập nhật giấy phép nhanh chóng.',
    'ai.range.thisMonth': 'Tháng này',
    'ai.range.lastMonth': 'Tháng trước',
    'ai.range.thisQuarter': 'Quý này',
    'ai.chat.placeholder': 'Nhập câu hỏi hoặc yêu cầu phân tích...',
    'ai.chat.send': 'Gửi',
    'ai.chat.stop': 'Dừng',
    'ai.chat.clear': 'Xóa lịch sử',
    'ai.chat.thinking': 'Đang suy nghĩ...',
    'ai.chat.retry': 'Thử lại',
    'ai.chat.copy': 'Sao chép',
    'ai.chat.regenerate': 'Tạo lại',
    'ai.history.title': 'Lịch sử trò chuyện',
    'ai.history.empty': 'Chưa có lịch sử trò chuyện nào.',
    'ai.history.load': 'Tải thêm',
    'ai.history.delete': 'Xóa',
    'ai.config.title': 'Cấu hình AI',
    'ai.config.provider': 'Nhà cung cấp',
    'ai.config.model': 'Model',
    'ai.config.apiKey': 'API Key',
    'ai.config.temperature': 'Ngẫu nhiên',
    'ai.config.maxTokens': 'Tối đa tokens',
    'ai.config.save': 'Lưu cấu hình',
    'ai.status.title': 'Trạng thái hệ thống',
    'ai.status.online': 'Đang hoạt động',
    'ai.status.offline': 'Ngừng hoạt động',
    'ai.insight.title': 'Thông tin nhanh',
    'ai.insight.generate': 'Tạo thông tin',

    // Report Viewer
    'report.rule.activeBadge': 'Đang áp dụng',
    'report.rule.defaultName': 'Bộ quy tắc',
    'report.rule.systemDefault': 'Cấu hình chuẩn hệ thống',
    'report.rule.activeMessage': 'Đang xem đúng bộ quy tắc đang áp dụng.',
    'report.rule.activeLabel': 'Bộ đang áp dụng:',
    'report.unit.points': 'điểm',
    'report.unit.declarations': 'tờ khai',
    'report.filter.allStaff': 'Tất cả nhân viên ({count})',
    'report.filter.allTeams': 'Tất cả tổ đội ({count})',
    'report.status.noTeamAssigned': 'Chưa gán tổ đội',
    'report.status.none': 'Không có',
    'report.action.backToDashboard': 'Quay lại Dashboard Tổng quan',
    'report.section.explorerAria': 'Khám phá phạm vi báo cáo KPI',
    'report.section.explorerTitle': 'Khám phá phạm vi báo cáo',
    'report.section.explorerDesc': 'Đổi lát cắt theo nhân viên hoặc tổ đội, tinh chỉnh cột hiển thị và xuất đúng phần dữ liệu đang cần kiểm tra.',
    'report.section.notesTitle': 'Ghi chú báo cáo KPI',
    'report.section.notesDesc': 'Giữ lại các quy tắc tính điểm và lưu ý export ở cuối workspace để phần đọc insight không bị chìm giữa nội dung vận hành.',
    'report.notes.kpiCalculation': 'Điểm KPI được tính tự động dựa trên quy tắc trong mục "Quy tắc KPI". Khi bạn import tờ khai hợp lệ từ Excel, hệ thống sẽ áp dụng quy tắc hiện hành để tính điểm cho từng bản ghi và cộng dồn theo nhân viên, tổ đội.',
    'report.notes.excludedLicenses': 'Các loại giấy phép bị loại trừ khỏi việc tính điểm: {codes}. Bạn có thể điều chỉnh danh sách này trong phần cấu hình quy tắc.',
    'report.notes.printExport': 'Để in báo cáo, hãy chọn phạm vi thời gian và chế độ xem mong muốn, sau đó sử dụng tổ hợp phím {shortcut} (hoặc Command+P trên macOS). Khi cần lưu trữ hoặc chia sẻ, sử dụng nút "Xuất Excel" để tải file theo template chứa bảng tổng hợp và bảng chi tiết tương ứng.',

    // Data Health Dashboard
    'health.date.unknown': 'Không xác định',
    'health.title': 'Tình trạng hệ thống',
    'health.status.online': 'Hoạt động',
    'health.status.degraded': 'Giảm hiệu năng',
    'health.status.offline': 'Ngừng hoạt động',

    // HQ Agency Manager
    'hq.error.load': 'Không thể tải danh sách Đại lý HQ. Vui lòng thử lại.',
    'hq.title': 'Quản lý Đại lý HQ',
    'hq.add': 'Thêm đại lý',
    'hq.import': 'Import Excel',
    'hq.export': 'Xuất Excel',
    'hq.save': 'Lưu thay đổi',
    'hq.search': 'Tìm kiếm đại lý...',
    'hq.filter.all': 'Tất cả',
    'hq.filter.active': 'Hoạt động',
    'hq.filter.inactive': 'Ngừng',
    'hq.table.mst': 'MST',
    'hq.table.name': 'Tên đại lý',
    'hq.table.agency': 'Chi nhánh',
    'hq.table.status': 'Trạng thái',
    'hq.table.actions': 'Thao tác',
    'hq.status.active': 'Hoạt động',
    'hq.status.inactive': 'Ngừng hoạt động',
    'hq.edit': 'Chỉnh sửa',
    'hq.delete': 'Xóa',
    'hq.confirmDelete': 'Xác nhận xóa đại lý này?',
    'hq.empty': 'Không có đại lý nào',

    // KPI Calculator (Shell)
    'shell.loading': 'Đang tải {module}',
    'shell.loadingDesc': 'Shell đang khởi tạo module và giữ nguyên ngữ cảnh điều hướng hiện tại.',
    'shell.error.title': 'Không thể hiển thị {module}',
    'shell.error.desc': 'Bạn có thể thử hiển thị lại module này hoặc chuyển sang tab khác để tiếp tục công việc.',

    // MST Assignment
    'mst.title': 'Phân công MST',
    'mst.add': 'Thêm phân công',
    'mst.import': 'Import Excel',
    'mst.export': 'Xuất Excel',
    'mst.search': 'Tìm MST, tên công ty...',
    'mst.filter.staff': 'Lọc theo nhân viên',
    'mst.filter.status': 'Trạng thái',
    'mst.table.mst': 'MST',
    'mst.table.company': 'Tên công ty',
    'mst.table.staff': 'Nhân viên phụ trách',
    'mst.table.team': 'Tổ đội',
    'mst.table.status': 'Trạng thái',
    'mst.table.updated': 'Cập nhật',
    'mst.status.active': 'Đang phụ trách',
    'mst.status.inactive': 'Đã chuyển',
    'mst.empty': 'Không có phân công nào',
    'mst.history.title': 'Lịch sử thay đổi',
    'mst.history.empty': 'Chưa có lịch sử',

    // Rules Editor
    'rules.error.formatHistory': 'Không thể định dạng thời gian lịch sử quy tắc',
    'rules.title': 'Quản lý quy tắc KPI',
    'rules.add': 'Thêm quy tắc',
    'rules.save': 'Lưu quy tắc',
    'rules.apply': 'Áp dụng ngay',
    'rules.simulate': 'Mô phỏng',
    'rules.test': 'Kiểm thử',
    'rules.history': 'Lịch sử',
    'rules.name': 'Tên quy tắc',
    'rules.version': 'Phiên bản',
    'rules.status': 'Trạng thái',
    'rules.default': 'Mặc định',
    'rules.active': 'Đang áp dụng',
    'rules.inactive': 'Không áp dụng',
    'rules.license': 'Giấy phép',
    'rules.points': 'Điểm',
    'rules.exclude': 'Loại trừ',
    'rules.include': 'Bao gồm',
    'rules.confirmDelete': 'Xác nhận xóa quy tắc này?',
    'rules.empty': 'Chưa có quy tắc nào',

    // Support Center
    'support.title': 'Trung tâm hỗ trợ',
    'support.feedback': 'Góp ý',
    'support.training': 'Đào tạo',
    'support.docs': 'Tài liệu',
    'support.contact': 'Liên hệ',
    'support.rating': 'Đánh giá',
    'support.message': 'Nội dung góp ý',
    'support.send': 'Gửi góp ý',
    'support.thanks': 'Cảm ơn bạn đã góp ý!',
    'support.category': 'Danh mục',
    'support.contactPlaceholder': 'Email hoặc số điện thoại (tùy chọn)',
    'support.error.saveProgress': 'Không thể lưu tiến độ đào tạo vào localStorage',
    'support.error.loadResources': 'Không thể tải tài liệu đào tạo',
    'support.training.duration': 'Thời lượng',
    'support.training.format': 'Định dạng',
    'support.training.tags': 'Từ khóa',
    'support.training.openDoc': 'Mở tài liệu',
    'support.training.markComplete': 'Đánh dấu đã hoàn thành',
    'support.training.markIncomplete': 'Đánh dấu chưa hoàn thành',
    'support.training.completedAt': 'Hoàn thành lúc',

    // Data Importer
    'import.title': 'Import dữ liệu',
    'import.upload': 'Tải file lên',
    'import.dropzone': 'Kéo thả file vào đây hoặc click để chọn',
    'import.preview': 'Xem trước',
    'import.import': 'Import',
    'import.processing': 'Đang xử lý...',
    'import.success': 'Import thành công',
    'import.error': 'Import thất bại',
    'import.duplicate': 'Phát hiện trùng lặp',
    'import.review': 'Xem xét',
    'import.skip': 'Bỏ qua',
    'import.replace': 'Thay thế',
    'import.merge': 'Gộp',
    'import.columnMapping': 'Ánh xạ cột',
    'import.required': 'Bắt buộc',
    'import.optional': 'Tùy chọn',
    'import.stage.upload': 'Tải lên',
    'import.stage.preview': 'Xem trước',
    'import.stage.import': 'Import',
    'import.stage.done': 'Hoàn tất',
    'import.noPermission.title': 'Bạn chưa được cấp quyền tải file Import Data.',
    'import.noPermission.desc': 'Liên hệ quản lý hoặc quản trị viên để bật quyền {permission}. Nếu cần xử lý gấp, hãy gửi file cho quản trị viên để họ hỗ trợ import thay.',
    'import.readonly.view': 'Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản được cấp quyền để import, chỉnh sửa và lưu dữ liệu tờ khai.',
    'import.readonly.alerts': 'Bạn có thể rà soát và đánh dấu các tờ khai thiếu thông tin nhưng không thể chỉnh sửa dữ liệu tờ khai.',
    'import.step.source.title': '1. Nạp nguồn',
    'import.step.source.desc': 'Chuẩn bị nguồn dữ liệu bằng file XLSX hoặc đồng bộ ECUS trước khi chuyển sang bước rà soát.',
    'import.step.review.title': '2. Rà soát dữ liệu',
    'import.step.review.desc.preview': 'Kiểm tra dữ liệu xem trước, xử lý bộ lọc và quyết định có import vào workspace hay không.',
    'import.step.review.desc.sync': 'Kiểm tra dữ liệu xem trước từ ECUS, áp bộ lọc rà soát, rồi quyết định có chạy đồng bộ vào workspace hay không.',
    'import.step.review.desc.workspace': 'Điều chỉnh bộ lọc và cách hiển thị để rà soát workspace trước khi chốt thay đổi.',
    'import.step.save.title': '3. Lưu và theo dõi',
    'import.step.save.desc.preview': 'Sau khi import, dữ liệu sẽ chuyển sang workspace đã lưu để tiếp tục theo dõi và xử lý hậu kiểm.',
    'import.step.save.desc.workspace': 'Chốt thay đổi, theo dõi cảnh báo sau đồng bộ, và tiếp tục giám sát dữ liệu đã lưu.',
    'import.loading.source': 'Đang tải khối nạp nguồn dữ liệu...',
    'import.loading.review': 'Đang tải khối rà soát dữ liệu...',
    'import.loading.save': 'Đang tải khối lưu và theo dõi...',
    'import.afterImport.note': 'Import xong, toàn bộ workspace đã lưu và bề mặt theo dõi cảnh báo sẽ xuất hiện ở bước này.',
  },
};



let currentLocale = 'vi';

/**
 * Get translation for a key
 * @param {string} key - Translation key (dot notation)
 * @param {object} params - Replacement parameters
 * @returns {string} Translated string or key if not found
 */
export function t(key, params = {}) {
  const keys = key.split('.');
  let value = translations[currentLocale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key as fallback
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Replace parameters {key} with values
  return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey] !== undefined ? String(params[paramKey]) : match;
  });
}

/**
 * Set current locale
 * @param {string} locale - Locale code (e.g., 'vi', 'en')
 */
export function setLocale(locale) {
  if (locale in translations) {
    currentLocale = locale;
  }
}

/**
 * Get current locale
 * @returns {string} Current locale code
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Add or extend translations for a locale
 * @param {string} locale - Locale code
 * @param {object} newTranslations - Translations object to merge
 */
export function addTranslations(locale, newTranslations) {
  if (!translations[locale]) {
    translations[locale] = {};
  }
  Object.assign(translations[locale], newTranslations);
}
