import { describe, expect, it } from "vitest";

import { MST_ASSIGNMENT_STATUS } from "@/lib/mstAssignments.js";
import { buildStatusViewModel } from "@/components/mst-assignment/model/statusViewModel.js";

describe("buildStatusViewModel", () => {
  it("chuẩn hóa status value và đánh dấu assigned khi đủ đầu mối", () => {
    expect(
      buildStatusViewModel({
        status: " Đã gán nhân viên ",
        person_import: "Nguyễn Văn A",
        person_export: "Trần Thị B",
      })
    ).toEqual({
      statusValue: MST_ASSIGNMENT_STATUS.ASSIGNED,
      statusDisplay: MST_ASSIGNMENT_STATUS.ASSIGNED,
      isStatusAssigned: true,
      isStatusPending: false,
      isStatusWarning: false,
    });
  });

  it("đánh dấu pending khi chưa gán đủ đầu mối", () => {
    expect(
      buildStatusViewModel({
        status: "CHƯA GÁN NHÂN VIÊN",
        person_import: "",
        person_export: "",
      })
    ).toEqual({
      statusValue: MST_ASSIGNMENT_STATUS.PENDING,
      statusDisplay: MST_ASSIGNMENT_STATUS.PENDING,
      isStatusAssigned: false,
      isStatusPending: true,
      isStatusWarning: false,
    });
  });

  it("đánh dấu warning khi computeStatusDisplay trả về cảnh báo thiếu người phụ trách", () => {
    expect(
      buildStatusViewModel({
        status: MST_ASSIGNMENT_STATUS.PENDING,
        person_import: "",
        person_export: "Trần Thị B",
      })
    ).toEqual({
      statusValue: MST_ASSIGNMENT_STATUS.PENDING,
      statusDisplay: "Thiếu người phụ trách nhập",
      isStatusAssigned: false,
      isStatusPending: false,
      isStatusWarning: true,
    });
  });
});
