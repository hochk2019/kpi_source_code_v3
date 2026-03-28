import React from 'react';

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';



import AuditLog from '@/components/AuditLog.jsx';

import { AUDIT_KEY } from '@/lib/store.js';

import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';

import * as auth from '@/auth/localAuth.js';



const SUCCESS_SUMMARY = {

  schedule: {

    cron: '0 3 * * *',

    cronDescription: 'VA?o 03:00 h???ng ngA?y',

    retentionCopies: 14,

    directory: '/var/backups/kpi',

    directoryRaw: '/var/backups/kpi',

    active: false,

    reasons: ['cron_disabled_env'],

    lastError: null,

    refreshedAt: '2024-05-01T00:00:00.000Z',

    nextRun: '2024-05-01T03:00:00.000Z',

    nextRunHuman: '03:00 Th??c T??, 01/05/2024',

  },

  lastSuccess: {

    ts: '2024-05-01T03:00:00.000Z',

    actor: 'system',

    action: 'db.backup',

    detail: 'Sao l??u CSDL (scheduled)',

    meta: { status: 'success', reason: 'scheduled', bytes: 40960 },

  },

  lastFailure: {

    ts: '2024-05-01T02:00:00.000Z',

    actor: 'system',

    action: 'db.backup',

    detail: 'Sao l??u CSDL th???t b???i (memory_db)',

    meta: { status: 'failure', reason: 'memory_db' },

  },

  recent: [],

};



describe('AuditLog', () => {

  let fetchSpy;



  beforeEach(() => {

    clearStorageCache();

    sharedSetItem(

      AUDIT_KEY,

      JSON.stringify([

        {

          ts: '2024-05-01T03:00:00.000Z',

          actor: 'system',

          action: 'db.backup',

          detail: 'Sao l??u CSDL (scheduled)',

        },

      ])

    );

    fetchSpy = vi.spyOn(auth, 'fetchWithAuth').mockResolvedValue({

      ok: true,

      json: async () => ({ ok: true, summary: SUCCESS_SUMMARY }),

    });

  });



  afterEach(() => {

    cleanup();

    vi.restoreAllMocks();

  });



  it('render cron summary using API data', async () => {

    render(<AuditLog currentUser={{ username: 'admin' }} />);



    expect(fetchSpy).toHaveBeenCalledWith(

      '/api/admin/backups/summary',

      expect.objectContaining({ cache: 'no-store' })

    );



    await screen.findByText('0 3 * * *');

    expect(screen.getByText('/var/backups/kpi')).toBeInTheDocument();

    expect(screen.getByText(/KPI_DISABLE_CRON/)).toBeInTheDocument();

  });



  it('shows error banner when summary request fails', async () => {

    fetchSpy.mockResolvedValueOnce({

      ok: false,

      status: 500,

      statusText: 'Internal Server Error',

      json: async () => ({}),

    });



    render(<AuditLog currentUser={{ username: 'admin' }} />);



    await waitFor(() => {

      expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument();

    });

  });



  it('submits updated cron schedule', async () => {

    const summaryResponse = {

      ok: true,

      json: async () => ({ ok: true, summary: SUCCESS_SUMMARY }),

    };

    const newDirectory = 'D\\\\Custom\\\\KPI';

    const updateResponse = {

      ok: true,

      json: async () => ({

        ok: true,

        config: { cron: '*/30 * * * *', retentionCopies: 7, directory: newDirectory, directoryRaw: newDirectory },

        summary: {

          ...SUCCESS_SUMMARY,

          schedule: {

            ...SUCCESS_SUMMARY.schedule,

            cron: '*/30 * * * *',

            retentionCopies: 7,

            active: true,

            reasons: [],

            directory: newDirectory,

            directoryRaw: newDirectory,

          },

        },

      }),

    };

    fetchSpy.mockImplementation((url) => {

      if (url === '/api/admin/backups/summary') {

        return Promise.resolve(summaryResponse);

      }

      if (url === '/api/admin/backups/files') {

        return Promise.resolve({

          ok: true,

          json: async () => ({ ok: true, files: [] }),

        });

      }

      if (url === '/api/admin/backups/schedule') {

        return Promise.resolve(updateResponse);

      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));

    });



    render(

      <AuditLog

        currentUser={{

          username: 'admin',

          role: 'admin',

          permissions: { accountManage: true },

        }}

      />

    );



    const cronInput = await screen.findByLabelText((label) => label.toLowerCase().includes('cron'));

    await waitFor(() => {

      expect(cronInput).toHaveValue('0 3 * * *');

    });



    fireEvent.change(cronInput, { target: { value: '*/30 * * * *' } });

    const retentionInput = await screen.findByLabelText('Số bản sao lưu giữ lại');

    fireEvent.change(retentionInput, { target: { value: '7' } });

    const [directoryInput, manualDirectoryInput] = await screen.findAllByLabelText((label) =>

      label.toLowerCase().includes('thư mục sao lưu')

    );

    await waitFor(() => {

      expect(directoryInput).toHaveValue('/var/backups/kpi');

    });

    fireEvent.change(directoryInput, { target: { value: newDirectory } });

    await waitFor(() => {

      expect(directoryInput).toHaveValue(newDirectory);

    });

    fireEvent.submit(cronInput.closest('form'));



    const scheduleCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');

    expect(scheduleCall).toBeDefined();

    const [, scheduleInit] = scheduleCall ?? [];

    expect(JSON.parse(scheduleInit.body)).toEqual({ cron: '*/30 * * * *', retentionCopies: 7, directory: newDirectory });

    expect(screen.getByDisplayValue('*/30 * * * *')).toBeInTheDocument();

    expect(screen.getByDisplayValue('7')).toBeInTheDocument();

    await waitFor(() => {

      expect(directoryInput).toHaveValue(newDirectory);

      expect(manualDirectoryInput).toHaveValue(newDirectory);

    });

  });

});

