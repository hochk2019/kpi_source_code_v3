// tests/serverSourceOfTruth.test.js
// Tests for server-as-source-of-truth utilities

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getServerSyncMeta,
  updateServerSyncMeta,
  isCacheStale,
  detectConflict,
  resolveConflictServerWins,
  resolveConflictLastWriteWins,
  clearServerSyncMeta,
  SERVER_SYNC_KEY,
} from "../src/lib/stores/serverSourceOfTruth.js";

describe("serverSourceOfTruth", () => {
  let mockStorage = {};

  const mockGetItem = vi.fn((key) => mockStorage[key] || null);
  const mockSetItem = vi.fn((key, value) => {
    mockStorage[key] = value;
  });

  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  describe("getServerSyncMeta", () => {
    it("returns default meta when no data exists", () => {
      const meta = getServerSyncMeta("test_key", mockGetItem);
      expect(meta).toEqual({
        lastServerSyncAt: null,
        serverVersion: null,
        etag: null,
      });
    });

    it("returns meta for specific data key", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        test_key: { lastServerSyncAt: 12345, serverVersion: 1, etag: "abc" },
      });

      const meta = getServerSyncMeta("test_key", mockGetItem);
      expect(meta).toEqual({
        lastServerSyncAt: 12345,
        serverVersion: 1,
        etag: "abc",
      });
    });

    it("returns default for unknown key", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        other_key: { lastServerSyncAt: 12345 },
      });

      const meta = getServerSyncMeta("test_key", mockGetItem);
      expect(meta.lastServerSyncAt).toBeNull();
    });
  });

  describe("updateServerSyncMeta", () => {
    it("creates new meta entry", () => {
      updateServerSyncMeta("test_key", { serverVersion: 1, etag: "abc" }, mockSetItem, mockGetItem);

      const raw = mockStorage[SERVER_SYNC_KEY];
      const parsed = JSON.parse(raw);
      expect(parsed.test_key.serverVersion).toBe(1);
      expect(parsed.test_key.etag).toBe("abc");
      expect(parsed.test_key.lastServerSyncAt).toBeTypeOf("number");
    });

    it("preserves existing meta for other keys", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        other_key: { lastServerSyncAt: 100, serverVersion: 5 },
      });

      updateServerSyncMeta("test_key", { serverVersion: 1 }, mockSetItem, mockGetItem);

      const parsed = JSON.parse(mockStorage[SERVER_SYNC_KEY]);
      expect(parsed.other_key.serverVersion).toBe(5);
      expect(parsed.test_key.serverVersion).toBe(1);
    });
  });

  describe("isCacheStale", () => {
    it("returns true when no sync exists", () => {
      expect(isCacheStale("test_key", 30000, mockGetItem)).toBe(true);
    });

    it("returns true when cache is older than max age", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        test_key: { lastServerSyncAt: Date.now() - 60000 },
      });

      expect(isCacheStale("test_key", 30000, mockGetItem)).toBe(true);
    });

    it("returns false when cache is fresh", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        test_key: { lastServerSyncAt: Date.now() - 1000 },
      });

      expect(isCacheStale("test_key", 30000, mockGetItem)).toBe(false);
    });
  });

  describe("detectConflict", () => {
    it("returns no conflict when no server sync exists", () => {
      const result = detectConflict("test_key", 5, "etag1", mockGetItem);
      expect(result.hasConflict).toBe(false);
    });

    it("detects version conflict", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        test_key: { lastServerSyncAt: 1000, serverVersion: 10, etag: "etag2" },
      });

      const result = detectConflict("test_key", 5, "etag1", mockGetItem);
      expect(result.hasConflict).toBe(true);
      expect(result.serverVersion).toBe(10);
    });

    it("detects etag conflict", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        test_key: { lastServerSyncAt: 1000, serverVersion: 5, etag: "etag2" },
      });

      const result = detectConflict("test_key", 5, "etag1", mockGetItem);
      expect(result.hasConflict).toBe(true);
      expect(result.serverEtag).toBe("etag2");
    });

    it("returns no conflict when versions match", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        test_key: { lastServerSyncAt: 1000, serverVersion: 5, etag: "etag1" },
      });

      const result = detectConflict("test_key", 5, "etag1", mockGetItem);
      expect(result.hasConflict).toBe(false);
    });
  });

  describe("resolveConflictServerWins", () => {
    it("always returns server data", () => {
      const local = { id: 1, name: "Local" };
      const server = { id: 1, name: "Server" };
      expect(resolveConflictServerWins(local, server)).toBe(server);
    });
  });

  describe("resolveConflictLastWriteWins", () => {
    it("returns local data when newer", () => {
      const local = { id: 1, name: "Local" };
      const server = { id: 1, name: "Server" };
      const now = Date.now();

      expect(resolveConflictLastWriteWins(local, now, server, now - 1000)).toBe(local);
    });

    it("returns server data when newer", () => {
      const local = { id: 1, name: "Local" };
      const server = { id: 1, name: "Server" };
      const now = Date.now();

      expect(resolveConflictLastWriteWins(local, now - 1000, server, now)).toBe(server);
    });
  });

  describe("clearServerSyncMeta", () => {
    it("clears all sync metadata", () => {
      mockStorage[SERVER_SYNC_KEY] = JSON.stringify({
        key1: { lastServerSyncAt: 1000 },
        key2: { lastServerSyncAt: 2000 },
      });

      clearServerSyncMeta(mockSetItem);

      const parsed = JSON.parse(mockStorage[SERVER_SYNC_KEY]);
      expect(Object.keys(parsed)).toHaveLength(0);
    });
  });
});
