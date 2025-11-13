import React, { useEffect, useMemo, useState } from "react";

import { aggregateByCompany } from "@/lib/reports.js";
import { formatDisplayDate } from "@/shared/format.js";
import { toAdjustmentTotalsArray } from "../../shared/kpiAdjustments.js";
import {
  DEFAULT_DETAIL_PAGE_SIZE,
  DETAIL_PAGE_SIZE_OPTIONS,
  getSegmentedButtonClass,
  sortStatsCollection,
} from "./detailShared.js";
import { formatDecimal, formatInt } from "./formatters.js";

function TeamDetailCard({

  team,

  canExport,

  onExport,

  exporting,

  visibleColumns = {},

  memberSortKey = "kpi",

  detailPageSize = DEFAULT_DETAIL_PAGE_SIZE,

  detailPageSizeMode = "preset",

  detailPageSizeCustomInput = "",

  onDetailPageSizeChange,

  onDetailPageSizeCustomInputChange,

}) {

  const { stats, members, rows, adjustmentSummary } = team;

  const [mode, setMode] = useState("summary");

  const [detailPage, setDetailPage] = useState(0);

  const aggregated = useMemo(

    () => aggregateByCompany(rows, { includeStaff: true, includeTeam: false }),

    [rows]

  );

  const showItems = visibleColumns.items !== false;

  const showLicenses = visibleColumns.licenses !== false;

  const showCo = visibleColumns.co !== false;

  const showCoLines = visibleColumns.coLines !== false;

  const showLicenseCodes = visibleColumns.licenseCodes !== false;

  const licenseSummary = (stats.licenseCodes || []).join(", ");

  const adjustmentTotals = useMemo(

    () => toAdjustmentTotalsArray(adjustmentSummary || {}),

    [adjustmentSummary]

  );

  const totalAdjustmentPoints = useMemo(

    () =>

      adjustmentTotals.reduce((sum, item) => {

        const value = Number(item?.points || 0);

        return Number.isFinite(value) ? sum + value : sum;

      }, 0),

    [adjustmentTotals]

  );

  const totalAdjustmentEntries = useMemo(

    () => rows.filter((row) => row?.isAdjustment).length,

    [rows]

  );

  const adjustmentBreakdown = useMemo(() => {

    let positive = 0;

    let negative = 0;

    let neutral = 0;

    for (const row of rows) {

      if (!row?.isAdjustment) continue;

      const value = Number(row?.kpi || 0);

      if (!Number.isFinite(value) || Math.abs(value) < 0.0001) {

        neutral += 1;

        continue;

      }

      if (value > 0) {

        positive += 1;

      } else {

        negative += 1;

      }

    }

    return { positive, negative, neutral };

  }, [rows]);

  const adjustmentTooltip = useMemo(() => {

    const lines = adjustmentTotals

      .filter((item) => Number(item?.points))

      .map((item) => `${item.label}: ${formatDecimal(item.points)}`);

    if (!lines.length) {

      return "Chưa có điều chỉnh";

    }

    return lines.join("\n");

  }, [adjustmentTotals]);

  const adjustmentSubtitle = useMemo(() => {

    if (!totalAdjustmentEntries) {

      return "Chưa có điều chỉnh";

    }

    const segments = [];

    if (adjustmentBreakdown.positive) {

      segments.push(`${formatInt(adjustmentBreakdown.positive)} lượt cộng`);

    }

    if (adjustmentBreakdown.negative) {

      segments.push(`${formatInt(adjustmentBreakdown.negative)} lượt trừ`);

    }

    if (adjustmentBreakdown.neutral) {

      segments.push(`${formatInt(adjustmentBreakdown.neutral)} lượt 0 điểm`);

    }

    if (!segments.length) {

      return `${formatInt(totalAdjustmentEntries)} lượt cộng/trừ`;

    }

    return segments.join(" • ");

  }, [adjustmentBreakdown, totalAdjustmentEntries]);

  const infoLineParts = [

    `${formatInt(stats.decls)} tờ khai`,

    `Nhập: ${formatInt(stats.import)} • Xuất: ${formatInt(stats.export)}`,

  ];

  if (showCo) {

    infoLineParts.push(`Có C/O: ${formatInt(stats.co ?? 0)}`);

  }

  if (showCoLines) {

    infoLineParts.push(`Dòng C/O: ${formatInt(stats.coLines ?? 0)}`);

  }

  const infoLine = infoLineParts.join(" — ");

  const memberColumnCount =

    5 +

    (showItems ? 1 : 0) +

    (showLicenses ? 1 : 0) +

    (showCo ? 1 : 0) +

    (showCoLines ? 1 : 0) +

    (showLicenseCodes ? 1 : 0);

  const memberNames = members.map((m) => m.name).filter(Boolean);

  const normalizedDetailPageSize = Math.max(1, Number(detailPageSize) || DEFAULT_DETAIL_PAGE_SIZE);

  const detailRowChunks = useMemo(() => {

    if (!rows.length) {

      return [];

    }

    if (mode !== "detail") {

      return [rows];

    }

    if (rows.length <= normalizedDetailPageSize) {

      return [rows];

    }

    const chunks = [];

    for (let i = 0; i < rows.length; i += normalizedDetailPageSize) {

      chunks.push(rows.slice(i, i + normalizedDetailPageSize));

    }

    return chunks;

  }, [rows, mode, normalizedDetailPageSize]);

  const detailRowChunksLength = detailRowChunks.length;

  const totalDetailRows = rows.length;

  const totalDetailPages = mode === "detail" ? Math.max(1, detailRowChunksLength || 1) : 1;

  const currentDetailPage = Math.min(detailPage, totalDetailPages - 1);

  const currentDetailChunk = mode === "detail" ? detailRowChunks[currentDetailPage] || [] : rows;

  const detailPageStart =

    totalDetailRows === 0 ? 0 : currentDetailPage * normalizedDetailPageSize + 1;

  const detailPageEnd =

    totalDetailRows === 0 ? 0 : detailPageStart + currentDetailChunk.length - 1;

  const detailRangeLabel = totalDetailRows

    ? `${formatInt(detailPageStart)}-${formatInt(detailPageEnd)} / ${formatInt(totalDetailRows)}`

    : "0 / 0";

  const isFirstDetailPage = currentDetailPage === 0;

  const isLastDetailPage = currentDetailPage >= totalDetailPages - 1;

  useEffect(() => {

    if (mode !== "detail") {

      if (detailPage !== 0) {

        setDetailPage(0);

      }

      return;

    }

    const cappedPage = Math.min(detailPage, Math.max(0, totalDetailPages - 1));

    if (cappedPage !== detailPage) {

      setDetailPage(cappedPage);

    }

  }, [mode, totalDetailPages, detailPage]);

  useEffect(() => {

    setDetailPage(0);

  }, [normalizedDetailPageSize, totalDetailRows, team?.key]);



  return (

    <section className="kpi-print-section space-y-3 rounded-lg border bg-white p-4 shadow-sm print:avoid-break">

      <header className="flex flex-wrap items-start justify-between gap-3">

        <div>

          <h3 className="text-lg font-semibold text-gray-900">Tổ đội: {team.name}</h3>

          <p className="text-sm text-gray-600">

            Thành viên: {memberNames.length ? memberNames.join(", ") : "Chưa có thành viên trong roster"}

          </p>

          <p className="text-xs text-gray-500">{infoLine}</p>

        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">

          <span className="font-semibold text-gray-900">Điểm KPI: {formatDecimal(stats.kpi)}</span>

          <div className="flex items-center gap-2 rounded-full bg-[color:var(--ds-surface-muted)] px-2 py-1">

            <button

              type="button"

              onClick={() => setMode("summary")}

              className={getSegmentedButtonClass(mode === "summary")}

            >

              Tổng quan

            </button>

            <button

              type="button"

              onClick={() => setMode("detail")}

              className={getSegmentedButtonClass(mode === "detail")}

            >

              Chi tiết

            </button>

          </div>

          <div className="flex flex-col gap-1 text-right">

            <div className="flex gap-2">

              <button

                type="button"

                onClick={onExport}

                disabled={!canExport || exporting}

                className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${

                  canExport && !exporting

                    ? 'border-[color:var(--ds-border-strong)] bg-[color:var(--ds-accent)] text-[color:var(--ds-text-inverse)] hover:bg-[color:var(--ds-accent-strong)]'

                    : 'cursor-not-allowed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-disabled)]'

                }`}

              >

                {exporting ? "Đang xuất..." : "Xuất Excel"}

              </button>

            </div>

            <span className="text-[11px] text-gray-400">Dùng Ctrl+P nếu cần in nhanh</span>

          </div>

        </div>

      </header>



      <div className="grid gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">

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

        {showCo ? (

          <div className="rounded border bg-gray-50 px-3 py-2">

            <div className="text-xs uppercase text-gray-500">Tờ khai có C/O</div>

            <div className="text-base font-semibold text-gray-900">{formatInt(stats.co ?? 0)}</div>

          </div>

        ) : null}

        {showCoLines ? (

          <div className="rounded border bg-gray-50 px-3 py-2">

            <div className="text-xs uppercase text-gray-500">Dòng C/O</div>

            <div className="text-base font-semibold text-gray-900">{formatInt(stats.coLines ?? 0)}</div>

          </div>

        ) : null}

        {showLicenseCodes ? (

          <div className="rounded border bg-gray-50 px-3 py-2">

            <div className="text-xs uppercase text-gray-500">Mã giấy phép</div>

            <div className="text-base font-semibold text-gray-900">{formatInt(stats.licenseCount ?? 0)}</div>

            <div className="mt-1 text-[11px] text-gray-500" title={licenseSummary || "—"}>

              {licenseSummary || "—"}

            </div>

          </div>

        ) : null}

        <div className="rounded border bg-gray-50 px-3 py-2" title={adjustmentTooltip}>

          <div className="text-xs uppercase text-gray-500">Điểm KPI +/-</div>

          <div className="text-base font-semibold text-gray-900">{formatDecimal(totalAdjustmentPoints)}</div>

          <div className="mt-1 text-[11px] text-gray-500">{adjustmentSubtitle}</div>

        </div>

      </div>



      {mode === "summary" ? (

        <CompanySummaryTable

          rows={aggregated}

          includeStaff

          visibleColumns={visibleColumns}

          sortKey={memberSortKey}

        />

      ) : (

        <>

          <div className="overflow-auto rounded border">

            <table className="min-w-full text-sm">

              <thead className="bg-gray-100">

                <tr>

                  <th className="px-3 py-2 text-left">Nhân viên</th>

                  <th className="px-3 py-2 text-right">Tờ khai</th>

                  <th className="px-3 py-2 text-right">Điểm KPI</th>

                  <th className="px-3 py-2 text-right">Nhập</th>

                  <th className="px-3 py-2 text-right">Xuất</th>

                  {showItems ? <th className="px-3 py-2 text-right">Mục hàng</th> : null}

                  {showLicenses ? <th className="px-3 py-2 text-right">Số GP</th> : null}

                  {showCo ? <th className="px-3 py-2 text-right">Tờ khai C/O</th> : null}

                  {showCoLines ? <th className="px-3 py-2 text-right">Dòng C/O</th> : null}

                  {showLicenseCodes ? <th className="px-3 py-2 text-left">Mã giấy phép</th> : null}

                </tr>

              </thead>

              <tbody>

                {sortStatsCollection(members, memberSortKey, (item) => item.name || "").map((member, idx) => (

                  <tr key={member.key || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>

                    <td className="px-3 py-1.5">{member.name}</td>

                    <td className="px-3 py-1.5 text-right">{formatInt(member.stats.decls)}</td>

                    <td className="px-3 py-1.5 text-right">{formatDecimal(member.stats.kpi)}</td>

                    <td className="px-3 py-1.5 text-right">{formatInt(member.stats.import)}</td>

                    <td className="px-3 py-1.5 text-right">{formatInt(member.stats.export)}</td>

                    {showItems ? (

                      <td className="px-3 py-1.5 text-right">{formatInt(member.stats.items)}</td>

                    ) : null}

                    {showLicenses ? (

                      <td className="px-3 py-1.5 text-right">{formatInt(member.stats.licenses)}</td>

                    ) : null}

                    {showCo ? (

                      <td className="px-3 py-1.5 text-right">{formatInt(member.stats.co ?? 0)}</td>

                    ) : null}

                    {showCoLines ? (

                      <td className="px-3 py-1.5 text-right">{formatInt(member.stats.coLines ?? 0)}</td>

                    ) : null}

                    {showLicenseCodes ? (

                      <td

                        className="px-3 py-1.5"

                        title={(member.stats.licenseCodes || []).join(", ") || "—"}

                      >

                        {(member.stats.licenseCodes || []).join(", ") || "—"}

                      </td>

                    ) : null}

                  </tr>

                ))}

                {members.length === 0 ? (

                  <tr>

                    <td className="px-3 py-6 text-center text-gray-500" colSpan={memberColumnCount}>

                      Chưa có thành viên nào trong tổ đội này.

                    </td>

                  </tr>

                ) : null}

              </tbody>

            </table>

          </div>



          {detailRowChunks.length === 0 ? (

            <div className="rounded border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-center text-sm text-[color:var(--ds-text-secondary)]">

              Chưa có tờ khai nào trong giai đoạn được chọn.

            </div>

          ) : (

            <div className="space-y-4">

              {detailRowChunks.map((chunkRows, chunkIdx) => {

                const baseIndex = chunkIdx * normalizedDetailPageSize;

                const chunkKey = `${team.key || team.name || "team"}-chunk-${chunkIdx}`;

                const chunkVisible = mode !== "detail" || chunkIdx === currentDetailPage;

                const chunkClassNames = [

                  "kpi-print-chunk",

                  "space-y-3",

                  chunkIdx > 0 ? "border-t border-dashed border-[color:var(--ds-border-subtle)] pt-4 mt-4" : "",

                  chunkVisible ? "" : "hidden print:block",

                ]

                  .filter(Boolean)

                  .join(" ");

                return (

                  <div key={chunkKey} className={chunkClassNames}>

                    <div className="overflow-auto rounded border">

                      <table className="min-w-full text-sm">

                        <thead className="bg-gray-100">

                          <tr>

                            <th className="px-3 py-2 text-left">Ngày</th>

                            <th className="px-3 py-2 text-left">Số tờ khai</th>

                            <th className="px-3 py-2 text-left">Nhân viên</th>

                            <th className="px-3 py-2 text-left">Loại hình</th>

                            <th className="px-3 py-2 text-left">Nhập/Xuất</th>

                            {showItems ? <th className="px-3 py-2 text-right">Mục hàng</th> : null}

                            {showLicenses ? <th className="px-3 py-2 text-right">Số GP</th> : null}

                            {showCo ? <th className="px-3 py-2 text-center">C/O</th> : null}

                            {showCoLines ? <th className="px-3 py-2 text-right">Dòng C/O</th> : null}

                            {showLicenseCodes ? <th className="px-3 py-2 text-left">Mã giấy phép</th> : null}

                            <th className="px-3 py-2 text-right">Điểm KPI</th>

                            <th className="px-3 py-2 text-left">MST</th>

                            <th className="px-3 py-2 text-left">Công ty</th>

                          </tr>

                        </thead>

                        <tbody>

                          {chunkRows.map((row, idx) => {

                            const licenseCodes = Array.isArray(row.licenseCodes) ? row.licenseCodes : [];

                            const excludedCodes = Array.isArray(row.licenseExcludedCodes)

                              ? row.licenseExcludedCodes

                              : [];

                            const licenseLabel = licenseCodes.join(", ") || "—";

                            const licenseTooltipParts = [];

                            if (licenseLabel && licenseLabel !== "—") {

                              licenseTooltipParts.push(`Áp dụng: ${licenseLabel}`);

                            }

                            if (excludedCodes.length) {

                              licenseTooltipParts.push(`Loại trừ: ${excludedCodes.join(", ")}`);

                            }

                            const licenseTooltip = licenseTooltipParts.join("\n") || "—";

                            const globalIndex = baseIndex + idx;

                            return (

                              <tr

                                key={`${row.so_tk}-${globalIndex}`}

                                className={globalIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}

                              >

                                <td className="px-3 py-1.5">{row.displayDate || formatDisplayDate(row.date)}</td>

                                <td className="px-3 py-1.5">{row.so_tk}</td>

                                <td className="px-3 py-1.5">{row.nhan_vien || ""}</td>

                                <td className="px-3 py-1.5">{row.loai_hinh || ""}</td>

                                <td className="px-3 py-1.5">{row.isExport ? "Xuất" : "Nhập"}</td>

                                {showItems ? (

                                  <td className="px-3 py-1.5 text-right">{formatInt(row.num_items)}</td>

                                ) : null}

                                {showLicenses ? (

                                  <td className="px-3 py-1.5 text-right">{formatInt(row.licenses)}</td>

                                ) : null}

                                {showCo ? (

                                  <td className="px-3 py-1.5 text-center">{row.hasCO ? "Có" : "Không"}</td>

                                ) : null}

                                {showCoLines ? (

                                  <td className="px-3 py-1.5 text-right">{formatInt(row.coLineCount || 0)}</td>

                                ) : null}

                                {showLicenseCodes ? (

                                  <td className="px-3 py-1.5" title={licenseTooltip}>

                                    {licenseLabel}

                                  </td>

                                ) : null}

                                <td className="px-3 py-1.5 text-right">{formatDecimal(row.kpi)}</td>

                                <td className="px-3 py-1.5">{row.mst || ""}</td>

                                <td className="px-3 py-1.5">{row.cong_ty || ""}</td>

                              </tr>

                            );

                          })}

                        </tbody>

                      </table>

                    </div>

                  </div>

                );

              })}

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--ds-text-secondary)] print:hidden">

                <div className="flex items-center gap-2">

                  <span>Hiển thị</span>

                  <select

                    value={detailPageSizeMode === "custom" ? "custom" : String(detailPageSize)}

                    onChange={onDetailPageSizeChange}

                    className="rounded border px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"

                  >

                    {DETAIL_PAGE_SIZE_OPTIONS.map((option) => (

                      <option key={option} value={option}>

                        {option}

                      </option>

                    ))}

                    <option value="custom">Tuỳ chỉnh...</option>

                  </select>

                  {detailPageSizeMode === "custom" ? (

                    <input

                      type="number"

                      min="1"

                      value={detailPageSizeCustomInput}

                      onChange={onDetailPageSizeCustomInputChange}

                      className="w-16 rounded border px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"

                      aria-label="Số tờ khai chi tiết mỗi trang"

                    />

                  ) : null}

                  <span>dòng/trang</span>

                </div>

                <div className="flex flex-wrap items-center gap-2">

                  <span>{detailRangeLabel}</span>

                  <span>

                    Trang {totalDetailPages ? currentDetailPage + 1 : 0}/{totalDetailPages}

                  </span>

                  <div className="flex items-center gap-1">

                    <button

                      type="button"

                      onClick={() => setDetailPage((prev) => Math.max(prev - 1, 0))}

                      disabled={isFirstDetailPage}

                      className={`inline-flex items-center justify-center rounded-full border px-2 py-1 font-semibold transition-colors ${

                        isFirstDetailPage

                          ? 'cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]'

                          : 'border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]'

                      }`}

                    >

                      Trước

                    </button>

                    <button

                      type="button"

                      onClick={() => setDetailPage((prev) => Math.min(prev + 1, totalDetailPages - 1))}

                      disabled={isLastDetailPage}

                      className={`inline-flex items-center justify-center rounded-full border px-2 py-1 font-semibold transition-colors ${

                        isLastDetailPage

                          ? 'cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]'

                          : 'border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]'

                      }`}

                    >

                      Sau

                    </button>

                  </div>

                </div>

              </div>

            </div>

          )}

        </>

      )}

    </section>

  );

}

export default TeamDetailCard;
