/* /src/components/ReportViewer.jsx */
import React, { useMemo, useState } from "react";
import { getDeclRows, getRules } from "@/lib/store.js";

export default function ReportViewer() {
  const decls = getDeclRows();
  const rules = getRules(); // để sau mở rộng tính KPI
  const ruleTitle = rules?.name || "Chưa đặt tên";
  const ruleApply = rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : "Áp dụng ngay";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(()=>{
    if (!Array.isArray(decls)) return [];
    return decls.filter(r => {
      if (from && (r.date||"") < from) return false;
      if (to   && (r.date||"") > to)   return false;
      return true;
    });
  }, [decls, from, to]);

  return (
    <div className="space-y-3">
      <div className="rounded border p-3 flex gap-3 items-center">
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border rounded px-2 py-1"/>
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border rounded px-2 py-1"/>
        <div className="ml-auto text-sm opacity-70 space-x-3">
          <span>{filtered.length} tờ khai</span>
          <span className="italic">{ruleTitle} — {ruleApply}</span>
        </div>
      </div>

      {!filtered.length ? (
        <div className="p-6 text-center opacity-60">Chưa có dữ liệu hợp lệ để tính KPI.</div>
      ) : (
        <div className="p-3 border rounded">
          {/* Bạn có thể thêm card Tổng KPI, KPI theo ngày, top nhân viên… ở đây */}
          Dữ liệu đã sẵn sàng để tính KPI/Excel.
        </div>
      )}
    </div>
  );
}
