// src/components/DataImporter.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getDeclRows,
  saveDeclRows,
  sortDeclRows,
  pushImportLog,
  getTeamRoster,
  mapMemberNamesToTeams,
} from "@/lib/store.js";
import { mapRow, detectDateOrder } from "@/lib/importer.js";
import { loadRules, computeKPI } from "@/lib/rules.js";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filterNoStaff, setFilterNoStaff] = useState(false);
  const [filterNoTeam, setFilterNoTeam] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [rules, setRules] = useState(() => loadRules());

  // Tuỳ chọn
  const [overwrite, setOverwrite] = useState(false);         // Ghi đè toàn bộ
  const [upsert11, setUpsert11] = useState(true);            // Upsert theo 11 số đầu (nếu có dùng merge cục bộ)
  const [autoAssignStaff, setAutoAssignStaff] = useState(true); // Tự gán nhân viên theo MST nếu trống

  const actor = currentUser?.username || "guest";
  const isReadOnly = !canEdit;

  const loadSavedRows = useCallback(() => {
    const activeRules = loadRules();
    setRules(activeRules);
    const saved = sortDeclRows(getDeclRows()).map(ensureLicenseFields);
    setRawRows(saved);
    setMode("saved");
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setQuery("");
    setSelectedFile("");
    setFilterNoStaff(false);
    setFilterNoTeam(false);
    setSelectedKeys([]);
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
      const loadedRules = loadRules();
      setRules(loadedRules);
      const excludeCodes = Array.isArray(loadedRules?.license?.excludeCodes)
        ? loadedRules.license.excludeCodes
        : [];
      const dateOrder = detectDateOrder(rows);
      const preferMonthFirst = dateOrder === "mdy";
      const roster = getTeamRoster();
      const memberMap = mapMemberNamesToTeams(roster);

      const mapped = rows
        .map(r =>
          mapRow(r, {
            autoAssignStaff,
            rules: loadedRules,
            licenseExcludes: excludeCodes,
            preferMonthFirst,
            memberMap,
          })
        )
        .map(ensureLicenseFields)
        .filter(r => r.so_tk && r.date);

      setRawRows(sortDeclRows(mapped));
      setPage(1);
      setPageSize(DEFAULT_PAGE_SIZE);
      setMode("preview");
      setSelectedFile(f.name || "");
      setQuery("");
      setFilterNoStaff(false);
      setFilterNoTeam(false);
      setSelectedKeys([]);
    };
    reader.readAsArrayBuffer(f);
  }

  // Tìm nhanh
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const hasText = q.length > 0;
    return rawRows.filter(r => {
      const soTk = (r.so_tk || "").toString().toLowerCase();
      const mst = (r.mst || "").toString().toLowerCase();
      const company = (r.cong_ty || "").toString().toLowerCase();
      if (hasText && !(
        soTk.includes(q) ||
        mst.includes(q) ||
        company.includes(q)
      )) {
        return false;
      }
      if (filterNoStaff) {
        const hasStaff = Boolean((r.nhan_vien || "").toString().trim());
        if (hasStaff) return false;
      }
      if (filterNoTeam) {
        const hasTeam = Boolean((r.team || "").toString().trim());
        if (hasTeam) return false;
      }
      return true;
    });
  }, [rawRows, query, filterNoStaff, filterNoTeam]);

  // Phân trang
  const total = filtered.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, maxPage);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [safePage, page]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, filterNoStaff, filterNoTeam]);

  const keyOfRow = useCallback((row) => {
    const soTk = (row.so_tk || "").toString();
    const nhanh = (row.nhanh || "").toString();
    return `${soTk}_${nhanh}`;
  }, []);

  function onChangeCell(idx, field, value) {
    if (isReadOnly) return;
    const pos = (safePage - 1) * pageSize + idx;
    setRawRows(prev => {
      const cp = prev.slice();
      cp[pos] = { ...cp[pos], [field]: value };
      return cp;
    });
  }

  const handleToggleSelect = useCallback((row) => {
    const key = keyOfRow(row);
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  }, [keyOfRow]);

  const handleClearSelection = useCallback(() => {
    setSelectedKeys([]);
  }, []);

  const deleteRowsByKeys = useCallback((keys) => {
    if (!Array.isArray(keys) || keys.length === 0) return;
    const keySet = new Set(keys);
    const remaining = rawRows.filter(row => !keySet.has(keyOfRow(row)));
    const removedCount = rawRows.length - remaining.length;
    if (removedCount <= 0) return;
    saveDeclRows(remaining, {
      overwrite: true,
      actor,
      detail: `Xóa ${removedCount} tờ khai từ giao diện Import Excel`,
    });
    alert(`Đã xóa ${removedCount} tờ khai.`);
    loadSavedRows();
  }, [actor, keyOfRow, loadSavedRows, rawRows]);

  const handleDeleteSelected = useCallback(() => {
    if (isReadOnly) return;
    if (mode !== "saved") {
      alert("Chỉ có thể xóa khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để xóa.");
      return;
    }
    if (!window.confirm(`Bạn chắc chắn muốn xóa ${selectedKeys.length} tờ khai đã chọn?`)) {
      return;
    }
    deleteRowsByKeys(selectedKeys);
  }, [deleteRowsByKeys, isReadOnly, mode, selectedKeys]);

  const handleDeleteSingle = useCallback((row) => {
    if (isReadOnly) return;
    if (mode !== "saved") {
      alert("Chỉ có thể xóa khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (!window.confirm("Xóa tờ khai này?")) return;
    deleteRowsByKeys([keyOfRow(row)]);
  }, [deleteRowsByKeys, isReadOnly, keyOfRow, mode]);

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
  const canDelete = !isReadOnly && mode === "saved" && selectedKeys.length > 0;
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

      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="border rounded px-2 py-1 w-72"
          placeholder="Tìm nhanh (Số TK / MST / Công ty)"
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
        />
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={filterNoStaff}
            onChange={e => setFilterNoStaff(e.target.checked)}
          />
          <span>Chưa gán Nhân viên</span>
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={filterNoTeam}
            onChange={e => setFilterNoTeam(e.target.checked)}
          />
          <span>Chưa gán Tổ đội</span>
        </label>
        <div className="opacity-70 text-sm">
          {total} dòng — Trang {safePage}/{maxPage}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value) || DEFAULT_PAGE_SIZE)}
            className="border rounded px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}/trang</option>
            ))}
          </select>
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
        <div className="text-xs text-gray-500">
          Hiển thị tối đa {pageSize} dòng trên một trang. Nhập từ khóa hoặc dùng bộ lọc để tìm thêm tờ khai.
        </div>
      )}

      {canEdit && mode === "saved" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Đã chọn {selectedKeys.length} tờ khai</span>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={!canDelete}
            className={`px-3 py-1 rounded border ${
              canDelete ? "bg-red-50 text-red-600 border-red-300" : "opacity-50 cursor-not-allowed"
            }`}
          >
            Xóa các tờ khai đã chọn
          </button>
          {selectedKeys.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3 py-1 rounded border"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      )}

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {canEdit && mode === "saved" && <th className="px-2 py-1 text-left w-10">Chọn</th>}
              <th className="px-2 py-1 text-left">Ngày</th>
              <th className="px-2 py-1 text-left">Số tờ khai</th>
              <th className="px-2 py-1 text-left">MST</th>
              <th className="px-2 py-1 text-left">Công ty</th>
              <th className="px-2 py-1 text-left">Loại hình</th>
              <th className="px-2 py-1 text-left">Mục hàng</th>
              <th className="px-2 py-1 text-left">Nhân viên</th>
              <th className="px-2 py-1 text-left">Tổ đội</th>
              <th className="px-2 py-1 text-left">Số lượng GP</th>
              <th className="px-2 py-1 text-left">KPI</th>
              {canEdit && mode === "saved" && <th className="px-2 py-1 text-left w-16">Xóa</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                {canEdit && mode === "saved" && (
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(keyOfRow(r))}
                      onChange={() => handleToggleSelect(r)}
                    />
                  </td>
                )}
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
                          const pos = (safePage - 1) * pageSize + i;
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
                <td className="px-2 py-1">
                  {(() => {
                    const kpi = computeKPI(r, rules);
                    if (!Number.isFinite(kpi)) return "-";
                    return kpi.toFixed(1);
                  })()}
                </td>
                {canEdit && mode === "saved" && (
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(r)}
                      className="px-2 py-0.5 rounded bg-red-500 text-white text-xs"
                    >
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td
                  className="px-2 py-4 text-center text-gray-500"
                  colSpan={10 + (canEdit && mode === "saved" ? 2 : 0)}
                >
                  Không có dữ liệu
                </td>
              </tr>
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
