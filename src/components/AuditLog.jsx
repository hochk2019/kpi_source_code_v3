import React, { useEffect, useMemo, useState } from "react";
import { getAuditLogs, clearAuditLogs } from "@/lib/store.js";

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("vi-VN", {
      hour12: false,
    });
  } catch {
    return value;
  }
}

export default function AuditLog({ currentUser }) {
  const [logs, setLogs] = useState(() => getAuditLogs(200));
  const [filter, setFilter] = useState("");

  const refresh = () => {
    setLogs(getAuditLogs(200));
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredLogs = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return logs;
    return logs.filter((entry) =>
      [entry.actor, entry.action, entry.detail]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(keyword))
    );
  }, [logs, filter]);

  const handleClear = () => {
    if (!window.confirm("Xóa toàn bộ nhật ký và ghi lại thao tác này?")) return;
    clearAuditLogs({ actor: currentUser?.username || "system", note: "Xóa nhật ký thủ công" });
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-64 rounded border px-3 py-2 text-sm"
          placeholder="Lọc theo người thực hiện hoặc hành động"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          onClick={refresh}
          className="rounded border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
        >
          Tải lại
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded border border-red-500 px-3 py-2 text-sm text-red-600"
        >
          Xóa nhật ký
        </button>
      </div>

      <div className="overflow-x-auto rounded border bg-white shadow-sm">
        <table className="min-w-full divide-y text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Người thực hiện</th>
              <th className="px-3 py-2">Hành động</th>
              <th className="px-3 py-2">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredLogs.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-gray-500" colSpan={4}>
                  Không có bản ghi phù hợp.
                </td>
              </tr>
            ) : (
              filteredLogs.map((entry, index) => (
                <tr key={`${entry.ts}-${index}`} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatTime(entry.ts)}</td>
                  <td className="px-3 py-2">{entry.actor || "system"}</td>
                  <td className="px-3 py-2">{entry.action}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap">{entry.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
