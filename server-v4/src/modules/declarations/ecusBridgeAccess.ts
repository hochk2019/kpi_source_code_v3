import { timingSafeEqual } from 'node:crypto';

import type { Request } from 'express';

import {
  ADMIN_ROLE,
  MANAGER_ROLE,
  getPermissionTemplate,
  isAdminRole,
  normalizeRoleKey,
} from '../../../../packages/domain/src/accountRoles.js';
import type { AuthStore } from '../auth/authStore.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { DeclarationActor } from './declarationsStore.js';
import { DeclarationsHttpError } from './declarationsService.js';

export async function readEcusBridgeActor(
  req: Request,
  authStore?: AuthStore,
): Promise<DeclarationActor> {
  const authorization = `${req.headers?.authorization ?? ''}`.trim();
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch) {
    return readBearerActor(`${bearerMatch[1] ?? ''}`.trim());
  }

  return readSessionSyncManageActor(authStore, readSessionTokenFromRequest(req));
}

export async function readEcusSyncManageActor(
  req: Request,
  authStore?: AuthStore,
): Promise<DeclarationActor> {
  return readSessionSyncManageActor(authStore, readSessionTokenFromRequest(req));
}

function readBearerActor(receivedToken: string): DeclarationActor {
  const expectedToken = `${process.env.ECUS_BRIDGE_TOKEN ?? process.env.KPI_ECUS_BRIDGE_TOKEN ?? ''}`.trim();
  if (!expectedToken) {
    throw new DeclarationsHttpError(503, 'bridge_unavailable', 'ECUS bridge token chưa được cấu hình.');
  }

  const expectedBuffer = Buffer.from(expectedToken);
  const receivedBuffer = Buffer.from(receivedToken);
  const allowed =
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!allowed) {
    throw new DeclarationsHttpError(403, 'forbidden', 'ECUS bridge token không hợp lệ.');
  }

  return {
    username: 'ecus-bridge-service',
    role: ADMIN_ROLE,
    name: 'ECUS Bridge Service',
    permissions: getPermissionTemplate(ADMIN_ROLE),
    memberId: null,
    memberName: null,
    teamId: null,
    teamName: null,
  };
}

async function readSessionSyncManageActor(
  authStore: AuthStore | undefined,
  sessionToken: string,
): Promise<DeclarationActor> {
  const account = await readSessionAccount(authStore, sessionToken);
  if (!account) {
    throw new DeclarationsHttpError(401, 'auth_required', 'Bạn cần đăng nhập để quản lý đồng bộ ECUS.');
  }

  const role = normalizeRoleKey(account.role);
  if (!(isAdminRole(role) || role === MANAGER_ROLE) || !account.permissions?.syncManage) {
    throw new DeclarationsHttpError(403, 'forbidden', 'Bạn không có quyền quản lý đồng bộ ECUS.');
  }

  return {
    username: account.username,
    role: account.role,
    name: account.name,
    permissions: account.permissions,
    memberId: account.memberId,
    memberName: account.memberName,
    teamId: account.teamId,
    teamName: account.teamName,
  };
}
