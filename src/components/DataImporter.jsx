// src/components/DataImporter.jsx
import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  saveDeclRows, pushImportLog,
  normalizeStr, normalizeMST, toISODate,
  getMSTFor, isExportDecl,
} from "@/lib/store.js";

const PAGE_SIZE = 50;

const NAME_MAP = {
  so_tk: ["Số TK","Số tờ khai","So TK","So to khai","Số tờ khai TM","Số tờ khai TM "],
  nhanh: ["Nhánh","Nhanh","branch"],
  date: ["date","ngày","Ngay","Ngày"],
  ma_hq: ["Mã HQ","Ma HQ","Mã hq","ma_hq"],
  loai_hinh: ["Loại hình","Loai hinh","Loai hình","loai_hinh"],
  so_hoa_don: ["Số hóa đơn TM","So hoa don TM","Số hoá đơn TM"],
  van_don: ["Vận đơn","Van don","Vận đơn "],
  phuong_thuc_vc: ["Phương thức vận chuyển","Phuong thuc van chuyen"],
  so_luong_kien: ["Số lượng kiện","So luong kien"],
  gross: ["Tổng trọng lượng hàng (Gross)","Tong trong luong hang (Gross)"],
  so_luong: ["Số lượng","So luong"],
  phan_luong: ["Phân luồng","Phan luong"],
  muc_hang: ["Mục hàng","Muc hang","num_items"],
  mst: ["MST","mst"],
  cong_ty: ["Công ty","Cong ty","customer"],
};

function pick(row, keys) {
  for (const k of keys) {
    if (row.hasOwnProperty(k)) return row[k];
  }
  return "";
}

function mapRow(row, opts) {
  const so_tk = normalizeStr(pick(row, NAME_MAP.so_tk));
  const nhanh = normalizeStr(pick(row, NAME_MAP.nhanh));
  const dateISO = toISODate(pick(row, NAME_MAP.date));
  const ma_hq = normalizeStr(pick(row, NAME_MAP.ma_hq));
  const loai_hinh = normalizeStr(pick(row, NAME_MAP.loai_hinh));
  const so_hoa_don = normalizeStr(pick(row, NAME_MAP.so_hoa_don));
  const van_don = normalizeStr(pick(row, NAME_MAP.van_don));
  const phuong_thuc_vc = normalizeStr(pick(row, NAME_MAP.phuong_thuc_vc));
  const so_luong_kien = Number(pick(row, NAME_MAP.so_luong_kien)) || 0;
  const gross = Number(String(pick(row, NAME_MAP.gross)).replaceAll(",", "")) || 0;
  const so_luong = Number(pick(row, NAME_MAP.so_luong)) || 0;
  const phan_luong = normalizeStr(pick(row, NAME_MAP.phan_luong));
  const muc_hang = Number(pick(row, NAME_MAP.muc_hang)) || 0;
  const mst = normalizeMST(pick(row, NAME_MAP.mst));
  const cong_ty = normalizeStr(pick(row, NAME_MAP.cong_ty));

  // Tra xem là xuất hay nhập để lấy đúng người phụ trách
  let nhan_vien = normalizeStr(row["nhan_vien"] || row["Nhân viên"] || "");
  let team = normalizeStr(row["team"] || row["Tổ đội"] || "");

  if (opts.autoAssignStaff) {
    const isExport = isExportDecl(so_tk, loai_hinh);
    const m = getMSTFor(mst, dateISO) || {};
    if (!nhan_vien) nhan_vien = isExport ? (m.person_export || "") : (m.person_import || "");
    if (!team) team = m.team || "";
  }

  return {
    date: dateISO,
    so_tk,
    soToKhai: so_tk,          // alias để chỗ khác dùng
    nhanh,
    ma_hq,
    loai_hinh, loaiHinh: loai_hinh,
    so_hoa_don, van_don, phuong_thuc_vc,
    so_luong_kien, gross, so_luong,
    phan_luong, muc_hang,
    mst, cong_ty,
    nhan_vien, team,
  };
}

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
