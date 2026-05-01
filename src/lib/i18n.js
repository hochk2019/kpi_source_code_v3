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
    'common.next': 'Tiếp theo',
    'common.submit': 'Gửi',
    'common.reset': 'Nhập lại',

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
