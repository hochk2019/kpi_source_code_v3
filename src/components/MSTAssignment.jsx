import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { getMSTHistoryEntries, getMSTMap, upsertMSTRows } from "@/lib/store.js";

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

const HISTORY_FIELD_LABELS = {
  person_import: "Người phụ trách Nhập",
  person_export: "Người phụ trách Xuất",
  effective_from: "Áp dụng từ ngày",
};

const sortMSTRows = (list = []) => {
  return [...list]
    .filter(Boolean)
    .sort((a, b) => {
      const mstA = (a?.mst || "").toString();
      const mstB = (b?.mst || "").toString();
      const byMST = mstA.localeCompare(mstB);
      if (byMST !== 0) return byMST;
      const dateA = a?.effective_from || "";
      const dateB = b?.effective_from || "";
      return dateA.localeCompare(dateB);
    });
};

const makeRowKey = (row) => {
  if (!row) return "";
  return `${row.mst || ""}__${row.effective_from || ""}`;
};

const buildHistoryIndex = (entries = []) => {
  const map = new Map();
  for (const entry of entries) {
    if (!entry || !entry.rowKey || !entry.field) continue;
    if (!map.has(entry.rowKey)) {
      map.set(entry.rowKey, {});
    }
    const fieldBuckets = map.get(entry.rowKey);
    if (!fieldBuckets[entry.field]) {
      fieldBuckets[entry.field] = [];
    }
    fieldBuckets[entry.field].push(entry);
  }
  return map;
};

const formatHistoryTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("vi-VN", { hour12: false });
  } catch (err) {
    console.warn("formatHistoryTime error", err);
    return value;
  }
};

