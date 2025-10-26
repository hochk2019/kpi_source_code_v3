import { describe, it, expect } from 'vitest';

import fs from 'node:fs/promises';

import os from 'node:os';

import path from 'node:path';

import { loadAiHttpsConfig } from '../server/https/aiHttpsConfig.js';



describe('loadAiHttpsConfig', () => {

  it('trả về disabled khi thiếu file key/cert', () => {

    const config = loadAiHttpsConfig({

      env: {

        KPI_AI_HTTPS_ENABLED: '1',

        KPI_AI_HTTPS_KEY_PATH: path.join(os.tmpdir(), 'khong-ton-tai.key'),

        KPI_AI_HTTPS_CERT_PATH: path.join(os.tmpdir(), 'khong-ton-tai.crt'),

      },

    });

    expect(config.enabled).toBe(false);

    expect(config.reason).toBe('Thiếu file key/cert');

  });



  it('đọc bundle TLS hợp lệ', async () => {

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-ai-https-'));

    const keyPath = path.join(tmp, 'server.key');

    const certPath = path.join(tmp, 'server.crt');

    await fs.writeFile(keyPath, 'dummy-key');

    await fs.writeFile(certPath, 'dummy-cert');



    try {

      const config = loadAiHttpsConfig({

        env: {

          KPI_AI_HTTPS_ENABLED: '1',

          KPI_AI_HTTPS_KEY_PATH: keyPath,

          KPI_AI_HTTPS_CERT_PATH: certPath,

          KPI_AI_HTTPS_PORT: '6550',

          KPI_AI_HTTPS_HOST: '0.0.0.0',

        },

      });



      expect(config.enabled).toBe(true);

      expect(config.port).toBe(6550);

      expect(config.host).toBe('0.0.0.0');

      expect(config.tlsOptions).toBeDefined();

      expect(config.tlsOptions.key.toString()).toBe('dummy-key');

      expect(config.tlsOptions.cert.toString()).toBe('dummy-cert');

    } finally {

      await fs.rm(tmp, { recursive: true, force: true });

    }

  });

});

