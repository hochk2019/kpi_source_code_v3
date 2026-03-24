import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const rows = [
  {
    mst: "0100000001",
    company: "Công ty Ánh Dương",
    person_import: "Lan",
    person_export: "Hùng",
    team: "Đội 1",
    effective_from: "2024-01-01",
    effective_to: "2024-06-30",
    status: "Đang xử lý",
  },
  {
    mst: "0100000001",
    company: "Công ty Ánh Dương",
    person_import: "Lan",
    person_export: "Hùng",
    team: "Đội 1",
    effective_from: "2024-07-01",
    effective_to: "",
    status: "Đã gán",
  },
  {
    mst: "0200000002",
    company: "Công ty Bình Minh",
    person_import: "Minh",
    person_export: "An",
    team: "Đội 2",
    effective_from: "2024-02-01",
    effective_to: "",
    status: "Đang chờ",
  },
];

vi.mock("@/lib/store.js", () => ({
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
  normalizeName: (value) => (value == null ? "" : value.toString().trim().toLowerCase()),
}));

import MSTAssignment from "@/components/MSTAssignment.jsx";

describe("MSTAssignment – dòng thời gian trong bảng", () => {
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

  it("hiển thị accordion timeline cho từng dòng và mở modal chi tiết", () => {
    render(<MSTAssignment canEdit={false} currentUser={{ username: "viewer" }} />);
    vi.runAllTimers();

    const toggles = screen
      .getAllByText(/lịch sử giai đoạn/i)
      .map((node) => node.closest("summary"))
      .filter(Boolean);
    expect(toggles.length).toBeGreaterThan(0);

    fireEvent.click(toggles[0]);

    expect(screen.getAllByText(/Nhập: Lan/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Xuất: Hùng/i).length).toBeGreaterThan(0);

    const fullButtons = screen.getAllByRole("button", { name: /xem toàn màn hình/i });
    expect(fullButtons.length).toBeGreaterThan(0);
    const fullButton = fullButtons[0];
    fireEvent.click(fullButton);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText(/0100000001/).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/Công ty Ánh Dương/i).length).toBeGreaterThan(0);
  });

  it("giữ nút Mở tổng hợp ở trạng thái khóa khi chưa có dữ liệu tổng hợp", () => {
    render(<MSTAssignment canEdit={false} currentUser={{ username: "viewer" }} />);
    vi.runAllTimers();

    const openAllButtons = screen.getAllByRole("button", { name: /mở tổng hợp/i });
    expect(openAllButtons.length).toBeGreaterThan(0);
    const openAll = openAllButtons[0];
    expect(openAll).toBeDisabled();
    expect(openAll).toHaveAttribute("title", "Mở tổng hợp (0)");
  });
});
