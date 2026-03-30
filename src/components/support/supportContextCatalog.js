import { getAppTabDefinition } from '@/lib/appShellNavigation.js';

const GENERAL_REFERENCE = Object.freeze({
  id: 'user-guide',
  title: 'Hướng dẫn sử dụng tổng quan',
  path: 'docs/USER_GUIDE.md',
  summary:
    'Tài liệu nền để tra nhanh quyền hạn, quy trình vận hành và mô tả từng khu vực chức năng.',
});

const CONTEXT_CATALOG = Object.freeze({
  import: {
    summary:
      'Ưu tiên xác nhận nguồn ECUS, bộ lọc MST và các bước kiểm tra trước khi ghi dữ liệu vào hệ thống.',
    faqs: [
      {
        question: 'Khi nào nên chạy đồng bộ ECUS thay vì import file Excel thủ công?',
        answer:
          'Dùng đồng bộ ECUS khi cần lấy dữ liệu mới nhất từ nguồn nghiệp vụ; dùng import thủ công khi đang rà soát file cục bộ hoặc cần chỉnh dữ liệu trước khi ghi.',
      },
      {
        question: 'Nếu đồng bộ thất bại, cần kiểm tra gì trước?',
        answer:
          'Kiểm tra trạng thái backend, quyền truy cập SQL/ECUS, bộ lọc MST đang bật và thông báo lỗi gần nhất trong khu Health & sync triage.',
      },
    ],
    docReferences: [
      {
        id: 'ecus-sync-monitoring',
        title: 'ECUS sync monitoring',
        path: 'docs/operations/ecus-sync-monitoring.md',
        summary:
          'Runbook theo dõi trạng thái bridge, timeout SQL và checklist xử lý khi đồng bộ chậm hoặc gián đoạn.',
      },
      {
        id: 'ecus-bridge-service',
        title: 'ECUS bridge service',
        path: 'docs/operations/ecus-bridge-service.md',
        summary:
          'Mô tả service trung gian, biến môi trường và các điểm cần xác nhận khi cấu hình kết nối ECUS.',
      },
    ],
    resourceKeywords: ['import', 'ecus', 'operations', 'data-quality'],
  },
  mst: {
    summary:
      'Tập trung vào quy tắc hiệu lực, tránh gán trùng người phụ trách và kiểm tra lịch sử thay đổi trước khi lưu.',
    faqs: [
      {
        question: 'Khi phát hiện MST bị gán trùng thì nên xử lý thế nào?',
        answer:
          'So sánh khoảng hiệu lực, xác nhận người phụ trách cuối cùng và ưu tiên dùng gợi ý giữ/chuyển/tách vai trò ngay trong bảng để tránh ghi đè nhầm.',
      },
      {
        question: 'Vì sao cần xem timeline trước khi sửa?',
        answer:
          'Timeline cho biết ai đã chỉnh, thời điểm hiệu lực nào đang chồng nhau và giúp quyết định có nên cập nhật hay tạo bản ghi mới.',
      },
    ],
    docReferences: [
      {
        id: 'mst-ui-plan',
        title: 'Kế hoạch nâng cấp tab Gán MST',
        path: 'docs/operations/mst-assignment-ui-plan.md',
        summary:
          'Tài liệu chi tiết về các lane UI, duplicate detection, lead-view và những nguyên tắc vận hành mới của tab Gán MST.',
      },
    ],
    resourceKeywords: ['mst', 'operations', 'doanh nghiep'],
  },
  hq: {
    summary:
      'Dùng khu Đại Lý HQ để chuẩn hóa đối tác theo MST trước khi đẩy dữ liệu sang các màn Import hoặc Gán MST.',
    faqs: [
      {
        question: 'Có thể lưu nhiều đại lý trên cùng một MST không?',
        answer:
          'Có. Hãy nhập danh sách được phân tách bằng dấu phẩy, chấm phẩy, gạch dọc hoặc xuống dòng; hệ thống sẽ chuẩn hóa và loại bản sao.',
      },
    ],
    docReferences: [],
    resourceKeywords: ['operations', 'hai quan'],
  },
  teams: {
    summary:
      'Khu này dùng để cân lại roster, phân bổ chỉ tiêu và rà soát doanh nghiệp đang thuộc từng tổ trước khi chốt KPI.',
    faqs: [
      {
        question: 'Khi điều chuyển nhân sự giữa các tổ đội cần chú ý gì?',
        answer:
          'Hãy kiểm tra roster hiện tại, các doanh nghiệp đang phụ trách và xác nhận lại ảnh hưởng sang tab Gán MST sau khi lưu.',
      },
    ],
    docReferences: [],
    resourceKeywords: ['team', 'phan cong'],
  },
  rules: {
    summary:
      'Mọi thay đổi quy tắc cần kiểm tra lại bộ test nhanh và xác nhận tác động lên báo cáo trước khi áp dụng rộng.',
    faqs: [
      {
        question: 'Sau khi sửa quy tắc KPI cần kiểm tra gì?',
        answer:
          'Nên dùng Test nhanh để so sánh điểm kỳ vọng, sau đó mở Báo cáo KPI để xác nhận số tổng hợp không lệch ngoài dự kiến.',
      },
    ],
    docReferences: [],
    resourceKeywords: ['kpi', 'rule', 'dashboard'],
  },
  adjustments: {
    summary:
      'Điểm cộng/trừ thủ công nên luôn đi kèm tham chiếu rõ ràng để người duyệt có thể đối chiếu nhanh ở báo cáo và audit.',
    faqs: [
      {
        question: 'Khi nào nên dùng điều chỉnh KPI thủ công?',
        answer:
          'Chỉ dùng khi phát sinh ngoài quy tắc hiện hành hoặc cần xử lý trường hợp đặc biệt đã được trưởng nhóm/phê duyệt thống nhất.',
      },
    ],
    docReferences: [],
    resourceKeywords: ['kpi', 'analytics'],
  },
  reports: {
    summary:
      'Tại đây nên chốt phạm vi kỳ báo cáo, xác nhận template và kiểm tra cảnh báo lệch chuẩn trước khi xuất file.',
    faqs: [
      {
        question: 'Trước khi xuất báo cáo cần rà soát gì?',
        answer:
          'Xác nhận phạm vi thời gian, quy tắc đang áp dụng, bộ lọc nhân sự/tổ đội và các điều chỉnh KPI phát sinh trong kỳ.',
      },
      {
        question: 'Khi lịch chạy báo cáo không đúng kỳ vọng thì xử lý thế nào?',
        answer:
          'Mở khu lập lịch để xem lần chạy kế tiếp, nội dung preview và trạng thái giao nhận; nếu cần hãy cập nhật template hoặc recipients rồi chạy thử lại.',
      },
    ],
    docReferences: [],
    resourceKeywords: ['reports', 'dashboard', 'analytics'],
  },
  health: {
    summary:
      'Trang này dùng để triage dữ liệu/sync: đọc cảnh báo, xác định lane lỗi và đối chiếu runbook vận hành tương ứng.',
    faqs: [
      {
        question: 'Khi nào nên escalate sang CNTT hoặc backend owner?',
        answer:
          'Escalate khi bridge mất kết nối kéo dài, retry queue không giảm hoặc cảnh báo SQL/ECUS tái diễn sau khi đã kiểm tra checklist tại chỗ.',
      },
    ],
    docReferences: [
      {
        id: 'health-monitoring',
        title: 'ECUS sync monitoring',
        path: 'docs/operations/ecus-sync-monitoring.md',
        summary:
          'Checklist triage cho timeout SQL, queue tồn đọng và các chỉ số cần quan sát ở dashboard sức khỏe dữ liệu.',
      },
      {
        id: 'qa-log',
        title: 'UI verification log',
        path: 'docs/operations/ui-verification-log.md',
        summary:
          'Nhật ký xác minh UI và các bước QA gần nhất để đối chiếu khi tái hiện lỗi giao diện/vận hành.',
      },
    ],
    resourceKeywords: ['operations', 'data-quality', 'import'],
  },
  ai: {
    summary:
      'Ưu tiên kiểm tra provider, snapshot đầu vào và feedback insight trước khi kết luận AI trả kết quả bất thường.',
    faqs: [
      {
        question: 'Insight AI có vẻ sai thì nên kiểm tra ở đâu trước?',
        answer:
          'Xem snapshot KPI đã dùng, provider hiện tại, lịch sử cache và feedback gần nhất để phân biệt lỗi dữ liệu đầu vào với lỗi mô hình.',
      },
    ],
    docReferences: [
      {
        id: 'ai-insights',
        title: 'AI insights operations',
        path: 'docs/operations/ai-insights.md',
        summary:
          'Runbook cho insight scheduler, feedback loop và cách đọc trạng thái sinh insight theo từng lần chạy.',
      },
      {
        id: 'ai-kpi-snapshot',
        title: 'AI KPI snapshot',
        path: 'docs/operations/ai-kpi-snapshot.md',
        summary:
          'Tài liệu giải thích snapshot KPI, nguồn dữ liệu và các kiểm tra cần có trước khi gửi prompt cho AI.',
      },
      {
        id: 'ai-provider-switch',
        title: 'AI provider switch checklist',
        path: 'docs/operations/ai-provider-switch-checklist.md',
        summary:
          'Checklist chuyển provider, xác minh HTTPS/internal requirements và các bước rollback nếu cần.',
      },
    ],
    resourceKeywords: ['ai', 'dashboard', 'onboarding'],
  },
  accounts: {
    summary:
      'Quản trị tài khoản cần bám theo quyền tối thiểu, ghi lại lý do cấp quyền và rà soát mật khẩu bootstrap/tạm thời.',
    faqs: [
      {
        question: 'Có thể xóa tài khoản admin cuối cùng không?',
        answer:
          'Không. Hệ thống chặn thao tác đó để tránh mất quyền quản trị cuối cùng.',
      },
    ],
    docReferences: [],
    resourceKeywords: ['admin', 'onboarding'],
  },
  audit: {
    summary:
      'Dùng tab Nhật ký để đối chiếu ai làm gì, thời điểm nào và liên hệ lại đúng lane khi cần truy vết sự cố.',
    faqs: [
      {
        question: 'Nhật ký chỉ giữ 200 bản ghi gần nhất có ảnh hưởng gì?',
        answer:
          'Nếu cần lưu trữ dài hạn, hãy xuất báo cáo hoặc trích log định kỳ để không mất dấu các thao tác cũ.',
      },
    ],
    docReferences: [],
    resourceKeywords: ['audit', 'operations'],
  },
  'export-audit': {
    summary:
      'Theo dõi lịch sử export để xác định ai đã tải báo cáo, template nào đang được dùng và thời điểm phát sinh file.',
    faqs: [
      {
        question: 'Khi cần truy vết file báo cáo đã tải, nên xem gì trước?',
        answer:
          'Đối chiếu người thực hiện, mốc thời gian export và phạm vi báo cáo để khớp với yêu cầu nghiệp vụ hoặc phản hồi từ người dùng.',
      },
    ],
    docReferences: [],
    resourceKeywords: ['export', 'reports', 'audit'],
  },
});

