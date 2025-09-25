import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getHQAgencies,
  upsertHQAgencies,
  normalizeMST,
  normalizeStr,
} from "@/lib/store.js";

const PAGE_SIZE = 50;

const headerAliases = {
  mst: ["mst", "mã số thuế", "ma so thue", "mst (vat)"],
  company: ["công ty", "cong ty", "company", "doanh nghiệp", "ten doanh nghiep"],
  agency: ["đại lý", "dai ly", "đại lý hq", "dai ly hq", "agency"],
};

function normaliseHeader(value = "") {
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function pickCell(row, key) {
  const wanted = headerAliases[key] || [key];
  const keys = Object.keys(row || {});
  for (const w of wanted) {
    const hit = keys.find(k => normaliseHeader(k) === normaliseHeader(w));
    if (hit) return row[hit];
  }
  return "";
}

function mergeRows(current, incoming) {
  const byMst = new Map();
  for (const row of current) {
    if (!row?.mst) continue;
    byMst.set(row.mst, { ...row });
  }
  for (const row of incoming) {
    if (!row?.mst) continue;
    const prev = byMst.get(row.mst) || {};
    byMst.set(row.mst, {
      mst: row.mst,
      company: row.company || prev.company || "",
      agent: row.agent || prev.agent || "",
    });
  }
  return Array.from(byMst.values()).sort((a, b) => {
    const cmpCompany = (a.company || "").localeCompare(b.company || "", "vi", { sensitivity: "base" });
    if (cmpCompany !== 0) return cmpCompany;
    return (a.mst || "").localeCompare(b.mst || "");
  });
}

export default function HQAgencyManager({ canEdit = true, currentUser = null }) {
  const [rows, setRows] = useState(() => getHQAgencies());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [selectedFile, setSelectedFile] = useState("");
  const fileRef = useRef(null);

  const actor = currentUser?.username || "guest";
  const isReadOnly = !canEdit;

  useEffect(() => {
    setRows(getHQAgencies());
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeStr(search).toLowerCase();
    if (!q) return rows;
    return rows.filter(row => {
      const mst = (row.mst || "").toLowerCase();
      const company = (row.company || "").toLowerCase();
      const agent = (row.agent || "").toLowerCase();
      return mst.includes(q) || company.includes(q) || agent.includes(q);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [safePage, page]);

  const handleChangeField = useCallback((index, field, value) => {
    setRows(prev => {
      const next = prev.slice();
      const target = { ...next[index], [field]: field === "mst" ? normalizeMST(value) : normalizeStr(value) };
      next[index] = target;
      return next;
    });
    setDirty(true);
  }, []);

  const handleAddRow = useCallback(() => {
    setRows(prev => [{ mst: "", company: "", agent: "" }, ...prev]);
    setDirty(true);
    setPage(1);
  }, []);

  const handleDelete = useCallback((index) => {
    setRows(prev => {
      const next = prev.slice();
      next.splice(index, 1);
      return next;
    });
    setDirty(true);
  }, []);

  const handleReload = useCallback(() => {
    if (dirty && !window.confirm("Bạn có thay đổi chưa lưu. Bạn có chắc muốn bỏ qua và tải lại dữ liệu?")) {
      return;
    }
    setRows(getHQAgencies());
    setDirty(false);
    setSelectedFile("");
    if (fileRef.current) fileRef.current.value = "";
  }, [dirty]);

  const handleImport = useCallback(async () => {
    if (isReadOnly) {
      alert("Bạn không có quyền import dữ liệu Đại lý HQ.");
      return;
    }
    const file = fileRef.current?.files?.[0];
    if (!file) {
      alert("Chưa chọn file .xlsx");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
      const mapped = json
        .map(row => {
          const mst = normalizeMST(pickCell(row, "mst"));
          if (!mst) return null;
          return {
            mst,
            company: normalizeStr(pickCell(row, "company")),
            agent: normalizeStr(pickCell(row, "agency")),
          };
        })
        .filter(Boolean);
      if (!mapped.length) {
        alert("Không tìm thấy dữ liệu hợp lệ trong file.");
        return;
      }
      setRows(prev => mergeRows(prev, mapped));
      setDirty(true);
      setPage(1);
      alert(`Đã đọc ${mapped.length} dòng từ file. Bấm Lưu để ghi vào hệ thống.`);
    } catch (err) {
      console.error("Không thể đọc file Đại lý HQ", err);
      alert("Không thể đọc file Excel — vui lòng kiểm tra lại định dạng.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setSelectedFile("");
    }
  }, [isReadOnly]);

  const handleFilePick = useCallback((event) => {
    const file = event.target.files?.[0];
    setSelectedFile(file ? file.name : "");
  }, []);

  const handleSave = useCallback(() => {
    if (isReadOnly) {
      alert("Bạn không có quyền lưu cấu hình Đại lý HQ.");
      return;
    }
    const sanitized = rows.filter(row => row.mst);
    upsertHQAgencies(sanitized, {
      actor,
      detail: "Cập nhật danh sách Đại lý HQ từ giao diện",
    });
    setRows(getHQAgencies());
    setDirty(false);
    setSelectedFile("");
    alert("Đã lưu cấu hình Đại lý HQ.");
  }, [actor, isReadOnly, rows]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Danh sách Đại lý Hải quan hợp tác</h2>
          <p className="text-sm text-gray-500">Gán tên Đại lý theo từng MST để tự động chú thích khi import tờ khai.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {dirty && <span className="text-amber-600">Có thay đổi chưa lưu</span>}
          <button
            type="button"
            onClick={handleReload}
            className="rounded border px-3 py-1"
          >
            Tải lại
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-amber-500 px-3 py-1 text-white hover:bg-amber-600"
              disabled={!rows.length}
            >
              Lưu cấu hình
            </button>
          )}
        </div>
      </header>

      {isReadOnly && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị để thêm hoặc chỉnh sửa danh sách Đại lý HQ.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          className="hidden"
          data-testid="hq-file-input"
          ref={fileRef}
          accept=".xls,.xlsx"
          onChange={handleFilePick}
          disabled={isReadOnly}
        />
        {canEdit && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded border px-3 py-1.5"
          >
            Chọn file Excel
          </button>
        )}
        {selectedFile && <span className="text-sm text-gray-600">Đã chọn: {selectedFile}</span>}
        {canEdit && (
          <button
            type="button"
            onClick={handleImport}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
            disabled={isReadOnly}
          >
            Import Excel
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={handleAddRow}
            className="rounded border px-3 py-1.5"
          >
            Thêm dòng mới
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <input
            className="w-64 rounded border px-2 py-1"
            placeholder="Tìm theo MST, Công ty hoặc Đại lý"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <span className="text-sm text-gray-500">{filtered.length} dòng • Trang {safePage}/{totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="rounded border px-2 py-1"
          >
            « Trước
          </button>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="rounded border px-2 py-1"
          >
            Sau »
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-16 px-2 py-1 text-left">STT</th>
              <th className="px-2 py-1 text-left">Mã số thuế</th>
              <th className="px-2 py-1 text-left">Công ty</th>
              <th className="px-2 py-1 text-left">Đại lý HQ</th>
              {canEdit && <th className="w-16 px-2 py-1 text-left">Xóa</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => {
              const rowIndex = rows.indexOf(row);
              const globalIndex = (safePage - 1) * PAGE_SIZE + idx + 1;
              return (
                <tr key={`${row.mst}_${idx}`} className="odd:bg-white even:bg-gray-50">
                  <td className="px-2 py-1">{globalIndex}</td>
                  <td className="px-2 py-1">
                    {isReadOnly ? (
                      <span>{row.mst}</span>
                    ) : (
                      <input
                        className="w-40 rounded border px-2 py-1"
                        value={row.mst}
                        onChange={e => handleChangeField(rowIndex, "mst", e.target.value)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {isReadOnly ? (
                      <span>{row.company}</span>
                    ) : (
                      <input
                        className="w-64 rounded border px-2 py-1"
                        value={row.company}
                        onChange={e => handleChangeField(rowIndex, "company", e.target.value)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {isReadOnly ? (
                      <span>{row.agent}</span>
                    ) : (
                      <input
                        className="w-56 rounded border px-2 py-1"
                        value={row.agent}
                        onChange={e => handleChangeField(rowIndex, "agent", e.target.value)}
                      />
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(rowIndex)}
                        className="rounded bg-red-500 px-2 py-0.5 text-xs text-white"
                      >
                        Xóa
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td className="px-2 py-6 text-center text-gray-500" colSpan={canEdit ? 5 : 4}>
                  Không có dữ liệu phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        • Cột "Đại lý HQ" sẽ xuất hiện trong mục Import Data để mọi tờ khai thuộc MST tương ứng được gắn nhãn tự động.<br />
        • Có thể import danh sách từ file Excel gồm các cột MST, Công ty, Đại lý HQ hoặc nhập thủ công từng dòng.
      </p>
    </section>
  );
}
