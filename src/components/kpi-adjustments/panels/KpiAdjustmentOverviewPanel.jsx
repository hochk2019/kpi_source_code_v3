const METRIC_ITEMS = [
  { key: "total", label: "Tổng số mục", valueClassName: "text-gray-900" },
  { key: "approved", label: "Đã duyệt", valueClassName: "text-teal-700" },
  { key: "pending", label: "Chờ duyệt", valueClassName: "text-amber-600" },
  { key: "totalPoints", label: "Điểm đã cộng/trừ", valueClassName: "text-blue-600", decimal: true },
];

export default function KpiAdjustmentOverviewPanel({ stats, formatInt, formatDecimal }) {
  return (
    <div className="bg-white/40 backdrop-blur-md rounded-xl p-6 shadow-sm border border-gray-100 mb-4">
      <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-widest mb-4">Tổng quan điểm KPI +/-</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRIC_ITEMS.map((item) => (
          <div key={item.key} className="rounded-2xl bg-white/70 backdrop-blur border border-white p-5 shadow-[0_2px_10px_rgba(48,51,48,0.02)] transition-all hover:shadow-[0_8px_30px_rgba(0,107,99,0.05)]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{item.label}</div>
            <div className={`text-3xl font-light tracking-tight ${item.valueClassName}`}>
              {item.decimal ? formatDecimal(stats[item.key]) : formatInt(stats[item.key])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
