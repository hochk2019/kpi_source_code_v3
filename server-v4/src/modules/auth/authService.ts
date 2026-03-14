import bcrypt from 'bcryptjs';

import { isAdminRole, mergePermissions, normalizeRoleKey } from '../../../../packages/domain/src/accountRoles.js';
import type { AuthStore } from './authStore.js';
import {
  MIN_PASSWORD_LENGTH,
  normalizeDisplayName,
  normalizeNullableText,
  normalizeStoredAccountRecord,
  sanitizeAuthAccount,
  sortAuthAccounts,
  toUsernameKey,
} from './authShared.js';
import type { AuthAccountRecord, AuthAccountView } from './authTypes.js';

export type LoginPayload = {
  username: string;
  password: string;
};

type PermissionOverrides = Partial<Record<string, boolean | undefined>>;

export type CreateAccountPayload = {
  username: string;
  password: string;
  role?: string;
  name?: string;
  permissions?: PermissionOverrides;
  memberId?: string | null;
  memberName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
};

export type UpdateAccountPayload = {
  role?: string;
  name?: string;
  permissions?: PermissionOverrides;
  memberId?: string | null;
  memberName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
};

export class AuthHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthHttpError';
  }
}

export class AuthService {
  constructor(private readonly authStore: AuthStore) {}

