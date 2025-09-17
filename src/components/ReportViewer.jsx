import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  getDeclRows,
  getTeamRoster,
  sortDeclRows,
} from "@/lib/store.js";
import { loadRules } from "@/lib/rules.js";
import {
  QUICK_RANGE_OPTIONS,
  computeQuickRange,
  buildReportData,
} from "@/lib/reports.js";

function formatInt(value) {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN");
}

function formatDecimal(value) {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function slugify(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "bao-cao";
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-gray-500">{subtitle}</div> : null}
    </div>
  );
}

function StaffDetailCard({ staff }) {
  const { stats, rows } = staff;
  const infoLine = `${stats.decls} tờ khai — Nhập: ${formatInt(stats.import)} • Xuất: ${formatInt(stats.export)}`;

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm print:avoid-break">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Nhân viên: {staff.name}</h3>
          <p className="text-sm text-gray-600">Tổ đội: {staff.teamLabel}</p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <div>
            Điểm KPI:
            <span className="ml-1 text-base font-semibold text-gray-900">
              {formatDecimal(stats.kpi)}
            </span>
          </div>
          <div>{infoLine}</div>
        </div>
      </header>

      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Mục hàng</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.items)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Số giấy phép</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.licenses)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Tờ khai nhập</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.import)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Tờ khai xuất</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.export)}</div>
        </div>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Ngày</th>
              <th className="px-3 py-2 text-left">Số tờ khai</th>
              <th className="px-3 py-2 text-left">Loại hình</th>
              <th className="px-3 py-2 text-left">Nhập/Xuất</th>
              <th className="px-3 py-2 text-right">Mục hàng</th>
              <th className="px-3 py-2 text-right">Số GP</th>
              <th className="px-3 py-2 text-right">Điểm KPI</th>
              <th className="px-3 py-2 text-left">MST</th>
              <th className="px-3 py-2 text-left">Công ty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.so_tk}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-1.5">{row.date}</td>
                <td className="px-3 py-1.5">{row.so_tk}</td>
                <td className="px-3 py-1.5">{row.loai_hinh || ""}</td>
                <td className="px-3 py-1.5">{row.isExport ? "Xuất" : "Nhập"}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(row.num_items)}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(row.licenses)}</td>
                <td className="px-3 py-1.5 text-right">{formatDecimal(row.kpi)}</td>
                <td className="px-3 py-1.5">{row.mst || ""}</td>
                <td className="px-3 py-1.5">{row.cong_ty || ""}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                  Chưa có tờ khai nào trong giai đoạn được chọn.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeamDetailCard({ team }) {
  const { stats, members, rows } = team;
  const infoLine = `${stats.decls} tờ khai — Nhập: ${formatInt(stats.import)} • Xuất: ${formatInt(stats.export)}`;
  const memberNames = members.map((m) => m.name).filter(Boolean);

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm print:avoid-break">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tổ đội: {team.name}</h3>
          <p className="text-sm text-gray-600">
            Thành viên: {memberNames.length ? memberNames.join(", ") : "Chưa có thành viên trong roster"}
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <div>
            Điểm KPI:
            <span className="ml-1 text-base font-semibold text-gray-900">
              {formatDecimal(stats.kpi)}
            </span>
          </div>
          <div>{infoLine}</div>
        </div>
      </header>

      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Mục hàng</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.items)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Số giấy phép</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.licenses)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Tờ khai nhập</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.import)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Tờ khai xuất</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.export)}</div>
        </div>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Nhân viên</th>
              <th className="px-3 py-2 text-right">Tờ khai</th>
              <th className="px-3 py-2 text-right">Điểm KPI</th>
              <th className="px-3 py-2 text-right">Nhập</th>
              <th className="px-3 py-2 text-right">Xuất</th>
              <th className="px-3 py-2 text-right">Mục hàng</th>
              <th className="px-3 py-2 text-right">Số GP</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, idx) => (
              <tr key={member.key || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-1.5">{member.name}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(member.stats.decls)}</td>
                <td className="px-3 py-1.5 text-right">{formatDecimal(member.stats.kpi)}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(member.stats.import)}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(member.stats.export)}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(member.stats.items)}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(member.stats.licenses)}</td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>
                  Chưa có thành viên nào trong tổ đội này.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Ngày</th>
              <th className="px-3 py-2 text-left">Số tờ khai</th>
              <th className="px-3 py-2 text-left">Nhân viên</th>
              <th className="px-3 py-2 text-left">Loại hình</th>
              <th className="px-3 py-2 text-left">Nhập/Xuất</th>
              <th className="px-3 py-2 text-right">Mục hàng</th>
              <th className="px-3 py-2 text-right">Số GP</th>
              <th className="px-3 py-2 text-right">Điểm KPI</th>
              <th className="px-3 py-2 text-left">MST</th>
              <th className="px-3 py-2 text-left">Công ty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.so_tk}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-1.5">{row.date}</td>
                <td className="px-3 py-1.5">{row.so_tk}</td>
                <td className="px-3 py-1.5">{row.nhan_vien || ""}</td>
                <td className="px-3 py-1.5">{row.loai_hinh || ""}</td>
                <td className="px-3 py-1.5">{row.isExport ? "Xuất" : "Nhập"}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(row.num_items)}</td>
                <td className="px-3 py-1.5 text-right">{formatInt(row.licenses)}</td>
                <td className="px-3 py-1.5 text-right">{formatDecimal(row.kpi)}</td>
                <td className="px-3 py-1.5">{row.mst || ""}</td>
                <td className="px-3 py-1.5">{row.cong_ty || ""}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={10}>
                  Chưa có tờ khai nào trong giai đoạn được chọn.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ReportViewer({ canExport = true }) {
  const initialRange = useMemo(() => computeQuickRange("this_month"), []);
  const [quickRange, setQuickRange] = useState("this_month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [scope, setScope] = useState("staff"); // staff | team
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [version, setVersion] = useState(0);

  const [rules, setRulesState] = useState(() => loadRules());
  const [roster, setRoster] = useState(() => getTeamRoster());
  const [declarations, setDeclarations] = useState(() => sortDeclRows(getDeclRows()));

  useEffect(() => {
    setRulesState(loadRules());
    setRoster(getTeamRoster());
    setDeclarations(sortDeclRows(getDeclRows()));
  }, [version]);

  const report = useMemo(
    () => buildReportData(declarations, { roster, rules, from, to }),
    [declarations, roster, rules, from, to]
  );

  useEffect(() => {
    if (scope === "staff" && selectedStaff !== "all") {
      const exists = report.staff.list.some((item) => item.key === selectedStaff);
      if (!exists) {
        setSelectedStaff("all");
      }
    }
  }, [scope, selectedStaff, report.staff.list]);

  useEffect(() => {
    if (scope === "team" && selectedTeam !== "all") {
      const exists = report.teams.list.some((item) => item.key === selectedTeam);
      if (!exists) {
        setSelectedTeam("all");
      }
    }
  }, [scope, selectedTeam, report.teams.list]);

  const summary = report.summary;
  const ruleTitle = report.rules?.name || "Chưa đặt tên";
  const ruleApply = report.rules?.applyFrom
    ? `Áp dụng từ ${report.rules.applyFrom}`
    : "Áp dụng ngay";

  const staffOptions = useMemo(() => {
    const base = [
      { value: "all", label: `Tất cả nhân viên (${report.staff.list.length})` },
    ];
    return base.concat(
      report.staff.list.map((item) => ({
        value: item.key,
        label: item.teamLabel && item.teamLabel !== "Chưa gán tổ đội"
          ? `${item.name} — ${item.teamLabel}`
          : item.name,
      }))
    );
  }, [report.staff.list]);

  const teamOptions = useMemo(() => {
    const base = [
      { value: "all", label: `Tất cả tổ đội (${report.teams.list.length})` },
    ];
    return base.concat(
      report.teams.list.map((item) => ({ value: item.key, label: item.name }))
    );
  }, [report.teams.list]);

  const activeStaff = selectedStaff !== "all"
    ? report.staff.byKey.get(selectedStaff)
    : null;
  const activeTeam = selectedTeam !== "all"
    ? report.teams.byKey.get(selectedTeam)
    : null;

  const handleQuickRangeChange = (value) => {
    setQuickRange(value);
    if (value === "custom") return;
    const range = computeQuickRange(value);
    setFrom(range.from);
    setTo(range.to);
  };

  const handleExport = () => {
    if (!canExport) {
      alert("Tài khoản hiện tại không được phép xuất báo cáo.");
      return;
    }
    if (typeof window === "undefined") return;
    if (!summary.decls) {
      alert("Không có dữ liệu để xuất");
      return;
    }

    const wb = XLSX.utils.book_new();
    const today = new Date().toISOString().slice(0, 10);

    if (scope === "staff") {
      if (selectedStaff === "all") {
        const sheetData = report.staff.list.map((item) => ({
          "Nhân viên": item.name,
          "Tổ đội": item.teamLabel,
          "Tờ khai": item.stats.decls,
          "Nhập": item.stats.import,
          "Xuất": item.stats.export,
          "Mục hàng": item.stats.items,
          "Số GP hợp lệ": item.stats.licenses,
          "Điểm KPI": item.stats.kpi,
        }));
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, "Nhan vien");
      } else if (activeStaff) {
        const summarySheet = XLSX.utils.json_to_sheet([
          {
            "Nhân viên": activeStaff.name,
            "Tổ đội": activeStaff.teamLabel,
            "Tờ khai": activeStaff.stats.decls,
            "Nhập": activeStaff.stats.import,
            "Xuất": activeStaff.stats.export,
            "Mục hàng": activeStaff.stats.items,
            "Số GP hợp lệ": activeStaff.stats.licenses,
            "Điểm KPI": activeStaff.stats.kpi,
          },
        ]);
        XLSX.utils.book_append_sheet(wb, summarySheet, "Tong quan");

        const detailSheet = XLSX.utils.json_to_sheet(
          activeStaff.rows.length
            ? activeStaff.rows.map((row) => ({
                "Ngày": row.date,
                "Số tờ khai": row.so_tk,
                "Loại hình": row.loai_hinh,
                "Loại": row.isExport ? "Xuất" : "Nhập",
                "Mục hàng": row.num_items,
                "Số GP": row.licenses,
                "Điểm KPI": row.kpi,
                "MST": row.mst,
                "Công ty": row.cong_ty,
              }))
            : [{ "Thông báo": "Không có dữ liệu" }]
        );
        XLSX.utils.book_append_sheet(wb, detailSheet, "Chi tiet");
      }
    } else {
      if (selectedTeam === "all") {
        const sheetData = report.teams.list.map((item) => ({
          "Tổ đội": item.name,
          "Tờ khai": item.stats.decls,
          "Nhập": item.stats.import,
          "Xuất": item.stats.export,
          "Mục hàng": item.stats.items,
          "Số GP hợp lệ": item.stats.licenses,
          "Điểm KPI": item.stats.kpi,
        }));
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, "To doi");
      } else if (activeTeam) {
        const summarySheet = XLSX.utils.json_to_sheet([
          {
            "Tổ đội": activeTeam.name,
            "Tờ khai": activeTeam.stats.decls,
            "Nhập": activeTeam.stats.import,
            "Xuất": activeTeam.stats.export,
            "Mục hàng": activeTeam.stats.items,
            "Số GP hợp lệ": activeTeam.stats.licenses,
            "Điểm KPI": activeTeam.stats.kpi,
          },
        ]);
        XLSX.utils.book_append_sheet(wb, summarySheet, "Tong quan");

        const membersSheet = XLSX.utils.json_to_sheet(
          activeTeam.members.length
            ? activeTeam.members.map((member) => ({
                "Nhân viên": member.name,
                "Tờ khai": member.stats.decls,
                "Nhập": member.stats.import,
                "Xuất": member.stats.export,
                "Mục hàng": member.stats.items,
                "Số GP": member.stats.licenses,
                "Điểm KPI": member.stats.kpi,
              }))
            : [{ "Thông báo": "Không có thành viên" }]
        );
        XLSX.utils.book_append_sheet(wb, membersSheet, "Thanh vien");

        const detailSheet = XLSX.utils.json_to_sheet(
          activeTeam.rows.length
            ? activeTeam.rows.map((row) => ({
                "Ngày": row.date,
                "Số tờ khai": row.so_tk,
                "Nhân viên": row.nhan_vien,
                "Loại hình": row.loai_hinh,
                "Loại": row.isExport ? "Xuất" : "Nhập",
                "Mục hàng": row.num_items,
                "Số GP": row.licenses,
                "Điểm KPI": row.kpi,
                "MST": row.mst,
                "Công ty": row.cong_ty,
              }))
            : [{ "Thông báo": "Không có dữ liệu" }]
        );
        XLSX.utils.book_append_sheet(wb, detailSheet, "Chi tiet");
      }
    }

    const scopeSlug = scope === "staff" ? "nhan-vien" : "to-doi";
    const targetSlug =
      scope === "staff"
        ? selectedStaff === "all"
          ? "tat-ca"
          : slugify(activeStaff?.name)
        : selectedTeam === "all"
        ? "tat-ca"
        : slugify(activeTeam?.name);
    const filename = `bao-cao-kpi-${scopeSlug}-${targetSlug}-${today}.xlsx`;

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  const renderStaffSection = () => {
    if (!summary.decls) {
      return (
        <div className="rounded border bg-white p-6 text-center text-sm text-gray-500">
          Chưa có dữ liệu tờ khai trong khoảng thời gian đã chọn. Vui lòng import dữ liệu hoặc thay đổi bộ lọc.
        </div>
      );
    }

    if (selectedStaff === "all") {
      return (
        <div className="space-y-6">
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Nhân viên</th>
                  <th className="px-3 py-2 text-left">Tổ đội</th>
                  <th className="px-3 py-2 text-right">Tờ khai</th>
                  <th className="px-3 py-2 text-right">Điểm KPI</th>
                  <th className="px-3 py-2 text-right">Nhập</th>
                  <th className="px-3 py-2 text-right">Xuất</th>
                  <th className="px-3 py-2 text-right">Mục hàng</th>
                  <th className="px-3 py-2 text-right">Số GP</th>
                </tr>
              </thead>
              <tbody>
                {report.staff.list.map((item, idx) => (
                  <tr key={item.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-1.5">{item.name}</td>
                    <td className="px-3 py-1.5">{item.teamLabel}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.decls)}</td>
                    <td className="px-3 py-1.5 text-right">{formatDecimal(item.stats.kpi)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.import)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.export)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.items)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.licenses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            {report.staff.list.map((item) => (
              <StaffDetailCard key={item.key} staff={item} />
            ))}
          </div>
        </div>
      );
    }

    if (!activeStaff) {
      return null;
    }

    return <StaffDetailCard staff={activeStaff} />;
  };

  const renderTeamSection = () => {
    if (!summary.decls) {
      return (
        <div className="rounded border bg-white p-6 text-center text-sm text-gray-500">
          Chưa có dữ liệu tờ khai trong khoảng thời gian đã chọn. Vui lòng import dữ liệu hoặc thay đổi bộ lọc.
        </div>
      );
    }

    if (selectedTeam === "all") {
      return (
        <div className="space-y-6">
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Tổ đội</th>
                  <th className="px-3 py-2 text-right">Tờ khai</th>
                  <th className="px-3 py-2 text-right">Điểm KPI</th>
                  <th className="px-3 py-2 text-right">Nhập</th>
                  <th className="px-3 py-2 text-right">Xuất</th>
                  <th className="px-3 py-2 text-right">Mục hàng</th>
                  <th className="px-3 py-2 text-right">Số GP</th>
                </tr>
              </thead>
              <tbody>
                {report.teams.list.map((item, idx) => (
                  <tr key={item.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-1.5">{item.name}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.decls)}</td>
                    <td className="px-3 py-1.5 text-right">{formatDecimal(item.stats.kpi)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.import)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.export)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.items)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(item.stats.licenses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            {report.teams.list.map((item) => (
              <TeamDetailCard key={item.key} team={item} />
            ))}
          </div>
        </div>
      );
    }

    if (!activeTeam) {
      return null;
    }

    return <TeamDetailCard team={activeTeam} />;
  };

  const excludeCodes = Array.isArray(report.rules?.license?.excludeCodes)
    ? report.rules.license.excludeCodes.join(", ") || "Không có"
    : "Không có";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700">Khoảng thời gian</label>
          <select
            className="mt-1 rounded border px-3 py-2 text-sm"
            value={quickRange}
            onChange={(e) => handleQuickRangeChange(e.target.value)}
          >
            {QUICK_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700">Từ ngày</label>
          <input
            type="date"
            className="mt-1 rounded border px-3 py-2 text-sm"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setQuickRange("custom");
            }}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700">Đến ngày</label>
          <input
            type="date"
            className="mt-1 rounded border px-3 py-2 text-sm"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setQuickRange("custom");
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setVersion((v) => v + 1)}
          className="ml-auto rounded border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
        >
          Tải lại dữ liệu
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport}
          className={`rounded px-3 py-2 text-sm font-semibold shadow-sm ${
            canExport ? "bg-black text-white hover:bg-gray-900" : "bg-gray-200 text-gray-500"
          }`}
        >
          Xuất Excel
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!canExport}
          className={`rounded border px-3 py-2 text-sm shadow-sm ${
            canExport ? "hover:bg-gray-50" : "text-gray-400"
          }`}
        >
          In / Xuất PDF
        </button>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div>
            <div className="text-xs uppercase text-gray-500">Quy tắc KPI</div>
            <div className="text-base font-semibold text-gray-900">{ruleTitle}</div>
            <div className="text-xs text-gray-500">{ruleApply}</div>
          </div>
          <div className="ml-auto text-right">
            {report.range.from || report.range.to ? (
              <div>
                Khoảng: {report.range.from || "…"} → {report.range.to || "…"}
              </div>
            ) : (
              <div>Khoảng: Tất cả dữ liệu</div>
            )}
            <div>{summary.decls} tờ khai hợp lệ</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Tổng tờ khai"
          value={formatInt(summary.decls)}
          subtitle={`Nhập: ${formatInt(summary.import)} • Xuất: ${formatInt(summary.export)}`}
        />
        <SummaryCard
          title="Tổng điểm KPI"
          value={formatDecimal(summary.kpi)}
          subtitle="Bao gồm điểm loại hình và giấy phép"
        />
        <SummaryCard
          title="Tổng mục hàng"
          value={formatInt(summary.items)}
          subtitle="Cộng dồn tất cả tờ khai"
        />
        <SummaryCard
          title="Số giấy phép hợp lệ"
          value={formatInt(summary.licenses)}
          subtitle="Đã loại trừ theo quy tắc KPI"
        />
      </div>

      <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div className="font-semibold text-gray-900">Chế độ xem</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScope("staff")}
              className={`rounded px-3 py-1.5 ${
                scope === "staff"
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Nhân viên
            </button>
            <button
              type="button"
              onClick={() => setScope("team")}
              className={`rounded px-3 py-1.5 ${
                scope === "team"
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Tổ đội
            </button>
          </div>

          {scope === "staff" ? (
            <select
              className="ml-auto rounded border px-3 py-2 text-sm"
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
            >
              {staffOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="ml-auto rounded border px-3 py-2 text-sm"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
            >
              {teamOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>{scope === "staff" ? renderStaffSection() : renderTeamSection()}</div>
      </div>

      <div className="space-y-2 rounded-lg border bg-white p-4 text-sm text-gray-600 shadow-sm">
        <div className="font-semibold text-gray-900">Ghi chú & Quy tắc tính điểm</div>
        <p>
          Điểm KPI được tính tự động dựa trên quy tắc trong mục “Quy tắc KPI”. Khi bạn import tờ khai hợp lệ từ
          Excel, hệ thống sẽ áp dụng quy tắc hiện hành để tính điểm cho từng bản ghi và cộng dồn theo nhân viên,
          tổ đội.
        </p>
        <p>
          Các loại giấy phép bị loại trừ khỏi việc tính điểm: <strong>{excludeCodes}</strong>.
          Bạn có thể điều chỉnh danh sách này trong phần cấu hình quy tắc.
        </p>
        <p>
          Để in báo cáo, hãy chọn phạm vi thời gian và chế độ xem mong muốn, sau đó sử dụng nút “In / Xuất PDF”.
          Khi cần lưu trữ hoặc chia sẻ, sử dụng nút “Xuất Excel” để tải file theo template chứa bảng tổng hợp và
          bảng chi tiết tương ứng.
        </p>
      </div>
    </div>
  );
}
