import http from 'node:http';

const DEFAULT_HOSTNAME = '127.0.0.1';
const DEFAULT_PORT = 0;
const MAX_BODY_SIZE_BYTES = 1024 * 1024;

function trimToken(value) {
  return `${value ?? ''}`.trim();
}

function readAuthToken(request) {
  const header = trimToken(request.headers.authorization);
  const match = /^Bearer\s+(.+)$/iu.exec(header);
  return match ? trimToken(match[1]) : '';
}

function toJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function ensureHostContract(host) {
  if (!host || typeof host.getStatus !== 'function') {
    throw new Error('Standalone ECUS bridge HTTP server requires host.getStatus()');
  }
  if (typeof host.previewSync !== 'function') {
    throw new Error('Standalone ECUS bridge HTTP server requires host.previewSync()');
  }
  if (typeof host.runSync !== 'function') {
    throw new Error('Standalone ECUS bridge HTTP server requires host.runSync()');
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalLength += buffer.length;
    if (totalLength > MAX_BODY_SIZE_BYTES) {
      const error = new Error('Bridge request body quá lớn.');
      error.code = 'payload_too_large';
      throw error;
    }
    chunks.push(buffer);
  }

  if (!chunks.length) {
    return {};
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('Bridge request body không phải JSON hợp lệ.');
    error.code = 'invalid_json';
    throw error;
  }
}

function ensureAuthorized(request, controlToken) {
  const expectedToken = trimToken(controlToken);
  if (!expectedToken) {
    return null;
  }

  const token = readAuthToken(request);
  if (!token) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        error: 'Thiếu bridge control token.',
      },
    };
  }
  if (token !== expectedToken) {
    return {
      statusCode: 403,
      payload: {
        ok: false,
        error: 'Bridge control token không hợp lệ.',
      },
    };
  }
  return null;
}

function mapRouteError(error) {
  if (error?.code === 'bridge_busy') {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        error: error.message || 'ECUS bridge đang bận.',
        code: 'bridge_busy',
        activeOperation: error.activeOperation || null,
      },
    };
  }
  if (error?.code === 'invalid_json') {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        error: error.message,
        code: 'invalid_json',
      },
    };
  }
  if (error?.code === 'payload_too_large') {
    return {
      statusCode: 413,
      payload: {
        ok: false,
        error: error.message,
        code: 'payload_too_large',
      },
    };
  }
  return {
    statusCode: 500,
    payload: {
      ok: false,
      error: error?.message || 'Standalone ECUS bridge request failed.',
    },
  };
}

export function createStandaloneEcusBridgeHttpHandler({
  host,
  controlToken = '',
} = {}) {
  ensureHostContract(host);

  return async function handleRequest(request, response) {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    const path = requestUrl.pathname;
    const method = request.method || 'GET';

    try {
      if (method === 'GET' && path === '/health') {
        const status = await host.getStatus({ refreshHealth: true });
        const isHealthy = status?.health?.ok !== false;
        return toJson(response, 200, {
          ok: isHealthy,
          service: 'ecus-bridge',
          status,
        });
      }

      if (method === 'GET' && path === '/status') {
        const unauthorized = ensureAuthorized(request, controlToken);
        if (unauthorized) {
          return toJson(response, unauthorized.statusCode, unauthorized.payload);
        }
        const status = await host.getStatus({ refreshHealth: false });
        return toJson(response, 200, {
          ok: true,
          service: 'ecus-bridge',
          status,
        });
      }

      if (method === 'POST' && (path === '/sync/preview' || path === '/sync/run')) {
        const unauthorized = ensureAuthorized(request, controlToken);
        if (unauthorized) {
          return toJson(response, unauthorized.statusCode, unauthorized.payload);
        }
        const payload = await readJsonBody(request);
        const result = path === '/sync/preview'
          ? await host.previewSync(payload)
          : await host.runSync(payload);
        return toJson(response, 200, {
          ok: true,
          result,
        });
      }

      return toJson(response, 404, {
        ok: false,
        error: 'Bridge route không tồn tại.',
      });
    } catch (error) {
      const mapped = mapRouteError(error);
      return toJson(response, mapped.statusCode, mapped.payload);
    }
  };
}

export function createStandaloneEcusBridgeHttpServer({
  host,
  controlToken = '',
  hostname = DEFAULT_HOSTNAME,
  port = DEFAULT_PORT,
  createServerImpl = http.createServer,
} = {}) {
  const handler = createStandaloneEcusBridgeHttpHandler({ host, controlToken });
  const server = createServerImpl(handler);

  return {
    server,
    async start() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, hostname, () => {
          server.off('error', reject);
          resolve();
        });
      });
      const address = server.address();
      const resolvedPort =
        typeof address === 'object' && address
          ? address.port
          : port;
      return {
        host: hostname,
        port: resolvedPort,
        url: `http://${hostname}:${resolvedPort}`,
      };
    },
    async stop() {
      if (!server.listening) {
        return;
      }
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
