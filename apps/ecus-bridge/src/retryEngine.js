// RetryEngine — ECUS Bridge transient-failure recovery.
//
// Implements exponential-backoff retry logic (Requirement 8.1) and structured
// retry logging (Requirement 8.4). The durable retry queue (enqueue /
// processQueue / getQueueDepth, Requirements 8.2/8.3/8.5) is implemented by a
// separate task (10.3); the queue-facing methods here delegate to an injected
// queue adapter when provided and otherwise throw a clear "not implemented"
// error so the interface stays coherent.
//
// NOTE: This file is plain ESM JavaScript to match the existing
// `apps/ecus-bridge/src` modules, which are executed directly by Node
// (`node ./src/bridgeCli.js`) with no TypeScript build step. JSDoc typedefs
// mirror the TypeScript interfaces from the design document.

/**
 * @typedef {Object} RetryConfig
 * @property {number} maxAttempts    Maximum number of attempts (default 5).
 * @property {number} initialDelayMs Initial backoff delay in ms (default 1000).
 * @property {number} maxDelayMs     Maximum backoff delay in ms (default 60000).
 * @property {number} backoffFactor  Exponential multiplier (default 2).
 */

/**
 * @typedef {Object} RetryQueueItem
 * @property {string} id
 * @property {unknown} payload
 * @property {Date} createdAt
 * @property {number} attemptCount
 * @property {Date|null} lastAttemptAt
 * @property {string|null} lastError
 * @property {'pending'|'processing'|'dead-lettered'} status
 */

/**
 * Default retry configuration per Requirement 8.1
 * (initial 1s, max 60s, factor 2, max 5 attempts).
 * @type {RetryConfig}
 */
export const DEFAULT_RETRY_CONFIG = Object.freeze({
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffFactor: 2,
});

/**
 * Compute the exponential backoff delay for a given attempt.
 *
 * Pure function: `min(initialDelayMs * backoffFactor^(attemptNumber-1), maxDelayMs)`.
 * The result is monotonically non-decreasing with attemptNumber (Property 9).
 *
 * @param {number} attemptNumber 1-based attempt number.
 * @param {RetryConfig} config   Retry configuration.
 * @returns {number} Delay in milliseconds (>= 0).
 */
export function calculateBackoffDelay(attemptNumber, config) {
  const initialDelayMs = Number(config?.initialDelayMs);
  const maxDelayMs = Number(config?.maxDelayMs);
  const backoffFactor = Number(config?.backoffFactor);

  // Defensive: a non-positive / non-finite attempt collapses to the first step.
  const safeAttempt =
    Number.isFinite(attemptNumber) && attemptNumber >= 1 ? Math.floor(attemptNumber) : 1;

  const raw = initialDelayMs * Math.pow(backoffFactor, safeAttempt - 1);
  return Math.min(raw, maxDelayMs);
}

/**
 * Merge a partial config over the defaults, ignoring undefined overrides.
 * @param {Partial<RetryConfig>} [overrides]
 * @returns {RetryConfig}
 */
function resolveConfig(overrides) {
  const merged = { ...DEFAULT_RETRY_CONFIG };
  if (overrides && typeof overrides === 'object') {
    for (const key of /** @type {(keyof RetryConfig)[]} */ (Object.keys(DEFAULT_RETRY_CONFIG))) {
      const value = overrides[key];
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

/** @param {unknown} error @returns {string} */
function describeFailure(error) {
  if (error instanceof Error) {
    return error.message || error.name || 'Error';
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a RetryEngine instance.
 *
 * @param {Object} [deps]
 * @param {{ warn?: Function, info?: Function, error?: Function }} [deps.logger]
 *   Structured logger. Defaults to `console`.
 * @param {(ms: number) => Promise<void>} [deps.sleep]
 *   Delay function. Injectable for deterministic tests. Defaults to setTimeout.
 * @param {() => Date} [deps.now]
 *   Clock for retry-attempt timestamps. Defaults to `() => new Date()`.
 * @param {Object} [deps.queue]
 *   Durable retry-queue adapter (task 10.3). When omitted, queue methods throw.
 */
export function createRetryEngine({ logger = console, sleep = defaultSleep, now = () => new Date(), queue } = {}) {
  const log = {
    warn: typeof logger?.warn === 'function' ? logger.warn.bind(logger) : () => {},
    info: typeof logger?.info === 'function' ? logger.info.bind(logger) : () => {},
    error: typeof logger?.error === 'function' ? logger.error.bind(logger) : () => {},
  };

  /**
   * Execute an async operation with exponential-backoff retry.
   *
   * Retries on any thrown error up to `maxAttempts`. Each failed attempt that
   * will be retried is logged with timestamp, attempt number, and failure
   * reason (Requirement 8.4). After the final attempt the last error is
   * rethrown so callers can route the request to the durable queue.
   *
   * @template T
   * @param {() => Promise<T>} operation
   * @param {Partial<RetryConfig>} [config]
   * @returns {Promise<T>}
   */
  async function withRetry(operation, config) {
    if (typeof operation !== 'function') {
      throw new TypeError('withRetry(operation) requires a function returning a Promise');
    }
    const resolved = resolveConfig(config);
    const maxAttempts = Math.max(1, Math.floor(resolved.maxAttempts));

    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const reason = describeFailure(error);
        const isFinalAttempt = attempt >= maxAttempts;

        if (isFinalAttempt) {
          log.error('[retry-engine] attempt failed; retries exhausted', {
            timestamp: now().toISOString(),
            attempt,
            maxAttempts,
            reason,
          });
          break;
        }

        const delayMs = calculateBackoffDelay(attempt, resolved);
        // Requirement 8.4: log each retry attempt with timestamp, attempt
        // number, and failure reason.
        log.warn('[retry-engine] attempt failed; scheduling retry', {
          timestamp: now().toISOString(),
          attempt,
          maxAttempts,
          reason,
          nextDelayMs: delayMs,
        });
        await sleep(delayMs);
      }
    }

    throw lastError;
  }

  /**
   * Enqueue a failed request for later processing (Requirement 8.2).
   * Implemented by task 10.3 via an injected queue adapter.
   * @param {unknown} request
   * @returns {Promise<string>}
   */
  async function enqueue(request) {
    if (queue && typeof queue.enqueue === 'function') {
      return queue.enqueue(request);
    }
    throw new Error('RetryEngine.enqueue is not implemented (durable retry queue — task 10.3)');
  }

  /**
   * Process all pending queue items in FIFO order (Requirement 8.3).
   * Implemented by task 10.3 via an injected queue adapter.
   * @returns {Promise<unknown>}
   */
  async function processQueue() {
    if (queue && typeof queue.processQueue === 'function') {
      return queue.processQueue();
    }
    throw new Error('RetryEngine.processQueue is not implemented (durable retry queue — task 10.3)');
  }

  /**
   * Get the current durable-queue depth.
   * Implemented by task 10.3 via an injected queue adapter.
   * @returns {Promise<number>}
   */
  async function getQueueDepth() {
    if (queue && typeof queue.getQueueDepth === 'function') {
      return queue.getQueueDepth();
    }
    throw new Error('RetryEngine.getQueueDepth is not implemented (durable retry queue — task 10.3)');
  }

  return { withRetry, enqueue, processQueue, getQueueDepth };
}

export default createRetryEngine;
