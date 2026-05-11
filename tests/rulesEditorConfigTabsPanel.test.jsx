import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import RulesConfigTabsPanel from "@/components/rules-editor/RulesConfigTabsPanel.jsx";

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

function ConfigTabsHarness({ initialTab = "groups" }) {
  const [configTab, setConfigTab] = useState(initialTab);
  const [groups, setGroups] = useState({
    business: {
      title: "Nhập kinh doanh",
      description: "Nhóm kiểm thử",
      codes: [],
      base: 1.5,
      perItem: 0,
      tiers: [{ from: 1, to: 10, add: 0.2 }],
    },
  });
  const [licenseConfig, setLicenseConfig] = useState({
    defaultPoints: 1.5,
    codePoints: [],
    exclude: { codes: [], agencies: [] },
  });
  const [rule, setRule] = useState({
    bonuses: {
      co: {
        enabled: false,
        points: 0.3,
        perLine: 0.05,
      },
    },
  });

  return (
    <>
      <RulesConfigTabsPanel
        configTab={configTab}
        onConfigTabChange={setConfigTab}
        groups={groups}
        typeOptions={[{ value: "A11", count: 4, label: "Nhập kinh doanh" }]}
        isReadOnly={false}
        onGroupCodesChange={(groupKey, codes) =>
          setGroups((prev) => ({
            ...prev,
            [groupKey]: { ...prev[groupKey], codes },
          }))
        }
        onGroupNumberChange={(groupKey, key, value) =>
          setGroups((prev) => ({
            ...prev,
            [groupKey]: { ...prev[groupKey], [key]: value },
          }))
        }
        licenseConfig={licenseConfig}
        onLicenseChange={(updater) =>
          setLicenseConfig((prev) => (typeof updater === "function" ? updater(prev) : updater))
        }
        licenseOptions={[{ value: "ZB02", count: 3 }]}
        onAgencyChange={(nextList) =>
          setLicenseConfig((prev) => ({
            ...prev,
            exclude: {
              codes: prev.exclude?.codes || [],
              agencies: nextList,
            },
          }))
        }
        agencyOptions={[{ value: "G&B", hint: "Công ty A" }]}
        rule={rule}
        onRuleChange={(updater) =>
          setRule((prev) => (typeof updater === "function" ? updater(prev) : updater))
        }
      />
      <pre data-testid="config-tab-state">{configTab}</pre>
      <pre data-testid="groups-state">{JSON.stringify(groups)}</pre>
      <pre data-testid="license-state">{JSON.stringify(licenseConfig)}</pre>
      <pre data-testid="rule-state">{JSON.stringify(rule)}</pre>
    </>
  );
}

describe("RulesConfigTabsPanel", () => {
  beforeEach(() => {
    ensureTestGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("cap nhat nhom loai hinh trong tab groups", async () => {
    render(<ConfigTabsHarness />);

    expect(screen.getAllByText(/Nhập kinh doanh/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTitle("Chỉnh sửa quy tắc"));
    expect(await screen.findByText(/Các bậc cộng thêm/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Chọn mã loại hình/i }));
    const matches = await screen.findAllByText(/Nhập kinh doanh/i);
    fireEvent.click(matches[matches.length - 1]);

    await waitFor(() => {
      expect(screen.getByTestId("groups-state").textContent).toContain('"codes":["A11"]');
    });
  });

  it("doi tab va cap nhat cau hinh giay phep", async () => {
    render(<ConfigTabsHarness initialTab="license" />);

    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa cấu hình giấy phép" }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm mã giấy phép" }));
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: ZB02"), {
      target: { value: "zb02" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("license-state").textContent).toContain('"code":"ZB02"');
    });

    fireEvent.click(screen.getByRole("button", { name: "Thêm đại lý loại trừ" }));
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: G&B"), {
      target: { value: "G&B" },
    });
    const codeButtons = screen.getAllByRole("button", { name: "Chọn mã giấy phép" });
    fireEvent.click(codeButtons[codeButtons.length - 1]);
    fireEvent.click(await screen.findByText("ZB02"));

    await waitFor(() => {
      expect(screen.getByTestId("license-state").textContent).toContain('"agency":"G&B"');
      expect(screen.getByTestId("license-state").textContent).toContain('"codes":["ZB02"]');
    });
  });

  it("cap nhat diem cong them trong tab bonus", async () => {
    const { container } = render(<ConfigTabsHarness initialTab="bonus" />);

    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa cấu hình cộng điểm" }));
    fireEvent.click(screen.getByLabelText("Kích hoạt điểm bù theo C/O"));

    const numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[numberInputs.length - 2], { target: { value: "0.75" } });
    fireEvent.change(numberInputs[numberInputs.length - 1], { target: { value: "0.15" } });

    await waitFor(() => {
      expect(screen.getByTestId("rule-state").textContent).toContain('"enabled":true');
      expect(screen.getByTestId("rule-state").textContent).toContain('"points":0.75');
      expect(screen.getByTestId("rule-state").textContent).toContain('"perLine":0.15');
    });
  });
});
