import { useMemo } from 'react';

import { CircleHelp, ExternalLink } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.jsx';

const HELP_CATALOG = {
  reports: {
    title: 'Báo cáo KPI',
    summary:
      'Cách lọc, xuất Excel/PDF và giải thích các chỉ số KPI tổng hợp theo bộ quy tắc đang áp dụng.',
    resources: [
      {
        label: 'Hướng dẫn báo cáo KPI',
        href: '/docs/USER_GUIDE.md#26-bao-cao-kpi',
        description: 'Bao gồm mẹo lọc nhanh, in ấn và yêu cầu quyền khi xuất file.',
      },
      {
        label: 'Checklist rà soát báo cáo cuối sprint',
        href: '/docs/operations/ui-verification-log.md',
        description: 'Đảm bảo báo cáo thống nhất trước khi gửi cho ban lãnh đạo.',
      },
    ],
    faqs: [
      {
        question: 'Không thấy nút Xuất Excel/PDF?',
        href: '/docs/USER_GUIDE.md#26-bao-cao-kpi',
      },
      {
        question: 'Làm sao đối chiếu KPI giữa các tháng?',
        href: '/docs/USER_GUIDE.md#26-bao-cao-kpi',
      },
    ],
  },
  import: {
    title: 'Import tờ khai',
    summary:
      'Các bước tải file Excel, kiểm tra preview và đồng bộ ECUS cùng mẹo xử lý lỗi thường gặp.',
    resources: [
      {
        label: 'Quy trình import dữ liệu',
        href: '/docs/USER_GUIDE.md#21-import-data',
        description: 'Giải thích wizard nhiều bước, cấu hình đồng bộ và preset bộ lọc.',
      },
      {
        label: 'Kế hoạch vận hành đồng bộ ECUS',
        href: '/docs/operations/ecus-sync-monitoring.md',
        description: 'Theo dõi trạng thái backend và cấu hình cảnh báo khi đồng bộ thất bại.',
      },
    ],
    faqs: [
      {
        question: 'Preview bị đẩy về bước đầu khi đang xem?',
        href: '/docs/USER_GUIDE.md#21-import-data',
      },
      {
        question: 'Lỗi kết nối SQL Server khi đồng bộ?',
        href: '/docs/operations/ecus-sync-monitoring.md#4-theo-doi-va-xu-ly-su-co',
      },
    ],
  },
  mst: {
    title: 'Gán MST',
    summary:
      'Quy trình cập nhật doanh nghiệp, nhân sự phụ trách và xử lý trùng MST.',
    resources: [
      {
        label: 'Hướng dẫn tab Gán MST',
        href: '/docs/USER_GUIDE.md#23-gan-mst',
        description: 'Bao gồm mẹo nhập Excel, lịch sử thay đổi và đồng bộ sang import.',
      },
      {
        label: 'Kế hoạch nâng cấp giao diện MST',
        href: '/docs/operations/mst-assignment-ui-plan.md',
        description: 'Theo dõi roadmap giao diện và các cải tiến đã triển khai.',
      },
    ],
    faqs: [
      {
        question: 'Làm sao xử lý khi MST có nhiều đại lý?',
        href: '/docs/USER_GUIDE.md#23-gan-mst',
      },
      {
        question: 'Cách tra lịch sử thay đổi MST?',
        href: '/docs/USER_GUIDE.md#23-gan-mst',
      },
    ],
  },
  hq: {
    title: 'Đại lý hải quan',
    summary: 'Quản lý danh sách đại lý, import Excel và đồng bộ thông tin doanh nghiệp.',
    resources: [
      {
        label: 'Hướng dẫn tab Đại lý HQ',
        href: '/docs/USER_GUIDE.md#22-dai-ly-hq',
        description: 'Ghi chú định dạng file và quy tắc đồng bộ với bảng MST.',
      },
    ],
    faqs: [
      {
        question: 'Nhập nhiều đại lý cho cùng MST như thế nào?',
        href: '/docs/USER_GUIDE.md#22-dai-ly-hq',
      },
    ],
  },
  teams: {
    title: 'Quản lý tổ đội',
    summary:
      'Theo dõi nhân sự theo tổ, điều chuyển thành viên và đồng bộ roster sang MST.',
    resources: [
      {
        label: 'Hướng dẫn quản lý tổ đội',
        href: '/docs/USER_GUIDE.md#24-quan-ly-to-doi',
        description: 'Bao gồm chế độ trưởng nhóm, lịch sử MST và lưu tự động.',
      },
    ],
    faqs: [
      {
        question: 'Cách bật chế độ trưởng nhóm?',
        href: '/docs/USER_GUIDE.md#24-quan-ly-to-doi',
      },
      {
        question: 'Điều chuyển thành viên giữa các tổ?',
        href: '/docs/USER_GUIDE.md#24-quan-ly-to-doi',
      },
    ],
  },
  rules: {
    title: 'Quy tắc KPI',
    summary: 'Điều chỉnh rule v2, cộng điểm C/O và thử nghiệm nhanh trước khi áp dụng.',
    resources: [
      {
        label: 'Tài liệu cấu hình quy tắc KPI',
        href: '/docs/USER_GUIDE.md#25-quy-tac-kpi',
        description: 'Giải thích từng nhóm rule và cách export/import JSON.',
      },
    ],
    faqs: [
      {
        question: 'Khi nào nên bật cộng điểm C/O?',
        href: '/docs/USER_GUIDE.md#25-quy-tac-kpi',
      },
      {
        question: 'Cách hoàn nguyên về mặc định?',
        href: '/docs/USER_GUIDE.md#25-quy-tac-kpi',
      },
    ],
  },
  adjustments: {
    title: 'Điều chỉnh KPI',
    summary: 'Quy trình rà soát điều chỉnh, duyệt hàng loạt và lưu lịch sử minh bạch.',
    resources: [
      {
        label: 'Hướng dẫn điều chỉnh KPI',
        href: '/docs/operations/kpi-adjustments-guide.md',
        description: 'Chi tiết tạo điều chỉnh, phân quyền và quy trình duyệt.',
      },
    ],
    faqs: [
      {
        question: 'Làm sao duyệt/từ chối hàng loạt?',
        href: '/docs/operations/kpi-adjustments-guide.md#duyet-hang-loat',
      },
      {
        question: 'Ghi chú audit lưu ở đâu?',
        href: '/docs/operations/kpi-adjustments-guide.md#lich-su-va-audit',
      },
    ],
  },
  accounts: {
    title: 'Quản lý tài khoản',
    summary: 'Tạo người dùng, gán quyền chi tiết và đặt lại mật khẩu an toàn.',
    resources: [
      {
        label: 'Hướng dẫn quản trị tài khoản',
        href: '/docs/USER_GUIDE.md#27-quan-ly-tai-khoan-chi-hien-thi-khi-tai-khoan-co-quyen-quan-ly-tai-khoan',
        description: 'Các bước tạo tài khoản, đặt lại mật khẩu và ghi nhật ký.',
      },
      {
        label: 'Checklist bảo mật tài khoản',
        href: '/docs/USER_GUIDE.md#6-tai-khoan-mac-dinh--khuyen-nghi-bao-mat',
      },
    ],
    faqs: [
      {
        question: 'Không xóa được tài khoản quản trị cuối cùng?',
        href: '/docs/USER_GUIDE.md#27-quan-ly-tai-khoan-chi-hien-thi-khi-tai-khoan-co-quyen-quan-ly-tai-khoan',
      },
      {
        question: 'Người dùng quên mật khẩu thì xử lý thế nào?',
        href: '/docs/USER_GUIDE.md#3-quan-tri-tai-khoan',
      },
    ],
  },
  audit: {
    title: 'Nhật ký hệ thống',
    summary: 'Tra cứu lịch sử thao tác, lọc hành động và xuất dữ liệu audit.',
    resources: [
      {
        label: 'Hướng dẫn nhật ký hệ thống',
        href: '/docs/USER_GUIDE.md#28-nhat-ky-he-thong-chi-hien-thi-khi-co-quyen-quan-ly-tai-khoan',
      },
    ],
    faqs: [
      {
        question: 'Có thể xóa toàn bộ nhật ký không?',
        href: '/docs/USER_GUIDE.md#28-nhat-ky-he-thong-chi-hien-thi-khi-co-quyen-quan-ly-tai-khoan',
      },
    ],
  },
  'export-audit': {
    title: 'Xuất báo cáo audit',
    summary: 'Thiết lập watermark, giới hạn truy cập và quy trình phê duyệt trước khi chia sẻ.',
    resources: [
      {
        label: 'Hướng dẫn xuất audit report',
        href: '/docs/operations/export-watermark.md',
        description: 'Cách thêm watermark, lựa chọn định dạng và kiểm soát người nhận.',
      },
    ],
    faqs: [
      {
        question: 'Làm sao bật watermark cho bản in?',
        href: '/docs/operations/export-watermark.md#them-watermark-vao-bao-cao',
      },
    ],
  },
  ai: {
    title: 'Trợ lý AI',
    summary: 'Khai thác insight tự động, snapshot KPI và phản hồi chất lượng câu trả lời.',
    resources: [
      {
        label: 'Kiến trúc insight AI',
        href: '/docs/operations/ai-insights.md',
        description: 'Mô tả luồng xử lý snapshot, provider và audit phản hồi.',
      },
      {
        label: 'Hướng dẫn tab Trợ lý AI',
        href: '/docs/USER_GUIDE.md#29-tro-ly-ai',
      },
    ],
    faqs: [
      {
        question: 'Insight báo lỗi hoặc không cập nhật?',
        href: '/docs/operations/ai-insights.md#luu-y-van-hanh',
      },
      {
        question: 'Khi nào cần chạy lại snapshot?',
        href: '/docs/operations/ai-insights.md#luong-xu-ly-tong-quat',
      },
    ],
  },
  health: {
    title: 'Data Health Dashboard',
    summary: 'Theo dõi chất lượng dữ liệu import và cảnh báo sai lệch trước khi lập báo cáo.',
    resources: [
      {
        label: 'Tài liệu Data Health Dashboard',
        href: '/docs/operations/data-health-dashboard.md',
        description: 'Liệt kê các chỉ số theo dõi, cảnh báo phổ biến và checklist xử lý.',
      },
      {
        label: 'Checklist QA cuối sprint',
        href: '/docs/operations/ui-verification-log.md',
      },
    ],
    faqs: [
      {
        question: 'Phát hiện số tờ khai bị thiếu ở đâu?',
        href: '/docs/operations/data-health-dashboard.md#chi-so-giam-sat-chinh',
      },
      {
        question: 'Cách xuất danh sách cảnh báo để xử lý?',
        href: '/docs/operations/data-health-dashboard.md#chia-se-va-xuat-bao-cao',
      },
    ],
  },
};