  async login(payload: LoginPayload): Promise<{
    user: AuthAccountView;
    token: string;
    expiresAt: number;
  }> {
    const accounts = await this.authStore.listAccounts();
    const account = findAccount(accounts, payload.username);
    if (!account) {
      throw new AuthHttpError(401, 'invalid_credentials', 'Sai tài khoản hoặc mật khẩu.');
    }

    const ok = await bcrypt.compare(payload.password, account.passwordHash);
    if (!ok) {
      throw new AuthHttpError(401, 'invalid_credentials', 'Sai tài khoản hoặc mật khẩu.');
    }

    await this.authStore.deleteSessionsForUser(account.username);
    const session = await this.authStore.createSession(account.username);

    return {
      user: sanitizeAuthAccount(account)!,
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  async restoreSession(token: string): Promise<{
    user: AuthAccountView | null;
    expiresAt: number | null;
    clearCookie: boolean;
  }> {
    const context = await this.readSessionAccount(token);
    if (!context) {
      return {
        user: null,
        expiresAt: null,
        clearCookie: Boolean(`${token ?? ''}`.trim()),
      };
    }

    return {
      user: sanitizeAuthAccount(context.account),
      expiresAt: context.expiresAt,
      clearCookie: false,
    };
  }

  async logout(token: string): Promise<void> {
    if (`${token ?? ''}`.trim()) {
      await this.authStore.deleteSession(token);
    }
  }

  async listAccounts(token: string): Promise<{ accounts: AuthAccountView[] }> {
    await this.requireAccountManager(token);
    const accounts = await this.authStore.listAccounts();

    return {
      accounts: accounts.map((entry) => sanitizeAuthAccount(entry)!).filter(Boolean),
    };
  }

  async createAccount(token: string, payload: CreateAccountPayload): Promise<{
    account: AuthAccountView;
    accounts: AuthAccountView[];
  }> {
    await this.requireAccountManager(token);
    const accounts = await this.authStore.listAccounts();
    const username = `${payload.username ?? ''}`.trim();

    if (!username) {
      throw new AuthHttpError(400, 'invalid_request', 'Thiếu tài khoản cần tạo.');
    }
    if (payload.password.trim().length < MIN_PASSWORD_LENGTH) {
      throw new AuthHttpError(
        400,
        'invalid_request',
        `Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`,
      );
    }
    if (findAccount(accounts, username)) {
      throw new AuthHttpError(409, 'conflict', 'Tài khoản đã tồn tại.');
    }

    const role = normalizeRoleKey(payload.role);
    const nextAccount = normalizeStoredAccountRecord({
      username,
      passwordHash: bcrypt.hashSync(payload.password.trim(), 10),
      role,
      name: normalizeDisplayName(payload.name, username),
      permissions: mergePermissions(role, payload.permissions),
      updatedAt: new Date().toISOString(),
      ...resolveMemberFields(payload, null),
    });

    if (!nextAccount) {
      throw new AuthHttpError(400, 'invalid_request', 'Không thể tạo tài khoản.');
    }

    const nextAccounts = [...accounts, nextAccount];
    sortAuthAccounts(nextAccounts);
    await this.authStore.saveAccounts(nextAccounts);

    return {
      account: sanitizeAuthAccount(nextAccount)!,
      accounts: nextAccounts.map((entry) => sanitizeAuthAccount(entry)!).filter(Boolean),
    };
  }

  async updateAccount(
    token: string,
    usernameInput: string,
    payload: UpdateAccountPayload,
  ): Promise<{
    account: AuthAccountView;
    accounts: AuthAccountView[];
  }> {
    await this.requireAccountManager(token);
    const accounts = await this.authStore.listAccounts();
    const username = `${usernameInput ?? ''}`.trim();
    const currentIndex = accounts.findIndex(
      (entry) => toUsernameKey(entry.username) === toUsernameKey(username),
    );

    if (currentIndex < 0) {
      throw new AuthHttpError(404, 'not_found', 'Không tìm thấy tài khoản.');
    }

    const current = accounts[currentIndex];
    const currentRole = normalizeRoleKey(current.role);
    const nextRole = normalizeRoleKey(payload.role ?? current.role);

    if (currentRole === 'admin' && nextRole !== 'admin' && countAdmins(accounts) <= 1) {
      throw new AuthHttpError(400, 'invalid_request', 'Cần ít nhất một quản trị viên.');
    }

    const nextAccount = normalizeStoredAccountRecord({
      ...current,
      role: nextRole,
      name: payload.name !== undefined ? normalizeDisplayName(payload.name, current.username) : current.name,
      permissions: mergePermissions(nextRole, payload.permissions ?? current.permissions),
      updatedAt: new Date().toISOString(),
      ...resolveMemberFields(payload, current),
    });

    if (!nextAccount) {
      throw new AuthHttpError(400, 'invalid_request', 'Không thể cập nhật tài khoản.');
    }

    accounts[currentIndex] = nextAccount;
    sortAuthAccounts(accounts);
    await this.authStore.saveAccounts(accounts);

    return {
      account: sanitizeAuthAccount(nextAccount)!,
      accounts: accounts.map((entry) => sanitizeAuthAccount(entry)!).filter(Boolean),
    };
  }

  private async requireAccountManager(token: string): Promise<AuthAccountRecord> {
    const session = await this.requireAuthenticatedAccount(token);
    if (!isAdminRole(session.role)) {
      throw new AuthHttpError(403, 'forbidden', 'Chỉ tài khoản quản trị mới được phép quản lý tài khoản.');
    }
    if (!session.permissions.accountManage) {
      throw new AuthHttpError(403, 'forbidden', 'Tài khoản hiện chưa được cấp quyền quản lý tài khoản.');
    }
    return session;
  }

  private async requireAuthenticatedAccount(token: string): Promise<AuthAccountRecord> {
    const context = await this.readSessionAccount(token);
    if (!context) {
      throw new AuthHttpError(401, 'auth_required', 'Bạn cần đăng nhập bằng tài khoản quản trị.');
    }
    return context.account;
  }

  private async readSessionAccount(token: string): Promise<{
    account: AuthAccountRecord;
    expiresAt: number;
  } | null> {
    const normalizedToken = `${token ?? ''}`.trim();
    if (!normalizedToken) {
      return null;
    }

    const session = await this.authStore.readSession(normalizedToken);
    if (!session) {
      return null;
    }
    if (session.expiresAt <= Date.now()) {
      await this.authStore.deleteSession(normalizedToken);
      return null;
    }

    const accounts = await this.authStore.listAccounts();
    const account = findAccount(accounts, session.username);
    if (!account) {
      await this.authStore.deleteSession(normalizedToken);
      return null;
    }

    return {
      account,
      expiresAt: session.expiresAt,
    };
  }
}

function findAccount(
  accounts: readonly AuthAccountRecord[],
  usernameInput: string,
): AuthAccountRecord | null {
  const usernameKey = toUsernameKey(usernameInput);
  return accounts.find((entry) => toUsernameKey(entry.username) === usernameKey) ?? null;
}

function countAdmins(accounts: readonly AuthAccountRecord[]): number {
  return accounts.filter((entry) => isAdminRole(entry.role)).length;
}

function resolveMemberFields(
  payload: UpdateAccountPayload | CreateAccountPayload,
  current: AuthAccountRecord | null,
) {
  const hasMemberId = Object.prototype.hasOwnProperty.call(payload, 'memberId');
  const hasMemberName = Object.prototype.hasOwnProperty.call(payload, 'memberName');
  const hasTeamId = Object.prototype.hasOwnProperty.call(payload, 'teamId');
  const hasTeamName = Object.prototype.hasOwnProperty.call(payload, 'teamName');

  if (!hasMemberId && !hasMemberName && !hasTeamId && !hasTeamName && current) {
    return {
      memberId: current.memberId,
      memberName: current.memberName,
      teamId: current.teamId,
      teamName: current.teamName,
    };
  }

  const memberId = hasMemberId
    ? normalizeNullableText(payload.memberId, 160)
    : current?.memberId ?? null;
  if (!memberId) {
    return {
      memberId: null,
      memberName: null,
      teamId: null,
      teamName: null,
    };
  }

  return {
    memberId,
    memberName: hasMemberName
      ? normalizeNullableText(payload.memberName, 255)
      : current?.memberName ?? null,
    teamId: hasTeamId ? normalizeNullableText(payload.teamId, 160) : current?.teamId ?? null,
    teamName: hasTeamName
      ? normalizeNullableText(payload.teamName, 255)
      : current?.teamName ?? null,
  };
}
