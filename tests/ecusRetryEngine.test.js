import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_RETRY_CONFIG,
  calculateBackoffDelay,
  createRetryEngine,
} from '../apps/ecus-bridge/src/retryEngine.js';

function createLogger() {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
}

describe('calculateBackoffDelay', () => {
  it('produces the documented 1s/2s/4s/8s/16s schedule for default config', () => {
    const delays = [1, 2, 3, 4, 5].map((n) => calculateBackoffDelay(n, DEFAULT_RETRY_CONFIG));
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it('caps the delay at maxDelayMs', () => {
    const config = { ...DEFAULT_RETRY_CONFIG };
    // attempt 7 → 1000 * 2^6 = 64000, capped to 60000
    expect(calculateBackoffDelay(7, config)).toBe(60000);
    expect(calculateBackoffDelay(100, config)).toBe(60000);
  });

  it('is monotonically non-decreasing across attempts', () => {
    let previous = -1;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const delay = calculateBackoffDelay(attempt, DEFAULT_RETRY_CONFIG);
      expect(delay).toBeGreaterThanOrEqual(previous);
      previous = delay;
    }
  });

  it('treats attempt 1 as the first step (factor^0)', () => {
    expect(calculateBackoffDelay(1, DEFAULT_RETRY_CONFIG)).toBe(1000);
    // non-positive / non-finite attempts collapse to the first step
    expect(calculateBackoffDelay(0, DEFAULT_RETRY_CONFIG)).toBe(1000);
    expect(calculateBackoffDelay(Number.NaN, DEFAULT_RETRY_CONFIG)).toBe(1000);
  });
});

describe('createRetryEngine.withRetry', () => {
  let sleep;
  let logger;
  let now;

  beforeEach(() => {
    sleep = vi.fn(async () => {});
    logger = createLogger();
    now = () => new Date('2026-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the result without retrying when the operation succeeds', async () => {
    const engine = createRetryEngine({ logger, sleep, now });
    const operation = vi.fn(async () => 'ok');

    await expect(engine.withRetry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('retries transient failures and eventually succeeds', async () => {
    const engine = createRetryEngine({ logger, sleep, now });
    let calls = 0;
    const operation = vi.fn(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error(`transient ${calls}`);
      }
      return 'recovered';
    });

    await expect(engine.withRetry(operation)).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(3);
    // Two failures before success → two backoff sleeps: 1000ms then 2000ms.
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it('logs each retry attempt with timestamp, attempt number, and reason (Req 8.4)', async () => {
    const engine = createRetryEngine({ logger, sleep, now });
    let calls = 0;
    const operation = vi.fn(async () => {
      calls += 1;
      if (calls < 2) {
        throw new Error('connection refused');
      }
      return 'done';
    });

    await engine.withRetry(operation);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [, payload] = logger.warn.mock.calls[0];
    expect(payload).toMatchObject({
      timestamp: '2026-01-01T00:00:00.000Z',
      attempt: 1,
      maxAttempts: 5,
      reason: 'connection refused',
      nextDelayMs: 1000,
    });
  });

  it('throws the last error after exhausting maxAttempts and logs exhaustion', async () => {
    const engine = createRetryEngine({ logger, sleep, now });
    const operation = vi.fn(async () => {
      throw new Error('always fails');
    });

    await expect(engine.withRetry(operation)).rejects.toThrow('always fails');
    expect(operation).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxAttempts);
    // 5 attempts → 4 retry sleeps.
    expect(sleep).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxAttempts - 1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('honours a partial config override', async () => {
    const engine = createRetryEngine({ logger, sleep, now });
    const operation = vi.fn(async () => {
      throw new Error('nope');
    });

    await expect(engine.withRetry(operation, { maxAttempts: 2 })).rejects.toThrow('nope');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-function operation', async () => {
    const engine = createRetryEngine({ logger, sleep, now });
    await expect(engine.withRetry(null)).rejects.toThrow(TypeError);
  });
});

describe('createRetryEngine queue methods (deferred to task 10.3)', () => {
  it('throws a clear not-implemented error when no queue adapter is injected', async () => {
    const engine = createRetryEngine({ logger: createLogger() });
    await expect(engine.enqueue({})).rejects.toThrow(/not implemented/i);
    await expect(engine.processQueue()).rejects.toThrow(/not implemented/i);
    await expect(engine.getQueueDepth()).rejects.toThrow(/not implemented/i);
  });

  it('delegates to an injected queue adapter when provided', async () => {
    const queue = {
      enqueue: vi.fn(async () => 'id-1'),
      processQueue: vi.fn(async () => ({ processed: 0 })),
      getQueueDepth: vi.fn(async () => 3),
    };
    const engine = createRetryEngine({ logger: createLogger(), queue });

    await expect(engine.enqueue({ foo: 1 })).resolves.toBe('id-1');
    await expect(engine.processQueue()).resolves.toEqual({ processed: 0 });
    await expect(engine.getQueueDepth()).resolves.toBe(3);
    expect(queue.enqueue).toHaveBeenCalledWith({ foo: 1 });
  });
});
