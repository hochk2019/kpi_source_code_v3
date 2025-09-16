// src/components/DataImporter.jsx
import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { saveDeclRows, pushImportLog } from "@/lib/store.js";
import { mapRow } from "@/lib/importer.js";

const PAGE_SIZE = 50;

export default function DataImporter() {
  const fileRef = useRef(null);
  const [rawRows, setRawRows] = useState([]);        // dữ liệu xem trước (đã map)
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Tuỳ chọn
  const [overwrite, setOverwrite] = useState(false);         // Ghi đè toàn bộ
  const [upsert11, setUpsert11] = useState(true);            // Upsert theo 11 số đầu (nếu có dùng merge cục bộ)
  const [autoAssignStaff, setAutoAssignStaff] = useState(true); // Tự gán nhân viên theo MST nếu trống

  // Đọc file XLSX
  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });

      const mapped = rows
        .map(r => mapRow(r, { autoAssignStaff }))
        .filter(r => r.so_tk && r.date);

      setRawRows(mapped);
      setPage(1);
    };
    reader.readAsArrayBuffer(f);
  }

  // Tìm nhanh
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return rawRows;
    return rawRows.filter(r =>
      r.so_tk.toLowerCase().includes(q) ||
      (r.mst || "").toLowerCase().includes(q) ||
      (r.cong_ty || "").toLowerCase().includes(q)
    );
  }, [rawRows, query]);

  // Phân trang
  const total = filtered.length;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function onChangeCell(idx, field, value) {
    const pos = (page - 1) * PAGE_SIZE + idx;
    setRawRows(prev => {
      const cp = prev.slice();
      cp[pos] = { ...cp[pos], [field]: value };
      return cp;
    });
  }

  function handleImport() {
    if (rawRows.length === 0) {
      alert("Không có dữ liệu để import");
      return;
    }
    // Nếu cần upsert theo 11 số đầu → chuẩn hoá so_tk về 11 số đầu
    const rows = upsert11
      ? rawRows.map(r => ({ ...r, so_tk: (r.so_tk || "").toString().slice(0, 11) }))
      : rawRows;

    const count = saveDeclRows(rows, { overwrite });
    pushImportLog(`Import XLSX: ${rawRows.length} dòng → sau hợp nhất còn ${count}`);
    alert("Import xong!");
  }

  function handleSaveAll() {
    if (rawRows.length === 0) return;
    const count = saveDeclRows(rawRows, { overwrite: true });
    alert(`Đã lưu ${count} bản ghi (ghi đè).`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input type="file" ref={fileRef} onChange={handleFileChange} accept=".xls,.xlsx" />
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={autoAssignStaff} onChange={e => setAutoAssignStaff(e.target.checked)} />
          <span>Tự gán nhân viên theo MST nếu trống (ON)</span>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={upsert11} onChange={e => setUpsert11(e.target.checked)} />
          <span>Upsert theo 11 số đầu của Số tờ khai</span>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
          <span>Ghi đè toàn bộ dữ liệu hiện có</span>
        </label>
        <button onClick={handleImport} className="px-3 py-1 rounded bg-black text-white">Import XLSX</button>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="border rounded px-2 py-1 w-72"
          placeholder="Tìm nhanh (Số TK / MST / Công ty)"
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
        />
        <div className="opacity-70 text-sm">
          {total} dòng — Trang {page}/{maxPage}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded">« Trước</button>
          <button onClick={() => setPage(p => Math.min(maxPage, p + 1))} className="px-2 py-1 border rounded">Sau »</button>
          <button onClick={handleSaveAll} className="px-3 py-1 rounded border">Lưu (ghi đè)</button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1 text-left">Ngày</th>
              <th className="px-2 py-1 text-left">Số tờ khai</th>
              <th className="px-2 py-1 text-left">Nhánh</th>
              <th className="px-2 py-1 text-left">MST</th>
              <th className="px-2 py-1 text-left">Công ty</th>
              <th className="px-2 py-1 text-left">Loại hình</th>
              <th className="px-2 py-1 text-left">Mục hàng</th>
              <th className="px-2 py-1 text-left">Nhân viên</th>
              <th className="px-2 py-1 text-left">Tổ đội</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                <td className="px-2 py-1">{r.date}</td>
                <td className="px-2 py-1">{r.so_tk}</td>
                <td className="px-2 py-1">{r.nhanh}</td>
                <td className="px-2 py-1">{r.mst}</td>
                <td className="px-2 py-1">{r.cong_ty}</td>
                <td className="px-2 py-1">{r.loai_hinh}</td>
                <td className="px-2 py-1">{r.muc_hang}</td>
                <td className="px-2 py-1">
                  <input
                    className="border rounded px-1 py-0.5 w-32"
                    value={r.nhan_vien || ""}
                    onChange={e => onChangeCell(i, "nhan_vien", e.target.value)}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className="border rounded px-1 py-0.5 w-24"
                    value={r.team || ""}
                    onChange={e => onChangeCell(i, "team", e.target.value)}
                  />
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td className="px-2 py-4 text-center text-gray-500" colSpan={9}>Không có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