const DEFAULT_TOPIC = {
  title: 'Tài liệu hệ thống KPI',
  summary: 'Tổng hợp hướng dẫn sử dụng, vận hành và checklist kiểm thử cho toàn bộ hệ thống.',
  resources: [
    {
      label: 'Hướng dẫn sử dụng đầy đủ',
      href: '/docs/USER_GUIDE.md',
      description: 'Giải thích chức năng từng tab, tài khoản mẫu và quy trình vận hành.',
    },
    {
      label: 'Checklist vận hành UI',
      href: '/docs/operations/ui-verification-log.md',
    },
  ],
  faqs: [
    {
      question: 'Không biết bắt đầu từ đâu?',
      href: '/docs/USER_GUIDE.md#1-truy-cap-va-phan-quyen-tong-quat',
    },
  ],
};

export default function ContextHelpHub({ activeTab }) {
  const topic = useMemo(() => HELP_CATALOG[activeTab] || DEFAULT_TOPIC, [activeTab]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-amber-400/60 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 shadow-sm transition hover:border-amber-500 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
          data-tooltip="Hướng dẫn nhanh & FAQ cho màn hình hiện tại"
        >
          <CircleHelp className="mr-2 h-4 w-4" strokeWidth={2} />
          Trợ giúp nhanh
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0 text-sm">
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          <div className="bg-amber-50/60 px-4 py-3 dark:bg-amber-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">{topic.title}</p>
            <p className="mt-1 text-[13px] text-gray-700 dark:text-gray-200">{topic.summary}</p>
          </div>
          <section className="px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài liệu nổi bật</h3>
            <ul className="mt-2 space-y-2">
              {topic.resources.map((item) => (
                <li key={item.href} className="rounded-md border border-gray-100 bg-white/70 p-2 text-[13px] shadow-sm transition hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-amber-500/60 dark:hover:bg-amber-500/10">
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2 text-amber-700 transition hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200"
                  >
                    <span className="flex-1 font-medium leading-5">{item.label}</span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />
                  </a>
                  {item.description ? (
                    <p className="mt-1 text-[12px] leading-snug text-gray-600 dark:text-gray-400">{item.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          {topic.faqs?.length ? (
            <section className="px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Câu hỏi thường gặp</h3>
              <ul className="mt-2 space-y-1 text-[13px]">
                {topic.faqs.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-amber-700 transition hover:bg-amber-50 hover:text-amber-600 dark:text-amber-300 dark:hover:bg-amber-500/10 dark:hover:text-amber-200"
                    >
                      <span className="leading-tight">{item.question}</span>
                      <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

