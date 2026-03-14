export type AuthPermissionMap = Record<string, boolean>;

export interface AuthAccountRecord {
  username: string;
  passwordHash: string;
  role: string;
  name: string;
  permissions: AuthPermissionMap;
  updatedAt: string;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  teamName: string | null;
}

export interface AuthAccountView {
  username: string;
  role: string;
  name: string;
  permissions: AuthPermissionMap;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  teamName: string | null;
}

export interface AuthSessionRecord {
  token: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}
