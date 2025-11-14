import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import fs from 'node:fs';

import os from 'node:os';

import path from 'node:path';



const { execFileSyncMock } = vi.hoisted(() => {

  return { execFileSyncMock: vi.fn(() => '') };

});



vi.mock('node:child_process', () => ({

  execFileSync: execFileSyncMock,

}));



async function importModule() {

  return import('../server/ecus/secureCredentials.js');

}



function cleanupEnv() {

  delete process.env.ECUS_SQL_SERVER;

  delete process.env.ECUS_SQL_DATABASE;

  delete process.env.ECUS_SQL_USER;

  delete process.env.ECUS_SQL_PASSWORD;

  delete process.env.ECUS_SQL_SECURE_FILE;

  delete process.env.PWSH_PATH;

}



describe('secureCredentials', () => {

  beforeEach(() => {

    cleanupEnv();

    execFileSyncMock.mockReset();

  });



  afterEach(() => {

    cleanupEnv();

    vi.resetModules();

    vi.restoreAllMocks();

  });



  it('ưu tiên sử dụng biến môi trường khi đã khai báo đầy đủ', async () => {

    process.env.ECUS_SQL_SERVER = '  SRV-01  ';

    process.env.ECUS_SQL_DATABASE = '  ECUS5VNACCS  ';

    process.env.ECUS_SQL_USER = '  syncUser  ';

    process.env.ECUS_SQL_PASSWORD = 'topsecret';



    const module = await importModule();

    module.resetSecureSqlCredentialCache();



    const credentials = module.getSecureSqlCredentials({ forceReload: true });



    expect(credentials).toEqual({

      server: 'SRV-01',

      database: 'ECUS5VNACCS',

      user: 'syncUser',

      password: 'topsecret',

    });

    expect(execFileSyncMock).not.toHaveBeenCalled();

  });



  it('đọc thông tin từ file mã hoá DPAPI khi chạy trên Windows', async () => {

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecus-cred-'));

    const secureFilePath = path.join(tempDir, 'cred.enc');

    fs.writeFileSync(secureFilePath, 'encrypted-payload', 'utf8');



    process.env.ECUS_SQL_SECURE_FILE = secureFilePath;



    const platformSpy = vi.spyOn(os, 'platform').mockReturnValue('win32');

    execFileSyncMock.mockReturnValue(

      '\n{"server":"DPAPI-SRV","database":"ECUS-DB","user":"dpuser","password":"dpsecret"}\n',

    );



    const module = await importModule();

    module.resetSecureSqlCredentialCache();



    const credentials = module.getSecureSqlCredentials({ forceReload: true });



    expect(platformSpy).toHaveBeenCalled();

    expect(execFileSyncMock).toHaveBeenCalled();

    expect(credentials).toEqual({

      server: 'DPAPI-SRV',

      database: 'ECUS-DB',

      user: 'dpuser',

      password: 'dpsecret',

    });

  });



  it('kết hợp dữ liệu từ DPAPI và biến môi trường khi mật khẩu được lấy từ DPAPI', async () => {

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecus-cred-'));

    const secureFilePath = path.join(tempDir, 'cred.enc');

    fs.writeFileSync(secureFilePath, 'encrypted-payload', 'utf8');



    process.env.ECUS_SQL_SERVER = 'SRV-ENV';

    process.env.ECUS_SQL_DATABASE = 'ECUS-ENV';

    process.env.ECUS_SQL_SECURE_FILE = secureFilePath;



    const platformSpy = vi.spyOn(os, 'platform').mockReturnValue('win32');

    execFileSyncMock.mockReturnValue('{"user":"dpUser","password":"fromDpapi"}');



    const module = await importModule();

    module.resetSecureSqlCredentialCache();



    const credentials = module.getSecureSqlCredentials({ forceReload: true });



    expect(platformSpy).toHaveBeenCalled();

    expect(execFileSyncMock).toHaveBeenCalled();

    expect(credentials).toEqual({

      server: 'SRV-ENV',

      database: 'ECUS-ENV',

      user: 'dpUser',

      password: 'fromDpapi',

    });

  });

});

