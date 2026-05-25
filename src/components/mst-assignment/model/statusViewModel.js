import { MST_ASSIGNMENT_STATUS } from "@/lib/mstAssignments.js";

import { computeStatusDisplay, normalizeStatusLabel } from "./statusDate.js";

export const buildStatusViewModel = (row) => {
  const statusValue = normalizeStatusLabel(row?.status);
  const statusDisplay = computeStatusDisplay(row);
  const normalizedStatusDisplay = statusDisplay || "";

  return {
    statusValue,
    statusDisplay,
    isStatusAssigned: normalizedStatusDisplay === MST_ASSIGNMENT_STATUS.ASSIGNED,
    isStatusPending:
      normalizedStatusDisplay === MST_ASSIGNMENT_STATUS.PENDING ||
      normalizedStatusDisplay === normalizeStatusLabel(MST_ASSIGNMENT_STATUS.PENDING),
    isStatusWarning: normalizedStatusDisplay.startsWith("Thiếu"),
  };
};
