import { DEFAULT_ROLE, getPermissionTemplate } from "@/auth/localAuth.js";

export function createEmptyAccountForm() {
  return {
    username: "",
    name: "",
    password: "",
    role: DEFAULT_ROLE,
    permissions: getPermissionTemplate(DEFAULT_ROLE),
    memberId: "",
    memberName: "",
    teamId: "",
    teamName: "",
  };
}
