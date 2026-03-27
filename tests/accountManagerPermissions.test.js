import { describe, expect, it } from "vitest";

import {
  buildGroupedPermissions,
  buildPermissionDefinitions,
} from "@/components/account-manager/accountManagerPermissions.js";

describe("accountManagerPermissions", () => {
  it("buildPermissionDefinitions dùng metadata và đẩy quyền không rõ xuống cuối", () => {
    const definitions = buildPermissionDefinitions([
      "accountManage",
      "alertsManage",
      "customPermission",
    ]);

    expect(definitions.map((item) => item.key)).toEqual([
      "alertsManage",
      "accountManage",
      "customPermission",
    ]);
    expect(definitions[2]).toEqual(
      expect.objectContaining({
        key: "customPermission",
        label: "customPermission",
        category: "Khác",
      })
    );
  });

  it("buildGroupedPermissions nhóm theo category và sắp xếp label trong từng nhóm", () => {
    const groups = buildGroupedPermissions([
      { key: "b", label: "Báo cáo B", description: "", category: "Báo cáo & giám sát" },
      { key: "a", label: "Báo cáo A", description: "", category: "Báo cáo & giám sát" },
      { key: "c", label: "Cảnh báo", description: "", category: "Giám sát dữ liệu" },
    ]);

    expect(groups.map((group) => group.category)).toEqual([
      "Giám sát dữ liệu",
      "Báo cáo & giám sát",
    ]);
    expect(groups[1].items.map((item) => item.label)).toEqual(["Báo cáo A", "Báo cáo B"]);
  });
});
