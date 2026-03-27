import React from "react";

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import HQAgencyManager from "@/components/HQAgencyManager.jsx";

import { HQ_KEY, DECL_KEY } from "@/lib/store.js";

import {
  clearStorageCache,
  getItem as sharedGetItem,
  setItem as sharedSetItem,
} from "@/lib/storageClient.js";

const historyMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("@/lib/hqHistoryClient.js", () => ({
  refreshHQHistoryCache: historyMock,
}));

vi.mock("xlsx", () => {
  const sheet_to_json = vi.fn(() => []);

  const read = vi.fn(() => ({
    SheetNames: ["Sheet1"],

    Sheets: { Sheet1: { mock: true } },
  }));

  return {
    read,

    utils: { sheet_to_json },
  };
});

import * as XLSX from "xlsx";

describe("HQAgencyManager", () => {
  let alertMock;

  let confirmMock;

  beforeEach(() => {
    clearStorageCache();

    sharedSetItem(HQ_KEY, "[]");

    sharedSetItem(DECL_KEY, "[]");

    XLSX.utils.sheet_to_json.mockReset();

    alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});

    confirmMock = vi.spyOn(window, "confirm").mockImplementation(() => true);

    historyMock.mockClear();

    historyMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();

    alertMock.mockRestore();

    confirmMock.mockRestore();
  });

  it("import Excel rồi lưu cấu hình Đại lý HQ vào store", async () => {
    const user = userEvent.setup();

    XLSX.utils.sheet_to_json.mockReturnValue([
      { MST: "0201234567", "Công ty": "Alpha Trading", "Đại lý HQ": "AIR" },

      { MST: "0101234567", "Công Ty": "Beta Logistics", "Đại lý": "FCL" },
    ]);

    const { container } = render(<HQAgencyManager canEdit currentUser={{ username: "admin" }} />);

    const fileInput = container.querySelector('[data-testid="hq-file-input"]');

    const fakeFile = new File(["dummy"], "hq.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fakeFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    await user.upload(fileInput, fakeFile);

    await user.click(screen.getByRole("button", { name: /Import Excel/i }));

    await waitFor(() => {
      expect(XLSX.utils.sheet_to_json).toHaveBeenCalled();

      expect(screen.getByDisplayValue("Alpha Trading")).toBeInTheDocument();

      expect(screen.getByDisplayValue("Beta Logistics")).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByRole("button", { name: /Lưu cấu hình/i });

    await user.click(saveButtons[0]);

    const saved = JSON.parse(sharedGetItem(HQ_KEY) || "[]");

    expect(saved).toEqual([
      { mst: "0201234567", company: "Alpha Trading", agent: "AIR", agents: ["AIR"] },

      { mst: "0101234567", company: "Beta Logistics", agent: "FCL", agents: ["FCL"] },
    ]);

    expect(alertMock).toHaveBeenCalledWith("Đã lưu cấu hình Đại lý HQ.");
  });

  it("tự động gợi ý tên công ty dựa trên dữ liệu tờ khai khi lưu MST mới", async () => {
    sharedSetItem(
      DECL_KEY,
      JSON.stringify([
        {
          so_tk: "TK001",

          nhanh: "",

          date: "2025-01-01",

          mst: "0101234567",

          cong_ty: "Công Ty Demo",
        },
      ]),
    );

    sharedSetItem(HQ_KEY, JSON.stringify([{ mst: "0101234567", company: "", agent: "" }]));

    const user = userEvent.setup();

    render(<HQAgencyManager canEdit currentUser={{ username: "admin" }} />);

    const saveButtons = screen.getAllByRole("button", { name: /Lưu cấu hình/i });

    await user.click(saveButtons[0]);

    const saved = JSON.parse(sharedGetItem(HQ_KEY) || "[]");

    expect(saved).toEqual([{ mst: "0101234567", company: "Công Ty Demo", agent: "", agents: [] }]);

    expect(alertMock).toHaveBeenCalledWith("Đã lưu cấu hình Đại lý HQ.");
  });
});
