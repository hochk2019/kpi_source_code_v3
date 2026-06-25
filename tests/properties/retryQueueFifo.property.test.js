/**
 * Property Test: Retry Queue FIFO Ordering (Property 10)
 *
 * Feature: system-redesign-2026, Property 10: Retry Queue FIFO Ordering
 *
 * For any sequence of enqueued sync requests, when processQueue() is called,
 * items SHALL be dequeued and processed in the order they were enqueued
 * (earliest createdAt first).
 *
 * **Validates: Requirements 8.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { createRetryQueue } from '../../apps/ecus-bridge/src/retryQueue.js';

describe('Property 10: Retry Queue FIFO Ordering', () => {
  it('processQueue processes items in createdAt (enqueue) order for any sequence of payloads', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-20 distinct payload objects
        fc.array(
          fc.record({
            declarationId: fc.string({ minLength: 1, maxLength: 20 }),
            data: fc.integer({ min: 0, max: 10000 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (payloads) => {
          // Set up in-memory SQLite
          const db = new Database(':memory:');

          // Track the order in which the processor is called
          const processedOrder = [];
          const processor = async (payload) => {
            processedOrder.push(payload);
          };

          // Monotonically ascending clock to simulate enqueue times
          let clock = new Date('2026-01-01T00:00:00.000Z').getTime();
          const now = () => {
            clock += 1000; // advance 1 second per call
            return new Date(clock).toISOString();
          };

          // Sequential ID generator for determinism
          let idCounter = 0;
          const generateId = () => `item-${String(++idCounter).padStart(4, '0')}`;

          const queue = createRetryQueue({
            db,
            processor,
            logger: { warn: () => {}, info: () => {}, error: () => {} },
            now,
            generateId,
          });

          // Enqueue all payloads sequentially (each gets an ascending createdAt)
          for (const p of payloads) {
            await queue.enqueue(p);
          }

          // Process the queue — all should succeed and be processed in FIFO order
          const result = await queue.processQueue();

          // All items should be processed successfully
          expect(result.processed).toBe(payloads.length);
          expect(result.failed).toBe(0);
          expect(result.deadLettered).toBe(0);

          // The processor was called in exactly the enqueue order
          expect(processedOrder).toHaveLength(payloads.length);
          for (let i = 0; i < payloads.length; i++) {
            expect(processedOrder[i]).toEqual(payloads[i]);
          }

          db.close();
        }
      ),
      { numRuns: 100 },
    );
  });

  it('FIFO ordering holds even when items are enqueued with varying time gaps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 10 }),
            value: fc.integer({ min: 0, max: 1000 }),
          }),
          { minLength: 2, maxLength: 15 }
        ),
        // Random time gaps between enqueues (1-5000ms)
        fc.array(fc.integer({ min: 1, max: 5000 }), { minLength: 1, maxLength: 19 }),
        async (payloads, gaps) => {
          const db = new Database(':memory:');
          const processedOrder = [];
          const processor = async (payload) => {
            processedOrder.push(payload);
          };

          // Clock with variable gaps between enqueues
          let clock = new Date('2026-06-01T00:00:00.000Z').getTime();
          let enqueueCount = 0;
          const now = () => {
            const gap = gaps[enqueueCount % gaps.length] || 1000;
            clock += gap;
            enqueueCount++;
            return new Date(clock).toISOString();
          };

          let idCounter = 0;
          const generateId = () => `q-${String(++idCounter).padStart(4, '0')}`;

          const queue = createRetryQueue({
            db,
            processor,
            logger: { warn: () => {}, info: () => {}, error: () => {} },
            now,
            generateId,
          });

          // Enqueue sequentially
          for (const p of payloads) {
            await queue.enqueue(p);
          }

          const result = await queue.processQueue();

          expect(result.processed).toBe(payloads.length);

          // Verify FIFO: processor called in same order as enqueued
          expect(processedOrder).toHaveLength(payloads.length);
          for (let i = 0; i < payloads.length; i++) {
            expect(processedOrder[i]).toEqual(payloads[i]);
          }

          db.close();
        }
      ),
      { numRuns: 100 },
    );
  });
});
