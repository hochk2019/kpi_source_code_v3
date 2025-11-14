import { describe, expect, it } from 'vitest';

import {

  ACCOUNT_PERMISSION_KEYS,

  ADMIN_ROLE,

  MANAGER_ROLE,

  TEAM_LEAD_ROLE,

  DEFAULT_ROLE,

  getPermissionTemplate,

} from '@/shared/accountRoles.js';



const REQUIRED_KEYS = ['aiAssistUse', 'aiAssistManage'];



describe('accountRoles – quyền trợ lý AI', () => {

  it('phải khai báo đầy đủ khóa quyền AI trong danh sách ACCOUNT_PERMISSION_KEYS', () => {

    for (const key of REQUIRED_KEYS) {

      expect(ACCOUNT_PERMISSION_KEYS).toContain(key);

    }

  });



  it('nhân viên được phép sử dụng AI nhưng không được cấu hình', () => {

    const perms = getPermissionTemplate(DEFAULT_ROLE);

    expect(perms.aiAssistUse).toBe(true);

    expect(perms.aiAssistManage).toBe(false);

  });



  it('trưởng nhóm được phép sử dụng AI nhưng không được cấu hình', () => {

    const perms = getPermissionTemplate(TEAM_LEAD_ROLE);

    expect(perms.aiAssistUse).toBe(true);

    expect(perms.aiAssistManage).toBe(false);

  });



  it('quản lý có thể sử dụng và cấu hình AI', () => {

    const perms = getPermissionTemplate(MANAGER_ROLE);

    expect(perms.aiAssistUse).toBe(true);

    expect(perms.aiAssistManage).toBe(true);

  });



  it('quản trị viên có toàn quyền AI', () => {

    const perms = getPermissionTemplate(ADMIN_ROLE);

    expect(perms.aiAssistUse).toBe(true);

    expect(perms.aiAssistManage).toBe(true);

  });

});



describe('accountRoles – quyền import upload', () => {

  it('khai báo khóa importUpload trong ACCOUNT_PERMISSION_KEYS', () => {

    expect(ACCOUNT_PERMISSION_KEYS).toContain('importUpload');

  });



  it('mẫu quyền mặc định không cấp phép upload cho nhân viên và trưởng nhóm', () => {

    expect(getPermissionTemplate(DEFAULT_ROLE).importUpload).toBe(false);

    expect(getPermissionTemplate(TEAM_LEAD_ROLE).importUpload).toBe(false);

  });



  it('quản lý và quản trị viên được cấp phép upload import', () => {

    expect(getPermissionTemplate(MANAGER_ROLE).importUpload).toBe(true);

    expect(getPermissionTemplate(ADMIN_ROLE).importUpload).toBe(true);

  });

});



