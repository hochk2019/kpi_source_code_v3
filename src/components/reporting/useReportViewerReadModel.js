import { useCallback, useEffect, useState } from "react";

import { refreshSharedKeys } from "@/lib/storageClient.js";
import { toast } from "@/shared/toast.js";

import {
  createEmptyReportingSchedulesViewModel,
  createEmptyReportingViewModel,
  fetchReportingSchedules,
  fetchReportingViewModel,
  subscribeReportingSchedules,
} from "../../../packages/api-client/src/reportingClient.js";

const defaultDeps = {
  createEmptyReportingSchedulesViewModel,
  createEmptyReportingViewModel,
  fetchReportingSchedules,
  fetchReportingViewModel,
  refreshSharedKeys,
  subscribeReportingSchedules,
  toast,
};

export default function useReportViewerReadModel({
  from,
  to,
  selectedRuleId,
  selectedRuleKey,
  activeRuleId,
  rules,
  refreshKeys,
  deps = defaultDeps,
}) {
  const [version, setVersion] = useState(0);
  const [reloading, setReloading] = useState(false);
  const [scheduleReadModel, setScheduleReadModel] = useState(() =>
    deps.createEmptyReportingSchedulesViewModel(),
  );
  const [report, setReport] = useState(() =>
    deps.createEmptyReportingViewModel({ from, to }, rules),
  );
  const [baselineSummary, setBaselineSummary] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");

  const bumpVersion = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  const handleReloadData = useCallback(async () => {
    if (reloading) {
      return;
    }

    setReloading(true);

    try {
      await deps.refreshSharedKeys(refreshKeys);
      bumpVersion();
      deps.toast.success?.("Đã tải lại dữ liệu báo cáo KPI mới nhất.");
    } catch (error) {
      console.error("Không thể tải lại dữ liệu báo cáo KPI", error);
      deps.toast.error?.(error?.message || "Không thể tải lại dữ liệu báo cáo. Vui lòng thử lại.");
    } finally {
      setReloading(false);
    }
  }, [bumpVersion, deps, refreshKeys, reloading]);

  useEffect(() => {
    let cancelled = false;

    async function loadReportData() {
      setReportLoading(true);
      setReportError("");

      try {
        const query = {
          from,
          to,
          ruleId: selectedRuleId,
        };
        const shouldLoadBaseline = Boolean(activeRuleId) && activeRuleId !== selectedRuleKey;
        const [nextReport, nextBaseline] = await Promise.all([
          deps.fetchReportingViewModel(query, rules),
          shouldLoadBaseline
            ? deps.fetchReportingViewModel(
                {
                  from,
                  to,
                  ruleId: activeRuleId,
                },
                rules,
              )
            : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setReport(nextReport);
        setBaselineSummary(nextBaseline);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Không thể tải read-model báo cáo KPI", error);
        setReport(deps.createEmptyReportingViewModel({ from, to }, rules));
        setBaselineSummary(null);
        setReportError(error?.message || "Không thể tải dữ liệu báo cáo KPI.");
      } finally {
        if (!cancelled) {
          setReportLoading(false);
        }
      }
    }

    loadReportData();

    return () => {
      cancelled = true;
    };
  }, [activeRuleId, deps, from, rules, selectedRuleId, selectedRuleKey, to, version]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = deps.subscribeReportingSchedules((nextSchedules) => {
      if (!cancelled) {
        setScheduleReadModel(nextSchedules);
      }
    });

    async function loadScheduleReadModel() {
      try {
        const nextSchedules = await deps.fetchReportingSchedules();

        if (cancelled) {
          return;
        }

        setScheduleReadModel(nextSchedules);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Không thể tải read-model lịch báo cáo KPI", error);
        setScheduleReadModel(deps.createEmptyReportingSchedulesViewModel());
      }
    }

    loadScheduleReadModel();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [deps, version]);

  return {
    baselineSummary,
    bumpVersion,
    handleReloadData,
    reloading,
    report,
    reportError,
    reportLoading,
    scheduleReadModel,
    version,
  };
}
