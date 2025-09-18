import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { getMSTMap, upsertMSTRows } from "@/lib/store.js";

/** Utils */
const normalize = (s = "") =>
  s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const toISO = (v) => {
  if (!v) return "";
  // v có thể dạng Date, serial excel, "dd/mm/yyyy", "yyyy-mm-dd"
  if (v instanceof Date && !isNaN(v)) {
    const y = v.getFullYear();
    const m = `${v.getMonth() + 1}`.padStart(2, "0");
    const d = `${v.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    // serial Excel
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return "";
    const y = d.y;
    const m = `${d.m}`.padStart(2, "0");
    const day = `${d.d}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = v.toString().trim();
  // dd/mm/yyyy
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m1) {
    const d = m1[1].padStart(2, "0");
    const m = m1[2].padStart(2, "0");
    const y = m1[3];
    return `${y}-${m}-${d}`;
  }
  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m2) {
    const y = m2[1];
    const m = m2[2].padStart(2, "0");
    const d = m2[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
};

const headerAliases = {
  mst: ["mst", "mã số thuế", "ma so thue", "mã số thuế (mst)"],
  company: ["company", "công ty", "ten cong ty", "doanh nghiep"],
  person_import: [
    "person_import",
    "người phụ trách nhập",
    "nguoi phu trach nhap",
    "nhap",
  ],
  person_export: [
    "person_export",
    "người phụ trách xuất",
    "nguoi phu trach xuat",
    "xuat",
  ],
  team: ["team", "tổ đội", "to doi", "nhom", "group"],
  effective_from: [
    "effective_from",
    "áp dụng từ ngày",
    "ap dung tu ngay",
    "apply_from",
    "effective from",
  ],
};

const findCell = (row, key) => {
  const wanted = headerAliases[key] || [key];
  const keys = Object.keys(row);
  for (const w of wanted) {
    const hit = keys.find((k) => normalize(k) === normalize(w));
    if (hit) return row[hit];
  }
  return "";
};

const tidyMST = (v) => {
  if (v == null) return "";
  // lấy chuỗi hiển thị (để giữ 0 ở đầu nếu có)
  let s = String(v).trim();
  // loại mọi ký tự không phải số
  s = s.replace(/[^\d]/g, "");
  return s;
};

const pageSize = 50;

export default function MSTAssignment({ canEdit = true, currentUser = null }) {
  const [rows, setRows] = useState([]); // toàn bộ
  const [search, setSearch] = useState("");
  const [applyFrom, setApplyFrom] = useState(""); // yyyy-mm-dd
  const [page, setPage] = useState(1);
  const fileRef = useRef();
  const [selectedFileName, setSelectedFileName] = useState("");

  const actor = currentUser?.username || "guest";
  const isReadOnly = !canEdit;

  /** Load lần đầu */
  useEffect(() => {
    try {
      const cur = getMSTMap() || [];
      setRows(cur);
    } catch (e) {
      console.error("getMSTMap error:", e);
    }
  }, []);

  /** Filter + phân trang */
  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = normalize(search);
    return rows.filter(
      (r) =>
        normalize(r.mst).includes(q) || normalize(r.company).includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  /** Excel import */
  const onImportXLSX = async () => {
    if (isReadOnly) {
      alert("Bạn không có quyền import bảng MST. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục.");
      return;
    }
    const f = fileRef.current?.files?.[0];
    if (!f) {
      alert("Chưa chọn file .xlsx/.xls");
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // lấy text đã format để hạn chế mất 0 đầu
      const json = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      });

      const mapped = json
        .map((r) => {
          const mst = tidyMST(findCell(r, "mst"));
          if (!mst) return null;

          return {
            mst,
            company: String(findCell(r, "company") ?? "").trim(),
            person_import: String(findCell(r, "person_import") ?? "").trim(),
            person_export: String(findCell(r, "person_export") ?? "").trim(),
            team: String(findCell(r, "team") ?? "").trim(),
            effective_from:
              toISO(findCell(r, "effective_from")) || applyFrom || "",
          };
        })
        .filter(Boolean);

      if (!mapped.length) {
        alert("Không thấy dữ liệu hợp lệ trong file.");
        return;
      }

      // Gộp với dữ liệu hiện có theo mst (ưu tiên dòng sau – dữ liệu mới)
      const byMST = new Map();
      for (const r of rows) byMST.set(r.mst, { ...r });
      for (const r of mapped) byMST.set(r.mst, { ...byMST.get(r.mst), ...r });

      const merged = Array.from(byMST.values()).sort((a, b) =>
        a.mst.localeCompare(b.mst)
      );
      setRows(merged);
      setPage(1);
      alert(`Đọc file thành công: ${mapped.length} dòng. Bấm Lưu để ghi.`);
    } catch (e) {
      console.error(e);
      alert("Không thể đọc file .xlsx — kiểm tra lại định dạng.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setSelectedFileName("");
    }
  };

  /** Lưu */
  const onSave = () => {
    if (isReadOnly) {
      alert("Bạn không có quyền lưu bảng MST.");
      return;
    }
    try {
      upsertMSTRows(rows, {
        actor,
        detail: "Cập nhật gán MST từ giao diện",
      });
      alert("Lưu thành công!");
    } catch (e) {
      console.error(e);
      alert("Lưu thất bại!");
    }
  };

  /** Thao tác inline */
  const updateRow = (mst, patch) => {
    if (isReadOnly) return;
    setRows((prev) =>
      prev.map((r) => (r.mst === mst ? { ...r, ...patch } : r))
    );
  };

  const removeRow = (mst) => {
    if (isReadOnly) return;
    if (!confirm(`Xóa MST ${mst}?`)) return;
    setRows((prev) => prev.filter((r) => r.mst !== mst));
  };

  /** UI */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {isReadOnly && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Bạn đang xem bảng gán MST ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị hoặc được cấp quyền để import, chỉnh sửa và lưu thay đổi.
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={isReadOnly}
              onChange={(e) => {
                const name = e.target.files?.[0]?.name || "";
                setSelectedFileName(name);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
            >
              Chọn file XLSX
            </button>
            <button
              onClick={onImportXLSX}
              className="px-3 py-1 rounded bg-black text-white"
              type="button"
            >
              Import XLSX
            </button>
            {selectedFileName && (
              <span className="text-sm text-gray-600">Đã chọn: {selectedFileName}</span>
            )}
          </>
        )}

        {canEdit && (
          <input
            type="date"
            value={applyFrom}
            onChange={(e) => setApplyFrom(e.target.value)}
            className="border rounded px-2 py-1 ml-4"
            placeholder="Áp dụng từ ngày"
            title="Áp dụng từ ngày (ghi vào trường trống khi import)"
          />
        )}

        <span className="text-xs text-gray-500 ml-auto">
          * Khi lưu, quy tắc mới chỉ áp dụng cho tờ khai có ngày khai báo từ ngày này trở đi.
        </span>

        <div className="flex-1" />

        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm nhanh (MST / Công ty)"
          className="border rounded px-2 py-1 w-64"
        />
        {canEdit && (
          <button onClick={onSave} className="px-3 py-1 rounded bg-emerald-600 text-white">
            Lưu
          </button>
        )}
      </div>

      <div className="text-sm text-gray-500 mb-2">
        {filtered.length} dòng — Trang {page}/{totalPages}
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left w-36">MST</th>
              <th className="p-2 text-left">Công ty</th>
              <th className="p-2 text-left w-40">Người phụ trách Nhập</th>
              <th className="p-2 text-left w-40">Người phụ trách Xuất</th>
              <th className="p-2 text-left w-28">Tổ đội</th>
              <th className="p-2 text-left w-40">Áp dụng từ ngày</th>
              <th className="p-2 w-16">Xóa</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={7}>
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.mst} className="border-t">
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.mst}</span>
                    ) : (
                      <input
                        value={r.mst}
                        onChange={(e) =>
                          updateRow(r.mst, { mst: tidyMST(e.target.value) })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.company || ""}</span>
                    ) : (
                      <input
                        value={r.company || ""}
                        onChange={(e) =>
                          updateRow(r.mst, { company: e.target.value })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.person_import || ""}</span>
                    ) : (
                      <input
                        value={r.person_import || ""}
                        onChange={(e) =>
                          updateRow(r.mst, { person_import: e.target.value })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.person_export || ""}</span>
                    ) : (
                      <input
                        value={r.person_export || ""}
                        onChange={(e) =>
                          updateRow(r.mst, { person_export: e.target.value })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.team || ""}</span>
                    ) : (
                      <input
                        value={r.team || ""}
                        onChange={(e) => updateRow(r.mst, { team: e.target.value })}
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.effective_from || ""}</span>
                    ) : (
                      <input
                        type="date"
                        value={r.effective_from || ""}
                        onChange={(e) =>
                          updateRow(r.mst, { effective_from: e.target.value })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {canEdit ? (
                      <button
                        onClick={() => removeRow(r.mst)}
                        className="px-2 py-1 rounded bg-red-500 text-white"
                        title="Xóa dòng"
                      >
                        Xóa
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <div />
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={`px-3 py-1 rounded border ${
              page <= 1 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            ← Trước
          </button>
          <span className="text-sm">
            Trang {page}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`px-3 py-1 rounded border ${
              page >= totalPages ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Sau →
          </button>
        </div>
        <div />
      </div>
    </div>
  );
}
