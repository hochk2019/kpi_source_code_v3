import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE, getPermissionTemplate } from "@/auth/localAuth.js";
import { createEmptyAccountForm } from "@/components/account-manager/accountManagerFormState.js";

describe("accountManagerFormState", () => {
  it("createEmptyAccountForm trả về draft mặc định cho tài khoản mới", () => {
    expect(createEmptyAccountForm()).toEqual({
      username: "",
      name: "",
      password: "",
      role: DEFAULT_ROLE,
      permissions: getPermissionTemplate(DEFAULT_ROLE),
      memberId: "",
      memberName: "",
      teamId: "",
      teamName: "",
    });
  });
});
