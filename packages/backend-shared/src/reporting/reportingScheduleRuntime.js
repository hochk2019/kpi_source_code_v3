import { listReportingSchedules } from './reportingReadModels.js';
import {
  DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY,
} from '../persistence/reportingProjectionStore.js';
import {
  removeReportingSchedule,
  upsertReportingSchedule,
} from './reportingScheduleMutations.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function createReportingScheduleRuntime(options = {}) {
  const projectionStore = options.projectionStore;
  if (!projectionStore) {
    throw new Error('createReportingScheduleRuntime() requires projectionStore.');
  }

  const aggregateRuntime = options.aggregateRuntime;
  if (!aggregateRuntime) {
    throw new Error('createReportingScheduleRuntime() requires aggregateRuntime.');
  }

  const buildSourceSnapshot =
    typeof options.buildSourceSnapshot === 'function'
      ? options.buildSourceSnapshot
      : () => aggregateRuntime.readRawReportingSourceSnapshot();
  const listReportingSchedulesImpl = options.listReportingSchedules ?? listReportingSchedules;
  const upsertReportingScheduleImpl = options.upsertReportingSchedule ?? upsertReportingSchedule;
  const removeReportingScheduleImpl = options.removeReportingSchedule ?? removeReportingSchedule;
  const defaultAggregateSnapshotKey =
    normalizeText(options.defaultAggregateSnapshotKey) ||
    DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY;

  function readSchedules(query = {}, options = {}) {
    const actor = options.actor || 'system';
    const defaultAggregate =
      aggregateRuntime.readStoredMonthlyReportingAggregateSnapshot(defaultAggregateSnapshotKey) ||
      aggregateRuntime.materializeDefaultMonthlyReportingAggregateSnapshot(buildSourceSnapshot, {
        actor,
        source: options.source || 'reporting-monthly-aggregates-default-schedules',
      });
    const schedules = listReportingSchedulesImpl(projectionStore.readScheduleEntries(), {
      asOf: query?.asOf,
    });

    return {
      ...schedules,
      aggregateStatus: aggregateRuntime.buildMonthlyReportingAggregateStatus(defaultAggregate),
    };
  }

  function saveSchedule(entry, options = {}) {
    const actor = options.actor || 'system';
    const currentSchedules = projectionStore.readScheduleEntries();
    const { saved, items } = upsertReportingScheduleImpl(currentSchedules, entry, {
      actor,
    });

    projectionStore.writeScheduleEntries(items, {
      actor,
      source: options.source || 'reporting-schedules-api',
    });

    return {
      total: items.length,
      item: saved,
    };
  }

  function deleteSchedule(id, options = {}) {
    const actor = options.actor || 'system';
    const currentSchedules = projectionStore.readScheduleEntries();
    const { deleted, items } = removeReportingScheduleImpl(currentSchedules, id);

    if (!deleted) {
      return {
        deleted: false,
        total: currentSchedules.length,
      };
    }

    projectionStore.writeScheduleEntries(items, {
      actor,
      source: options.source || 'reporting-schedules-api-delete',
    });

    return {
      deleted: true,
      total: items.length,
    };
  }

  return {
    readSchedules,
    saveSchedule,
    deleteSchedule,
  };
}
