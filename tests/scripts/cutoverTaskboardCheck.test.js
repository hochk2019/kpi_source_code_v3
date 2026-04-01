import { describe, expect, it } from "vitest";

import {
  parseCutoverTaskboard,
  validateCutoverTaskboard,
} from "../../scripts/check-cutover-taskboard.mjs";

function createRows() {
  const markdown = `
| Task ID | Bead ID | Owner | Dependency | Status | Verify Command | Evidence Path | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CUT-00 | cng-m2r.1 | sam | - | In Progress | pnpm run api:contract:report | docs/operations/v4-cutover-evidence/ | baseline |
| CUT-01 | cng-m2r.2 | sam | CUT-00 | Not Started | pnpm run api:contract:gate | docs/operations/v4-cutover-evidence/ | rollback |
`;
  return parseCutoverTaskboard(markdown);
}

describe("cutover taskboard parser", () => {
  it("parses rows from markdown table", () => {
    const rows = createRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]["Task ID"]).toBe("CUT-00");
    expect(rows[1]["Bead ID"]).toBe("cng-m2r.2");
  });
});

describe("cutover taskboard validation", () => {
  it("passes when board/beads/dependencies are consistent", () => {
    const rows = createRows();
    const issues = [
      { id: "cng-m2r.1", status: "in_progress", issue_type: "task", labels: ["cutover-hard-gate"] },
      { id: "cng-m2r.2", status: "open", issue_type: "task", labels: ["cutover-hard-gate"] },
    ];
    const result = validateCutoverTaskboard({
      rows,
      issues,
      consistency: { ok: true, output: "" },
    });
    expect(result.errors).toEqual([]);
  });

  it("fails when done task is missing verify or evidence", () => {
    const rows = parseCutoverTaskboard(`
| Task ID | Bead ID | Owner | Dependency | Status | Verify Command | Evidence Path | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CUT-00 | cng-m2r.1 | sam | - | Done | - | - | rollback |
`);
    const issues = [
      { id: "cng-m2r.1", status: "closed", issue_type: "task", labels: ["cutover-hard-gate"] },
    ];
    const result = validateCutoverTaskboard({
      rows,
      issues,
      consistency: { ok: true, output: "" },
    });
    expect(result.errors.join(" ")).toMatch(/thieu Verify Command/i);
    expect(result.errors.join(" ")).toMatch(/thieu Evidence Path/i);
  });

  it("fails when dependency is not done but downstream started", () => {
    const rows = parseCutoverTaskboard(`
| Task ID | Bead ID | Owner | Dependency | Status | Verify Command | Evidence Path | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CUT-00 | cng-m2r.1 | sam | - | In Progress | cmd | docs/operations/v4-cutover-evidence/ | rollback |
| CUT-01 | cng-m2r.2 | sam | CUT-00 | In Progress | cmd | docs/operations/v4-cutover-evidence/ | rollback |
`);
    const issues = [
      { id: "cng-m2r.1", status: "in_progress", issue_type: "task", labels: ["cutover-hard-gate"] },
      { id: "cng-m2r.2", status: "in_progress", issue_type: "task", labels: ["cutover-hard-gate"] },
    ];
    const result = validateCutoverTaskboard({
      rows,
      issues,
      consistency: { ok: true, output: "" },
    });
    expect(result.errors.join(" ")).toMatch(/dependency CUT-00 chua Done/i);
  });

  it("fails when open cutover bead has no board row", () => {
    const rows = parseCutoverTaskboard(`
| Task ID | Bead ID | Owner | Dependency | Status | Verify Command | Evidence Path | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CUT-00 | cng-m2r.1 | sam | - | In Progress | cmd | docs/operations/v4-cutover-evidence/ | rollback |
`);
    const issues = [
      { id: "cng-m2r.1", status: "in_progress", issue_type: "task", labels: ["cutover-hard-gate"] },
      { id: "cng-m2r.2", status: "open", issue_type: "task", labels: ["cutover-hard-gate"] },
    ];
    const result = validateCutoverTaskboard({
      rows,
      issues,
      consistency: { ok: true, output: "" },
    });
    expect(result.errors.join(" ")).toMatch(/khong co dong trong board/i);
  });

  it("fails when bd consistency check fails", () => {
    const rows = createRows();
    const issues = [
      { id: "cng-m2r.1", status: "in_progress", issue_type: "task", labels: ["cutover-hard-gate"] },
      { id: "cng-m2r.2", status: "open", issue_type: "task", labels: ["cutover-hard-gate"] },
    ];
    const result = validateCutoverTaskboard({
      rows,
      issues,
      consistency: { ok: false, output: "mismatch" },
    });
    expect(result.errors.join(" ")).toMatch(/check-bd-consistency fail/i);
  });
});

