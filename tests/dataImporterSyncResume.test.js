import { describe, expect, it } from "vitest";

import { resolveNextSyncExecutionStep } from "@/components/dataImporter/dataImporterSyncResume.js";
import { createSyncProgressSteps } from "@/components/dataImporter/dataImporterSyncQueue.js";

describe("dataImporterSyncResume", () => {
  it("returns the first incomplete sync phase for a resumable job", () => {
    expect(resolveNextSyncExecutionStep(createSyncProgressSteps())).toMatchObject({
      key: "commit",
      label: "Đồng bộ dữ liệu từ ECUS",
    });

    const afterCommit = createSyncProgressSteps().map((step) =>
      step.key === "commit" ? { ...step, status: "done" } : step,
    );
    expect(resolveNextSyncExecutionStep(afterCommit)).toMatchObject({
      key: "reconcile",
      label: "Làm mới cấu hình, trạng thái và cảnh báo",
    });

    const afterReconcile = afterCommit.map((step) =>
      step.key === "reconcile" ? { ...step, status: "done" } : step,
    );
    expect(resolveNextSyncExecutionStep(afterReconcile)).toMatchObject({
      key: "refreshDeclRows",
      label: "Tải lại tờ khai từ server",
    });
  });

  it("returns null once every sync phase is already done", () => {
    const completed = createSyncProgressSteps().map((step) => ({
      ...step,
      status: "done",
    }));

    expect(resolveNextSyncExecutionStep(completed)).toBeNull();
  });
});
