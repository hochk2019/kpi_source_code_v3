import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";

const METRIC_ITEMS = [
  { key: "total", label: "Tổng số mục", valueClassName: "text-foreground" },
  { key: "approved", label: "Đã duyệt", valueClassName: "text-emerald-600" },
  { key: "pending", label: "Chờ duyệt", valueClassName: "text-amber-600" },
  { key: "totalPoints", label: "Điểm đã cộng/trừ", valueClassName: "text-blue-600", decimal: true },
];

export default function KpiAdjustmentOverviewPanel({ stats, formatInt, formatDecimal }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Tổng quan điểm KPI +/-</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0 sm:grid-cols-2 lg:grid-cols-4">
        {METRIC_ITEMS.map((item) => (
          <div key={item.key} className="rounded-lg border border-border bg-muted/50 p-4 text-sm shadow-sm">
            <div className="text-xs font-medium uppercase text-muted-foreground">{item.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${item.valueClassName}`}>
              {item.decimal ? formatDecimal(stats[item.key]) : formatInt(stats[item.key])}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
