// src/components/DataImporter.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { getDeclRows, saveDeclRows, sortDeclRows, pushImportLog } from "@/lib/store.js";
import { mapRow } from "@/lib/importer.js";
import { loadRules } from "@/lib/rules.js";

const PAGE_SIZE = 20;

function coerceLicenseValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const str = String(value).trim();
  if (str === "") return "";
  const num = Number(str);
  if (!Number.isFinite(num)) return "";
  return Math.max(0, Math.round(num));
}

function ensureLicenseFields(row) {
  if (!row || typeof row !== "object") return row;
  const source = row.licenses ?? row.so_luong_gp;
  if (source === undefined) return row;
  const normalized = coerceLicenseValue(source);
  if (row.licenses === normalized && row.so_luong_gp === normalized) return row;
  return { ...row, licenses: normalized, so_luong_gp: normalized };
}

export default function DataImporter({ canEdit = true, currentUser = null }) {
  const fileRef = useRef(null);
  const [rawRows, setRawRows] = useState([]);        // dữ liệu xem trước (đã map)
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("saved");         // saved | preview
  const [selectedFile, setSelectedFile] = useState("");

  // Tuỳ chọn
  const [overwrite, setOverwrite] = useState(false);         // Ghi đè toàn bộ
  const [upsert11, setUpsert11] = useState(true);            // Upsert theo 11 số đầu (nếu có dùng merge cục bộ)
  const [autoAssignStaff, setAutoAssignStaff] = useState(true); // Tự gán nhân viên theo MST nếu trống

  const actor = currentUser?.username || "guest";
  const isReadOnly = !canEdit;

  const loadSavedRows = useCallback(() => {
    const saved = sortDeclRows(getDeclRows()).map(ensureLicenseFields);
    setRawRows(saved);
    setMode("saved");
    setPage(1);
    setQuery("");
    setSelectedFile("");
    if (fileRef.current) fileRef.current.value = "";
  }, [fileRef]);

  useEffect(() => {
    loadSavedRows();
  }, [loadSavedRows]);

  // Đọc file XLSX
  function handleFileChange(e) {
    if (isReadOnly) {
      alert("Bạn đang ở chế độ chỉ xem — hãy đăng nhập để import dữ liệu.");
      return;
    }
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
      const rules = loadRules();
      const excludeCodes = Array.isArray(rules?.license?.excludeCodes)
        ? rules.license.excludeCodes
        : [];

      const mapped = rows
        .map(r => mapRow(r, { autoAssignStaff, rules, licenseExcludes: excludeCodes }))
        .map(ensureLicenseFields)
        .filter(r => r.so_tk && r.date);

      setRawRows(sortDeclRows(mapped));
      setPage(1);
      setMode("preview");
      setSelectedFile(f.name || "");
      setQuery("");
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
    if (isReadOnly) return;
    const pos = (page - 1) * PAGE_SIZE + idx;
    setRawRows(prev => {
      const cp = prev.slice();
      cp[pos] = { ...cp[pos], [field]: value };
      return cp;
    });
  }

  function handleImport() {
    if (isReadOnly) {
      alert("Bạn không có quyền import dữ liệu. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục.");
      return;
    }
    if (mode !== "preview") {
      alert("Hãy chọn file XLSX để import.");
      return;
    }
    if (rawRows.length === 0) {
      alert("Không có dữ liệu để import");
      return;
    }
    // Nếu cần upsert theo 11 số đầu → chuẩn hoá so_tk về 11 số đầu
    const rows = upsert11
      ? rawRows.map(r => ({ ...r, so_tk: (r.so_tk || "").toString().slice(0, 11) }))
      : rawRows;

    const count = saveDeclRows(rows, {
      overwrite,
      actor,
      detail: `Import từ ${selectedFile || "file XLSX"}`,
    });
    pushImportLog(`Import XLSX: ${rawRows.length} dòng → sau hợp nhất còn ${count}`);
    alert("Import xong!");
    if (fileRef.current) fileRef.current.value = "";
    loadSavedRows();
  }

  function handleSaveAll() {
    if (isReadOnly) {
      alert("Bạn không có quyền lưu chỉnh sửa.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ có thể lưu chỉnh sửa khi đang xem dữ liệu đã lưu. Hãy import file hoặc quay lại chế độ dữ liệu đã lưu.");
      return;
    }
    if (rawRows.length === 0) {
      alert("Không có dữ liệu để lưu");
      return;
    }
    const count = saveDeclRows(rawRows, {
      overwrite: true,
      actor,
      detail: "Lưu chỉnh sửa tờ khai thủ công",
    });
    alert(`Đã lưu ${count} bản ghi (ghi đè).`);
    loadSavedRows();
  }

  const canImport = !isReadOnly && mode === "preview" && rawRows.length > 0;
  const canSave = !isReadOnly && mode === "saved" && rawRows.length > 0;
  const modeLabel = mode === "preview" ? "Đang xem dữ liệu từ file (chưa lưu)" : "Đang xem dữ liệu đã lưu";

  return (
    <div className="space-y-3">
      {isReadOnly && (
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-700 p-3 text-sm">
          Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản được cấp quyền để import, chỉnh sửa và lưu dữ liệu tờ khai.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          ref={fileRef}
          onChange={handleFileChange}
          accept=".xls,.xlsx"
          className="hidden"
          disabled={isReadOnly}
        />
        {canEdit && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded border bg-white shadow-sm hover:bg-gray-50"
          >
            Chọn file XLSX
          </button>
        )}
        {selectedFile && (
          <span className="text-sm text-gray-600">Đã chọn: {selectedFile}</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className={`px-3 py-1.5 rounded ${canImport ? "bg-black text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
          >
            Import XLSX
          </button>
        )}
        <button
          type="button"
          onClick={loadSavedRows}
          className="px-3 py-1.5 rounded border"
        >
          Hiển thị dữ liệu đã lưu
        </button>
        <span className="ml-auto text-sm text-gray-600">{modeLabel}</span>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      )}

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
          {canEdit && (
            <button
              onClick={handleSaveAll}
              disabled={!canSave}
              className={`px-3 py-1 rounded border ${canSave ? "" : "opacity-50 cursor-not-allowed"}`}
            >
              Lưu chỉnh sửa
            </button>
          )}
        </div>
      </div>

      {!query && mode === "saved" && (
        <div className="text-xs text-gray-500">Hiển thị tối đa 20 dòng mới nhất. Nhập từ khóa để tìm các tờ khai khác.</div>
      )}

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1 text-left">Ngày</th>
              <th className="px-2 py-1 text-left">Số tờ khai</th>
              <th className="px-2 py-1 text-left">MST</th>
              <th className="px-2 py-1 text-left">Công ty</th>
              <th className="px-2 py-1 text-left">Loại hình</th>
              <th className="px-2 py-1 text-left">Mục hàng</th>
              <th className="px-2 py-1 text-left">Nhân viên</th>
              <th className="px-2 py-1 text-left">Tổ đội</th>
              <th className="px-2 py-1 text-left">Số lượng GP</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                <td className="px-2 py-1">{r.date}</td>
                <td className="px-2 py-1">{r.so_tk}</td>
                <td className="px-2 py-1">{r.mst}</td>
                <td className="px-2 py-1">{r.cong_ty}</td>
                <td className="px-2 py-1">{r.loai_hinh}</td>
                <td className="px-2 py-1">{r.muc_hang}</td>
                <td className="px-2 py-1">
                  {isReadOnly ? (
                    <span>{r.nhan_vien || ""}</span>
                  ) : (
                    <input
                      className="border rounded px-1 py-0.5 w-32"
                      value={r.nhan_vien || ""}
                      onChange={e => onChangeCell(i, "nhan_vien", e.target.value)}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {isReadOnly ? (
                    <span>{r.team || ""}</span>
                  ) : (
                    <input
                      className="border rounded px-1 py-0.5 w-24"
                      value={r.team || ""}
                      onChange={e => onChangeCell(i, "team", e.target.value)}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {isReadOnly ? (
                    <span>{r.licenses ?? r.so_luong_gp ?? ""}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="border rounded px-1 py-0.5 w-24"
                      value={r.licenses ?? r.so_luong_gp ?? ""}
                      onChange={e => {
                        const input = e.target.value;
                        setRawRows(prev => {
                          const pos = (page - 1) * PAGE_SIZE + i;
                          if (!prev[pos]) return prev;
                          const next = prev.slice();
                          if (input !== "") {
                            const parsed = Number(input);
                            if (!Number.isFinite(parsed)) {
                              return prev;
                            }
                            const normalized = Math.max(0, Math.round(parsed));
                            next[pos] = {
                              ...next[pos],
                              licenses: normalized,
                              so_luong_gp: normalized,
                            };
                            return next;
                          }
                          next[pos] = {
                            ...next[pos],
                            licenses: "",
                            so_luong_gp: "",
                          };
                          return next;
                        });
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td className="px-2 py-4 text-center text-gray-500" colSpan={9}>Không có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        * Số lượng GP được tự động đếm theo các loại giấy phép hợp lệ (đã loại trừ theo mục Quy tắc KPI).
        Bạn có thể điều chỉnh thủ công trước khi lưu để phản ánh thực tế kiểm tra.
      </p>
    </div>
  );
}
