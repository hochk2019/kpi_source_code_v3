import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import RulesEditor from "@/components/RulesEditor.tsx";
import * as rulesModule from "@/lib/rules.js";
import { DECL_KEY, HQ_KEY } from "@/lib/store.js";
import { clearStorageCache, setItem as sharedSetItem } from "@/lib/storageClient.js";
import { toast } from "@/shared/toast";
import { AppDialogProvider } from "@/hooks/useAppDialog.tsx";

vi.mock("@/shared/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

function ensureTestGlobals() {
  if (!globalThis.ResizeObserver) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        media: "",
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      }),
    });
  }
  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

function createHistoryEntry() {
  const currentRule = rulesModule.loadRules();

  return {
    id: "history-1",
    name: "Bộ lịch sử test",
    updatedAt: "2026-03-25T10:00:00.000Z",
    applyFrom: "2026-03-01",
    snapshot: {
      ...currentRule,
      id: currentRule.id,
      name: "Bộ lịch sử test",
      version: 3,
      points: { base: 1.5, licenses: 0.3 },
    },
  };
}

describe("RulesEditor", () => {
  beforeEach(() => {
    ensureTestGlobals();
    window.localStorage.clear();
    clearStorageCache();

    sharedSetItem(
      DECL_KEY,
      JSON.stringify([
        {
          so_tk: "TK001",
          date: "2025-01-01",
          mst: "0101234567",
          cong_ty: "Công ty A",
          loai_hinh: "A11",
          num_items: 3,
          licenseCodes: [],
        },
      ])
    );
    sharedSetItem(HQ_KEY, JSON.stringify([]));

    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);

    const historyEntry = createHistoryEntry();
    vi.spyOn(rulesModule, "fetchRulesHistoryFromServer").mockResolvedValue([historyEntry]);
    vi.spyOn(rulesModule, "getRulesHistory").mockReturnValue([historyEntry]);
    vi.spyOn(rulesModule, "restoreRuleVersion").mockImplementation((snapshot) => ({
      ...snapshot,
      updatedAt: new Date("2026-03-25T11:00:00.000Z").toISOString(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    clearStorageCache();
  });

  it("giu duoc flow mo phong, refresh lich su va khoi phuc phien ban", async () => {
    render(<AppDialogProvider><RulesEditor currentUser={{ username: "admin" }} /></AppDialogProvider>);

    await screen.findByText(/Quy tắc KPI/i);

    fireEvent.click(screen.getByRole("button", { name: "Chạy mô phỏng" }));

    expect(await screen.findByText(/Phiên bản đang chỉnh/i)).toBeInTheDocument();
    expect(screen.getByText(/Phiên bản đã lưu/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mở rộng" }));
    expect(await screen.findByText(/Bộ lịch sử test/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    await waitFor(() => {
      expect(rulesModule.fetchRulesHistoryFromServer).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Khôi phục phiên bản 3"));
    await waitFor(() => {
      expect(rulesModule.restoreRuleVersion).toHaveBeenCalledWith(
        expect.objectContaining({ version: 3, name: "Bộ lịch sử test" }),
        expect.objectContaining({ actor: "admin", setAsDefault: true })
      );
    });
    expect(toast.success).toHaveBeenCalled();
  });
});
