export const tidyMST = (value) => {
  if (value == null) return "";

  let raw = String(value).trim();
  raw = raw.replace(/[^\d]/g, "");

  return raw;
};

export const makeRowKey = (row) => {
  if (!row) return "";

  return `${row.mst || ""}__${row.effective_from || ""}__${row.effective_to || ""}`;
};