function dedupeReferences(references) {
  const seen = new Set();
  return references.filter((reference) => {
    if (!reference?.path || seen.has(reference.path)) {
      return false;
    }
    seen.add(reference.path);
    return true;
  });
}

function scoreResourceAgainstKeywords(resource, keywords) {
  const normalizedKeywords = keywords
    .map((keyword) => String(keyword || '').trim().toLowerCase())
    .filter(Boolean);
  if (!normalizedKeywords.length) {
    return 0;
  }
  const haystack = [
    resource?.title,
    resource?.description,
    Array.isArray(resource?.tags) ? resource.tags.join(' ') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return normalizedKeywords.reduce((score, keyword) => {
    if (!haystack.includes(keyword)) {
      return score;
    }
    const isTagMatch = Array.isArray(resource?.tags)
      ? resource.tags.some((tag) => String(tag || '').toLowerCase() === keyword)
      : false;
    return score + (isTagMatch ? 3 : 1);
  }, 0);
}

export function resolveSupportContext(tabId) {
  const normalizedTabId = typeof tabId === 'string' && tabId.trim() ? tabId.trim() : 'reports';
  const tabDefinition = getAppTabDefinition(normalizedTabId);
  const entry = CONTEXT_CATALOG[normalizedTabId] || null;

  return {
    id: normalizedTabId,
    label: tabDefinition?.label || 'Màn hình hiện tại',
    summary:
      entry?.summary ||
      'Dùng hub này để xem nhanh FAQ, tài liệu tham chiếu nội bộ và tài nguyên đào tạo phù hợp với màn hình đang mở.',
    faqs: Array.isArray(entry?.faqs) ? entry.faqs : [],
    docReferences: dedupeReferences([GENERAL_REFERENCE, ...(entry?.docReferences || [])]),
    resourceKeywords: Array.from(
      new Set([
        normalizedTabId,
        ...(Array.isArray(tabDefinition?.commandKeywords) ? tabDefinition.commandKeywords : []),
        ...(Array.isArray(entry?.resourceKeywords) ? entry.resourceKeywords : []),
      ]),
    ),
  };
}

export function getSuggestedSupportResources(resources, context, limit = 3) {
  if (!Array.isArray(resources) || !context) {
    return [];
  }
  return resources
    .map((resource) => ({
      resource,
      score: scoreResourceAgainstKeywords(resource, context.resourceKeywords || []),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.resource.title).localeCompare(String(right.resource.title), 'vi'),
    )
    .slice(0, limit)
    .map((entry) => entry.resource);
}
