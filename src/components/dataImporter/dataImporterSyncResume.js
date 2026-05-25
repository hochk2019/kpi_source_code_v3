import { SYNC_PROGRESS_STEP_DEFS } from "@/components/dataImporter/dataImporterSyncQueue.js";

function normalizeProgressSteps(progressSteps = []) {
  const entries = Array.isArray(progressSteps) ? progressSteps : [];
  return SYNC_PROGRESS_STEP_DEFS.map((stepDef) => {
    const matched = entries.find((entry) => entry?.key === stepDef.key);
    return {
      ...stepDef,
      status: matched?.status || "pending",
      detail: matched?.detail || "",
    };
  });
}

export function resolveNextSyncExecutionStep(progressSteps = []) {
  return normalizeProgressSteps(progressSteps).find((step) => step.status !== "done") || null;
}
