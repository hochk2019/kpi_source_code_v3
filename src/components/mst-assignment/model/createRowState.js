import { makeRowKey, tidyMST } from "./rowIdentity.js";
import { computeStoredStatus } from "./statusDate.js";

export const createRowState = (row, meta = {}) => {
  const mstValue = tidyMST(row?.mst || "");

  const base = {
    mst: mstValue,
    company: String(row?.company || "").trim(),
    person_import: String(row?.person_import || "").trim(),
    person_export: String(row?.person_export || "").trim(),
    team: String(row?.team || "").trim(),
    effective_from: row?.effective_from || "",
    effective_to: row?.effective_to || "",
    status: "",
  };

  base.status = computeStoredStatus(base);

  const originalKey = meta.originalKey ?? (meta.isNew ? null : makeRowKey(base));

  return {
    ...base,
    __originalKey: originalKey,
    __isNew: Boolean(meta.isNew),
  };
};
