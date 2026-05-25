import { describe, expect, it, vi } from "vitest";
import {
  COLUMN_VISIBILITY_STORAGE_PREFIX,
  DEFAULT_VISIBLE_COLUMNS,
  readStoredColumnVisibility,
  sanitizeColumnVisibility,
  writeStoredColumnVisibility,
} from "@/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js";

describe("sanitizeColumnVisibility", () => {
  it("giữ cột bắt buộc luôn hiển thị và chuẩn hoá giá trị", () => {
    const sanitized = sanitizeColumnVisibility(
      {
        mst: false,
        company: "false",
        status: "true",
      },
      {
        company: true,
        status: false,
      }
    );

    expect(sanitized.mst).toBe(true);
    expect(sanitized.company).toBe(false);
    expect(sanitized.status).toBe(true);
  });
});

describe("readStoredColumnVisibility", () => {
  it("trả về fallback khi dữ liệu lỗi", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = {
      getItem: vi.fn(() => "{invalid"),
    };

    const fallback = { ...DEFAULT_VISIBLE_COLUMNS, company: false };
    const result = readStoredColumnVisibility(storage, "alice", fallback);

    expect(storage.getItem).toHaveBeenCalledWith(
      `${COLUMN_VISIBILITY_STORAGE_PREFIX}:alice`
    );
    expect(result.company).toBe(false);
    warnSpy.mockRestore();
  });

  it("đọc cấu hình theo từng tài khoản", () => {
    const storage = {
      getItem: vi.fn((key) => {
        if (key === `${COLUMN_VISIBILITY_STORAGE_PREFIX}:alice`) {
          return JSON.stringify({ status: false });
        }
        return null;
      }),
    };

    const alice = readStoredColumnVisibility(
      storage,
      "alice",
      DEFAULT_VISIBLE_COLUMNS
    );
    const bob = readStoredColumnVisibility(storage, "bob", DEFAULT_VISIBLE_COLUMNS);

    expect(alice.status).toBe(false);
    expect(bob.status).toBe(true);
  });
});

describe("writeStoredColumnVisibility", () => {
  it("bắt buộc cột quan trọng luôn bật khi lưu", () => {
    const storage = {
      setItem: vi.fn(),
    };

    writeStoredColumnVisibility(storage, "alice", { mst: false, company: false });

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(payload.mst).toBe(true);
    expect(payload.company).toBe(false);
  });
});