const HistoryDetails = ({ entries = [], label }) => {
  if (!entries.length) return null;
  const renderValue = (value) =>
    value ? (
      <span>{value}</span>
    ) : (
      <span className="italic text-gray-500">(trống)</span>
    );

  return (
    <details className="mt-1 text-xs text-gray-600">
      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
        Lịch sử {label || ""}
      </summary>
      <ul className="mt-1 space-y-2 max-h-40 overflow-auto pr-1">
        {entries.map((entry) => (
          <li key={entry.id} className="border-t pt-1 first:border-t-0 first:pt-0">
            <div className="font-medium text-gray-700">
              {formatHistoryTime(entry.timestamp)} — {entry.actor || "Hệ thống"}
              {entry.type === "create" && (
                <span className="ml-2 text-emerald-600">(Thêm mới)</span>
              )}
              {entry.type === "delete" && (
                <span className="ml-2 text-red-600">(Đã xoá)</span>
              )}
            </div>
            <div className="text-gray-600">
              <span className="text-gray-500">Từ:</span> {renderValue(entry.from)}
            </div>
            <div className="text-gray-600">
              <span className="text-gray-500">Đến:</span> {renderValue(entry.to)}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
};

export default function MSTAssignment({ canEdit = true, currentUser = null }) {
  const [rows, setRows] = useState([]); // toàn bộ
  const [search, setSearch] = useState("");
  const [applyFrom, setApplyFrom] = useState(""); // yyyy-mm-dd
  const [page, setPage] = useState(1);
  const fileRef = useRef();
  const [selectedFileName, setSelectedFileName] = useState("");
  const [historyEntries, setHistoryEntries] = useState(() =>
    getMSTHistoryEntries(500)
  );
  const historyIndex = useMemo(
    () => buildHistoryIndex(historyEntries),
    [historyEntries]
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState({
    mst: "",
    company: "",
    person_import: "",
    person_export: "",
    team: "",
    effective_from: "",
  });
  const [addError, setAddError] = useState("");

  const actor = currentUser?.username || "guest";
  const isReadOnly = !canEdit;

  const refreshHistory = useCallback(() => {
    setHistoryEntries(getMSTHistoryEntries(500));
  }, []);

  /** Load lần đầu */
  useEffect(() => {
    try {
      const cur = getMSTMap() || [];
      setRows(sortMSTRows(cur));
    } catch (e) {
      console.error("getMSTMap error:", e);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const toggleAddForm = () => {
    if (isReadOnly) {
      alert(
        "Bạn không có quyền thêm mới thủ công. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục."
      );
      return;
    }
    if (showAddForm) {
      setShowAddForm(false);
      setAddError("");
      return;
    }
    setDraft({
      mst: "",
      company: "",
      person_import: "",
      person_export: "",
      team: "",
      effective_from: applyFrom || "",
    });
    setAddError("");
    setShowAddForm(true);
  };

  const handleDraftChange = (field, formatter = (value) => value) => (event) => {
    const raw = event?.target?.value ?? "";
    const value = formatter(raw);
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddSubmit = (event) => {
    event.preventDefault();
    if (isReadOnly) {
      alert("Bạn không có quyền thêm mới.");
      return;
    }
    const mst = tidyMST(draft.mst);
    if (!mst) {
      setAddError("Vui lòng nhập mã số thuế hợp lệ (chỉ chứa số).");
      return;
    }
    const normalizedCompany = String(draft.company || "").trim();
    const normalizedImport = String(draft.person_import || "").trim();
    const normalizedExport = String(draft.person_export || "").trim();
    const normalizedTeam = String(draft.team || "").trim();
    const normalizedDate = draft.effective_from || "";

    const newRow = {
      mst,
      company: normalizedCompany,
      person_import: normalizedImport,
      person_export: normalizedExport,
      effective_from: normalizedDate,
    };

    setRows((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const newKey = makeRowKey(newRow);
      const next = [...current];
      const existingIndex = next.findIndex((row) => makeRowKey(row) === newKey);
      const resolvedTeam = normalizedTeam || (existingIndex >= 0 ? next[existingIndex]?.team || "" : "");
      const payload = { ...newRow, team: resolvedTeam };
      if (existingIndex >= 0) {
        next[existingIndex] = { ...next[existingIndex], ...payload };
      } else {
        next.push(payload);
      }
      return sortMSTRows(next);
    });
    setPage(1);
    setShowAddForm(false);
    setAddError("");
    alert("Đã thêm vào danh sách. Bấm Lưu để ghi vào hệ thống.");
  };

  const exportRowsToExcel = (scope = "filtered") => {
    const source = scope === "all" ? rows : filtered;
    if (!source.length) {
      alert("Không có dữ liệu để xuất Excel.");
      return;
    }
    const data = source.map((item, index) => ({
      STT: index + 1,
      MST: item.mst,
      "Công ty": item.company || "",
      "Người phụ trách Nhập": item.person_import || "",
      "Người phụ trách Xuất": item.person_export || "",
      "Tổ đội": item.team || "",
      "Áp dụng từ ngày": item.effective_from || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gan MST");
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
      2,
      "0"
    )}`;
    const suffix = scope === "all" ? "toan-bo" : "loc";
    XLSX.writeFile(workbook, `gan-mst-${suffix}-${timestamp}.xlsx`);
  };

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

      // Gộp với dữ liệu hiện có theo MST + ngày hiệu lực (ưu tiên dữ liệu mới)
      const byKey = new Map();
      for (const r of rows) {
        byKey.set(makeRowKey(r), { ...r });
      }
      for (const r of mapped) {
        const key = makeRowKey(r);
        byKey.set(key, { ...byKey.get(key), ...r });
      }

      setRows(sortMSTRows(Array.from(byKey.values())));
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
      refreshHistory();
      alert("Lưu thành công!");
    } catch (e) {
      console.error(e);
      alert("Lưu thất bại!");
    }
  };

  /** Thao tác inline */
  const updateRow = (originalRow, patch) => {
    if (isReadOnly) return;
    const targetKey = makeRowKey(originalRow);
    setRows((prev) =>
      sortMSTRows(
        prev.map((r) => {
          if (makeRowKey(r) !== targetKey) return r;
          const next = { ...r, ...patch };
          if (patch && Object.prototype.hasOwnProperty.call(patch, "mst")) {
            next.mst = tidyMST(next.mst);
          }
          return next;
        })
      )
    );
  };

  const removeRow = (row) => {
    if (isReadOnly) return;
    const key = makeRowKey(row);
    const label = row.effective_from
      ? `${row.mst} (${row.effective_from})`
      : row.mst;
    if (!confirm(`Xóa dòng ${label}?`)) return;
    setRows((prev) => prev.filter((r) => makeRowKey(r) !== key));
  };

  /** UI */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {isReadOnly && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Bạn đang xem bảng gán MST ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị hoặc được cấp quyền để import, chỉnh sửa và lưu thay đổi.
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 mb-3">
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
              title="Chọn file Excel chứa dữ liệu gán MST"
            >
              Chọn file XLSX
            </button>
            <button
              onClick={onImportXLSX}
              className="px-3 py-1 rounded bg-black text-white"
              type="button"
              title="Đọc file Excel và đổ vào danh sách tạm"
            >
              Import XLSX
            </button>
            <button
              type="button"
              onClick={toggleAddForm}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
              title="Thêm thủ công một dòng gán MST"
            >
              {showAddForm ? "Đóng thêm mới" : "Thêm mới"}
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
            className="border rounded px-2 py-1"
            placeholder="Áp dụng từ ngày"
            title="Áp dụng từ ngày (ghi vào trường trống khi import)"
          />
        )}

        <span className="text-xs text-gray-500 whitespace-nowrap">
          * Khi lưu, quy tắc mới chỉ áp dụng cho tờ khai có ngày khai báo từ ngày này trở đi.
        </span>

        <div className="flex-1" />

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm nhanh (MST / Công ty)"
            className="border rounded px-2 py-1 w-64"
            title="Tìm nhanh theo mã số thuế hoặc tên công ty"
          />
          <button
            type="button"
            onClick={() => exportRowsToExcel("filtered")}
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
            title="Xuất ra Excel các dòng đang hiển thị theo bộ lọc hiện tại"
          >
            Export (lọc)
          </button>
          <button
            type="button"
            onClick={() => exportRowsToExcel("all")}
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
            title="Xuất ra Excel toàn bộ danh sách đang quản lý"
          >
            Export (tất cả)
          </button>
          {canEdit && (
            <button
              onClick={onSave}
              className="px-3 py-1 rounded bg-emerald-600 text-white"
              title="Lưu danh sách đang hiển thị vào hệ thống"
            >
              Lưu
            </button>
          )}
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Mã số thuế
              <input
                type="text"
                value={draft.mst}
                onChange={handleDraftChange("mst", tidyMST)}
                className="border rounded px-2 py-1"
                placeholder="Nhập mã số thuế"
                required
                title="Nhập mã số thuế (chỉ chứa số)"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Tên công ty
              <input
                type="text"
                value={draft.company}
                onChange={handleDraftChange("company")}
                className="border rounded px-2 py-1"
                placeholder="Tên công ty"
                title="Tên doanh nghiệp tương ứng với MST"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Người phụ trách Nhập
              <input
                type="text"
                value={draft.person_import}
                onChange={handleDraftChange("person_import")}
                className="border rounded px-2 py-1"
                placeholder="Phụ trách nhập"
                title="Người phụ trách tờ khai nhập khẩu"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Người phụ trách Xuất
              <input
                type="text"
                value={draft.person_export}
                onChange={handleDraftChange("person_export")}
                className="border rounded px-2 py-1"
                placeholder="Phụ trách xuất"
                title="Người phụ trách tờ khai xuất khẩu"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Tổ đội (tuỳ chọn)
              <input
                type="text"
                value={draft.team}
                onChange={handleDraftChange("team")}
                className="border rounded px-2 py-1"
                placeholder="Tên tổ đội"
                title="Ghi chú tổ đội/nhóm phụ trách nếu cần"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Áp dụng từ ngày
              <input
                type="date"
                value={draft.effective_from}
                onChange={handleDraftChange("effective_from")}
                className="border rounded px-2 py-1"
                title="Ngày bắt đầu áp dụng cấu hình"
              />
            </label>
          </div>
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-emerald-600 text-white"
              title="Thêm dòng này vào danh sách tạm"
            >
              Thêm vào danh sách
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddError("");
              }}
              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
              title="Đóng biểu mẫu thêm mới"
            >
              Hủy
            </button>
            <span className="text-xs text-gray-500">
              * Sau khi thêm, bấm Lưu để ghi dữ liệu vào hệ thống chính thức.
            </span>
          </div>
        </form>
      )}

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
              <th className="p-2 text-left w-40">Áp dụng từ ngày</th>
              <th className="p-2 w-16">Xóa</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={6}>
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const rowKey = makeRowKey(r);
                const rowHistory = historyIndex.get(rowKey) || {};
                const importHistory = rowHistory.person_import || [];
                const exportHistory = rowHistory.person_export || [];
                const effectiveHistory = rowHistory.effective_from || [];
                return (
                  <tr key={rowKey || r.mst} className="border-t">
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.mst}</span>
                    ) : (
                      <input
                        value={r.mst}
                        onChange={(e) =>
                          updateRow(r, { mst: tidyMST(e.target.value) })
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
                          updateRow(r, { company: e.target.value })
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
                          updateRow(r, { person_import: e.target.value })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                    <HistoryDetails
                      entries={importHistory}
                      label={HISTORY_FIELD_LABELS.person_import}
                    />
                  </td>
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.person_export || ""}</span>
                    ) : (
                      <input
                        value={r.person_export || ""}
                        onChange={(e) =>
                          updateRow(r, { person_export: e.target.value })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                    <HistoryDetails
                      entries={exportHistory}
                      label={HISTORY_FIELD_LABELS.person_export}
                    />
                  </td>
                  <td className="p-2">
                    {isReadOnly ? (
                      <span>{r.effective_from || ""}</span>
                    ) : (
                      <input
                        type="date"
                        value={r.effective_from || ""}
                        onChange={(e) =>
                          updateRow(r, { effective_from: e.target.value })
                        }
                        className="border rounded px-2 py-1 w-full"
                      />
                    )}
                    <HistoryDetails
                      entries={effectiveHistory}
                      label={HISTORY_FIELD_LABELS.effective_from}
                    />
                  </td>
                  <td className="p-2 text-center">
                    {canEdit ? (
                      <button
                        onClick={() => removeRow(r)}
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
                );
              })
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
