import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';

import userEvent from '@testing-library/user-event';

import React from 'react';



import AccountManager from '@/components/AccountManager.jsx';

import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';

import { TEAM_KEY } from '@/lib/store.js';

import { installMockApi } from './helpers/mockApi.js';



function ensureTestGlobals() {

  if (!globalThis.ResizeObserver) {

    vi.stubGlobal('ResizeObserver', class {

      observe() {}

      unobserve() {}

      disconnect() {}

    });

  }

  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {

    Element.prototype.scrollIntoView = () => {};

  }

}



describe('AccountManager – gắn nhân viên KPI', () => {

  let alertMock;

  let fetchMock;



  beforeEach(() => {

    ensureTestGlobals();

    clearStorageCache();

    fetchMock = installMockApi();

    alertMock = vi.fn();

    vi.stubGlobal('alert', alertMock);

    vi.stubGlobal('prompt', vi.fn(() => 'MatKhauMoi!'));

    vi.stubGlobal('confirm', vi.fn(() => true));

    sharedSetItem(

      TEAM_KEY,

      JSON.stringify({

        version: 1,

        teams: [

          {

            id: 'team-a',

            name: 'Tổ Thuế A',

            members: [

              { id: 'mem-1', name: 'Nguyễn Văn A' },

              { id: 'mem-2', name: 'Trần Bình' },

            ],

          },

          {

            id: 'team-b',

            name: 'Tổ Nhập khẩu',

            members: [{ id: 'mem-3', name: 'Phạm Hải' }],

          },

        ],

      })

    );

  });



  afterEach(() => {

    vi.unstubAllGlobals();

  });



  it('cho phép gắn và bỏ gắn nhân viên KPI cho tài khoản sẵn có', async () => {

    const user = userEvent.setup();

    render(<AccountManager currentUser={{ username: 'admin' }} />);



    const table = await screen.findByRole('table');

    const dataRows = within(table)

      .getAllByRole('row')

      .slice(1)

      .filter((row) => within(row).queryByText('nhanvien'));

    expect(dataRows.length).toBeGreaterThan(0);

    const accountRow = dataRows[0];



    const staffButton = within(accountRow).getByRole('button', {

      name: 'Nhân viên KPI cho nhanvien',

    });



    await user.click(staffButton);

    const memberOption = await screen.findByText('Nguyễn Văn A');

    await user.click(memberOption);



    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Đã cập nhật nhân viên gắn với tài khoản.'));



    const patchCalls = fetchMock.mock.calls.filter(

      ([url, init]) => url.includes('/api/auth/accounts/nhanvien') && (init?.method || 'GET') === 'PATCH'

    );

    expect(patchCalls.length).toBeGreaterThanOrEqual(1);

    const firstBody = JSON.parse(patchCalls[0][1]?.body ?? '{}');

    expect(firstBody).toEqual(

      expect.objectContaining({

        memberId: 'mem-1',

        memberName: 'Nguyễn Văn A',

        teamId: 'team-a',

        teamName: 'Tổ Thuế A',

        actor: 'admin',

      })

    );



    await waitFor(() =>

      expect(within(accountRow).getByText(/Đang gắn với Nguyễn Văn A/i)).toBeInTheDocument()

    );



    const reopenButton = within(accountRow).getByRole('button', {

      name: 'Nhân viên KPI cho nhanvien',

    });

    await user.click(reopenButton);

    const clearOption = await screen.findByText('Không gắn nhân viên');

    await user.click(clearOption);



    await waitFor(() => expect(alertMock).toHaveBeenCalledTimes(2));



    const latestPatch = fetchMock.mock.calls

      .filter(([url, init]) => url.includes('/api/auth/accounts/nhanvien') && (init?.method || 'GET') === 'PATCH')

      .pop();

    const latestBody = JSON.parse(latestPatch?.[1]?.body ?? '{}');

    expect(latestBody).toEqual(

      expect.objectContaining({

        memberId: null,

        memberName: null,

        teamId: null,

        teamName: null,

        actor: 'admin',

      })

    );



    await waitFor(() =>

      expect(within(accountRow).getByText(/Chưa gắn nhân viên KPI/i)).toBeInTheDocument()

    );

  });




  it('hiển thị vùng cuộn và hai nút điều hướng trong hộp thoại danh sách quyền', async () => {
    const user = userEvent.setup();
    render(<AccountManager currentUser={{ username: 'admin' }} />);
  
    const tables = await screen.findAllByRole('table');
    expect(tables.length).toBeGreaterThan(0);
    const table = tables[0];
    const dataRows = within(table)
      .getAllByRole('row')
      .slice(1);
    const permissionRow = dataRows.find((row) =>
      within(row).queryByRole('button', { name: 'Danh sách quyền' }),
    );
    const targetRow = permissionRow ?? dataRows[0];
    expect(targetRow).toBeTruthy();
  
    const openButton = within(targetRow).getByRole('button', {
      name: 'Danh sách quyền',
    });
    await user.click(openButton);
  
    const dialog = await screen.findByRole('dialog', { name: 'Quản lý quyền' });
    const scrollAreaRoot = dialog.querySelector('[data-slot="scroll-area"]');
    const viewport = dialog.querySelector('[data-slot="scroll-area-viewport"]');
    const scrollDownButton = within(dialog).getByRole('button', { name: 'Cuộn xuống cuối' });
    const scrollUpButton = within(dialog).getByRole('button', { name: 'Cuộn lên đầu' });
  
    expect(scrollAreaRoot).toBeTruthy();
    expect(viewport).toBeTruthy();
    expect(scrollDownButton).toBeDisabled();
    expect(scrollUpButton).toBeDisabled();
  
  });

});

