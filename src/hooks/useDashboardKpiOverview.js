import { useCallback, useEffect, useState } from "react";
import { fetchDashboardSummary } from "../../packages/api-client/src/reportingClient.js";
import { loadRules } from "@/lib/rules.js";

function getMonthBoundaries(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    firstDay.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Format as yyyy-mm-dd
    const from = firstDay.toISOString().split("T")[0];
    const to = today.toISOString().split("T")[0];
    return { from, to };
}

export function useDashboardKpiOverview() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [data, setData] = useState(null);
    const [version, setVersion] = useState(0);

    const reload = useCallback(() => {
        setVersion((v) => v + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            setLoading(true);
            setError("");

            try {
                const { from, to } = getMonthBoundaries();
                // Load the currently active rules for data formatting and references
                const activeRules = loadRules();
                const result = await fetchDashboardSummary({ from, to }, activeRules);

                if (!cancelled) {
                    setData(result);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Lỗi lấy dữ liệu tổng quan KPI", err);
                    setError(err?.message || "Không thể tải dữ liệu KPI.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [version]);

    const topStaffByKpi = (data?.staff?.list || [])
        .map(item => ({
            ...item,
            team: item.teamLabel !== "Chưa gán tổ đội" ? item.teamLabel : "Chưa gán tổ đội"
        }))
        .filter(item => item?.stats?.kpi > 0)
        .sort((a, b) => (b.stats?.kpi || 0) - (a.stats?.kpi || 0));

    const topStaffByDecls = (data?.staff?.list || [])
        .map(item => ({
            ...item,
            decls: Number(item?.stats?.decls || 0),
            team: item.teamLabel !== "Chưa gán tổ đội" ? item.teamLabel : "Chưa gán tổ đội"
        }))
        .filter(item => item.decls > 0)
        .sort((a, b) => b.decls - a.decls);

    return {
        loading,
        error,
        reload,

        // Core data
        summary: data?.summary || {},
        trendSeries: data?.trend?.series || [],
        trendComparison: data?.trend?.comparison || null,
        adjustmentsReport: data?.adjustments || {},

        // Pie charts
        teamPieData: data?.teams?.list?.map((item) => ({
            name: item.name,
            value: Math.round((item.stats.kpi || 0) * 10) / 10,
        })) || [],
        teamDeclPieData: data?.teams?.list?.map((item) => ({
            name: item.name,
            value: Number(item.stats.decls || 0),
        })) || [],

        // Staff ranking
        topStaffByKpi,
        topStaffByDecls,

        // Date range labels for display
        dateRange: getMonthBoundaries()
    };
}
