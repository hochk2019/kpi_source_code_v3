import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/store.js", () => {
  const rows = [
    {
      mst: "0100000001",
      company: "Công ty Ánh Dương",
      person_import: "",
      person_export: "",
      team: "",
      effective_from: "2025-01-01",
      effective_to: "",
      status: "",
    },
  ];

  return {
    MST_ASSIGNMENT_STATUS: {
      ASSIGNED: "Đã gán",
      PENDING: "Đang chờ",
    },
    getMSTMap: vi.fn(() => rows.map((row) => ({ ...row }))),
    getMSTHistoryEntries: vi.fn(() => []),
    upsertMSTRows: vi.fn(() => ({ ok: true })),
    saveMSTRow: vi.fn(() => ({ ok: true })),
    getTeamRoster: vi.fn(() => ({ teams: [] })),
    subscribeTeamRoster: vi.fn(() => () => {}),
    normalizeStr: (value) => (value == null ? "" : value.toString()),
    normalizeName: (value) =>
      value == null ? "" : value.toString().trim().toLowerCase(),
  };
});

import MSTAssignment, {
  COLUMN_VISIBILITY_STORAGE_PREFIX,
  DEFAULT_VISIBLE_COLUMNS,
  readStoredColumnVisibility,
  sanitizeColumnVisibility,
  writeStoredColumnVisibility,
} from "@/components/MSTAssignment.jsx";

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

describe("MSTAssignment – cấu hình hiển thị cột", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("ghi nhớ cấu hình theo người dùng hiện tại", async () => {
    const { unmount } = render(
      <MSTAssignment canEdit={false} currentUser={{ username: "alice" }} />
    );

    fireEvent.click(screen.getByRole("button", { name: /cột hiển thị/i }));
    const statusCheckbox = screen.getByRole("checkbox", { name: /trạng thái/i });
    expect(statusCheckbox).toBeChecked();
    fireEvent.click(statusCheckbox);
    expect(statusCheckbox).not.toBeChecked();

    const storageKeyAlice = `${COLUMN_VISIBILITY_STORAGE_PREFIX}:alice`;
    const storedAlice = JSON.parse(window.localStorage.getItem(storageKeyAlice));
    expect(storedAlice.status).toBe(false);

    unmount();
    vi.runOnlyPendingTimers();

    const secondMount = render(
      <MSTAssignment canEdit={false} currentUser={{ username: "alice" }} />
    );

    expect(document.querySelector('th[data-column-key="status"]')).toBeNull();

    secondMount.unmount();
    vi.runOnlyPendingTimers();

    const thirdMount = render(
      <MSTAssignment canEdit={false} currentUser={{ username: "bob" }} />
    );

    expect(
      document.querySelector('th[data-column-key="status"]')
    ).not.toBeNull();

    thirdMount.unmount();
    vi.runOnlyPendingTimers();
  });

  it("exposes shell search and table semantics for operator navigation", () => {
    render(<MSTAssignment canEdit={false} currentUser={{ username: "alice" }} />);

    expect(
      screen.getByRole("searchbox", { name: /tìm nhanh mst hoặc công ty/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /lọc theo nhân viên phụ trách/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: /danh sách gán mst/i })
    ).toBeInTheDocument();
  });
});
