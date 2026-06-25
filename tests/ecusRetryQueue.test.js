/* @vitest-environment node */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRetryQueue } from '../apps/ecus-bridge/src/retryQueue.js';

function createLogger() {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
}

describe('createRetryQueue', () => {
  /** @type {import('better-sqlite3').Database} */
  let db;
  let logger;
  let clock;
  let idCounter;

  beforeEach(() => {
    db = new Database(':memory:');
    logger = createLogger();
    clock = { value: '2026-06-01T00:00:00.000Z' };
    idCounter = 0;
  });

  afterEach(() => {
    db.close();
  });

  function makeQueue(processorFn, opts = {}) {
    return createRetryQueue({
      db,
      processor: processorFn,
      logger,
      now: () => clock.value,
      generateId: () => `id-${++idCounter}`,
      ...opts,
    });
  }

  describe('constructor validation', () => {
    it('throws if db is not provided', () => {
      expect(() => createRetryQueue({ processor: async () => {} })).toThrow(/database handle/i);
    });

    it('throws if processor is not a function', () => {
      expect(() => createRetryQueue({ db })).toThrow(/processor function/i);
    });
  });

  describe('enqueue', () => {
    it('persists a sync request and returns an ID', async () => {
      const queue = makeQueue(async () => {});
      const id = await queue.enqueue({ url: '/sync', body: { rows: [1, 2] } });

      expect(id).toBe('id-1');

      const row = db.prepare('SELECT * FROM ecus_retry_queue WHERE id = ?').get('id-1');
      expect(row).toBeTruthy();
      expect(JSON.parse(row.payload)).toEqual({ url: '/sync', body: { rows: [1, 2] } });
      expect(row.created_at).toBe('2026-06-01T00:00:00.000Z');
      expect(row.status).toBe('pending');
      expect(row.attempt_count).toBe(0);
    });

    it('enqueues multiple items with distinct IDs', async () => {
      const queue = makeQueue(async () => {});
      const id1 = await queue.enqueue({ a: 1 });
      const id2 = await queue.enqueue({ a: 2 });

      expect(id1).not.toBe(id2);
      const count = db.prepare('SELECT COUNT(*) AS c FROM ecus_retry_queue').get();
      expect(count.c).toBe(2);
    });

    it('logs the enqueue event', async () => {
      const queue = makeQueue(async () => {});
      await queue.enqueue({ x: 1 });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('enqueued'),
        expect.objectContaining({ id: 'id-1', createdAt: '2026-06-01T00:00:00.000Z' }),
      );
    });
  });

  describe('getQueueDepth', () => {
    it('returns 0 for an empty queue', async () => {
      const queue = makeQueue(async () => {});
      expect(await queue.getQueueDepth()).toBe(0);
    });

    it('returns the count of pending items', async () => {
      const queue = makeQueue(async () => {});
      await queue.enqueue({ a: 1 });
      await queue.enqueue({ a: 2 });
      await queue.enqueue({ a: 3 });

      expect(await queue.getQueueDepth()).toBe(3);
    });

    it('does not count dead-lettered items', async () => {
      const queue = makeQueue(async () => {});
      await queue.enqueue({ a: 1 });
      // Manually dead-letter one
      db.prepare("UPDATE ecus_retry_queue SET status = 'dead-lettered' WHERE id = 'id-1'").run();
      expect(await queue.getQueueDepth()).toBe(0);
    });
  });

  describe('processQueue — FIFO order (Requirement 8.3, Property 10)', () => {
    it('processes items in createdAt order (earliest first)', async () => {
      const processed = [];
      const processor = vi.fn(async (payload) => {
        processed.push(payload.order);
      });

      const queue = makeQueue(processor);

      // Enqueue in order with distinct timestamps
      clock.value = '2026-06-01T01:00:00.000Z';
      await queue.enqueue({ order: 1 });
      clock.value = '2026-06-01T02:00:00.000Z';
      await queue.enqueue({ order: 2 });
      clock.value = '2026-06-01T03:00:00.000Z';
      await queue.enqueue({ order: 3 });

      await queue.processQueue();

      expect(processed).toEqual([1, 2, 3]);
    });

    it('removes successfully processed items from the queue', async () => {
      const queue = makeQueue(async () => {});
      await queue.enqueue({ x: 1 });
      await queue.enqueue({ x: 2 });

      const result = await queue.processQueue();
      expect(result.processed).toBe(2);
      expect(await queue.getQueueDepth()).toBe(0);
    });

    it('returns correct counts in result', async () => {
      let callCount = 0;
      const processor = vi.fn(async () => {
        callCount++;
        if (callCount === 2) throw new Error('fail');
      });

      const queue = makeQueue(processor);
      await queue.enqueue({ a: 1 });
      await queue.enqueue({ a: 2 });
      await queue.enqueue({ a: 3 });

      const result = await queue.processQueue();
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.deadLettered).toBe(0);
    });
  });

  describe('processQueue — failure handling', () => {
    it('increments attemptCount on failure and keeps item pending', async () => {
      const processor = vi.fn(async () => {
        throw new Error('connection lost');
      });
      const queue = makeQueue(processor);
      await queue.enqueue({ x: 1 });

      await queue.processQueue();

      const row = db.prepare('SELECT * FROM ecus_retry_queue WHERE id = ?').get('id-1');
      expect(row.attempt_count).toBe(1);
      expect(row.status).toBe('pending');
      expect(row.last_error).toBe('connection lost');
    });

    it('records lastAttempt timestamp on failure', async () => {
      const processor = vi.fn(async () => {
        throw new Error('oops');
      });
      const queue = makeQueue(processor);
      await queue.enqueue({ x: 1 });

      clock.value = '2026-06-01T05:00:00.000Z';
      await queue.processQueue();

      const row = db.prepare('SELECT * FROM ecus_retry_queue WHERE id = ?').get('id-1');
      expect(row.last_attempt).toBe('2026-06-01T05:00:00.000Z');
    });
  });

  describe('dead-lettering (Requirement 8.5)', () => {
    it('dead-letters an item after 3 consecutive queue failures', async () => {
      const processor = vi.fn(async () => {
        throw new Error('persistent failure');
      });
      const onAlert = vi.fn();
      const queue = makeQueue(processor, { onAlert });

      await queue.enqueue({ data: 'important' });

      // Process 3 times — each run sees the item as pending
      await queue.processQueue(); // attempt_count → 1
      await queue.processQueue(); // attempt_count → 2
      await queue.processQueue(); // attempt_count → 3 → dead-lettered

      const row = db.prepare('SELECT * FROM ecus_retry_queue WHERE id = ?').get('id-1');
      expect(row.status).toBe('dead-lettered');
      expect(row.attempt_count).toBe(3);
    });

    it('emits an alert when dead-lettering', async () => {
      const processor = vi.fn(async () => {
        throw new Error('fail');
      });
      const onAlert = vi.fn();
      const queue = makeQueue(processor, { onAlert });

      await queue.enqueue({ key: 'val' });
      await queue.processQueue();
      await queue.processQueue();
      await queue.processQueue();

      expect(onAlert).toHaveBeenCalledTimes(1);
      expect(onAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dead-lettered',
          item: expect.objectContaining({
            id: 'id-1',
            status: 'dead-lettered',
            attemptCount: 3,
          }),
        }),
      );
    });

    it('dead-lettered items are not processed again', async () => {
      const processor = vi.fn(async () => {
        throw new Error('fail');
      });
      const queue = makeQueue(processor);

      await queue.enqueue({ x: 1 });
      await queue.processQueue();
      await queue.processQueue();
      await queue.processQueue(); // dead-lettered

      processor.mockClear();
      const result = await queue.processQueue();
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.deadLettered).toBe(0);
      expect(processor).not.toHaveBeenCalled();
    });

    it('does not break queue processing if onAlert throws', async () => {
      const processor = vi.fn(async () => {
        throw new Error('fail');
      });
      const onAlert = vi.fn(() => {
        throw new Error('alert handler broken');
      });
      const queue = makeQueue(processor, { onAlert });

      await queue.enqueue({ x: 1 });
      await queue.processQueue();
      await queue.processQueue();

      // Should not throw even though onAlert throws
      await expect(queue.processQueue()).resolves.toEqual(
        expect.objectContaining({ deadLettered: 1 }),
      );
    });
  });

  describe('integration with retryEngine adapter interface', () => {
    it('conforms to the queue adapter shape (enqueue/processQueue/getQueueDepth)', () => {
      const queue = makeQueue(async () => {});
      expect(typeof queue.enqueue).toBe('function');
      expect(typeof queue.processQueue).toBe('function');
      expect(typeof queue.getQueueDepth).toBe('function');
    });
  });
});
