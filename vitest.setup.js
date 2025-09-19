import { beforeEach, afterEach, vi } from 'vitest';
import { clearStorageCache } from '@/lib/storageClient.js';

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  clear() {
    this.store.clear();
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  key(index) {
    return Array.from(this.store.keys())[Number(index)] ?? null;
  }

  get length() {
    return this.store.size;
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
  configurable: true,
});

beforeEach(() => {
  globalThis.localStorage = new LocalStorageMock();
  globalThis.alert = vi.fn();
  clearStorageCache();
});

afterEach(() => {
  vi.resetAllMocks();
});
