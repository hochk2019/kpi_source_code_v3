import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import AgencyExcludeEditor from "@/components/rules-editor/controls/AgencyExcludeEditor.jsx";
import AgencyInput from "@/components/rules-editor/controls/AgencyInput.jsx";
import CodeMultiSelect from "@/components/rules-editor/controls/CodeMultiSelect.jsx";
import LicenseCodeInput from "@/components/rules-editor/controls/LicenseCodeInput.jsx";
import LicensePointTable from "@/components/rules-editor/controls/LicensePointTable.jsx";
import TierEditor from "@/components/rules-editor/controls/TierEditor.jsx";

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

function CodeMultiSelectHarness() {
  const [value, setValue] = useState([]);

  return (
    <>
      <CodeMultiSelect
        value={value}
        onChange={setValue}
        options={[
          { value: "A11", count: 4, label: "Nhập kinh doanh" },
          { value: "B11", count: 2, label: "Xuất kinh doanh" },
        ]}
      />
      <pre data-testid="code-state">{JSON.stringify(value)}</pre>
    </>
  );
}

function TierEditorHarness() {
  const [tiers, setTiers] = useState([{ from: 1, to: 10, add: 0.2 }]);

  return (
    <>
      <TierEditor tiers={tiers} onChange={setTiers} />
      <pre data-testid="tier-state">{JSON.stringify(tiers)}</pre>
    </>
  );
}

function LicensePointTableHarness() {
  const [config, setConfig] = useState({ defaultPoints: 1.5, codePoints: [] });

  return (
    <>
      <LicensePointTable
        config={config}
        onChange={setConfig}
        options={[{ value: "ZB02", count: 3 }]}
      />
      <pre data-testid="license-state">{JSON.stringify(config)}</pre>
    </>
  );
}

function AgencyExcludeEditorHarness() {
  const [agencies, setAgencies] = useState([]);

  return (
    <>
      <AgencyExcludeEditor
        agencies={agencies}
        onChange={setAgencies}
        agencyOptions={[{ value: "G&B", hint: "Công ty A" }]}
        codeOptions={[{ value: "ZB02", count: 3 }]}
      />
      <pre data-testid="agency-state">{JSON.stringify(agencies)}</pre>
    </>
  );
}

describe("RulesEditor controls", () => {
  beforeEach(() => {
    ensureTestGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("cho phep chon va bo chon ma trong CodeMultiSelect", async () => {
    render(<CodeMultiSelectHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Chọn mã loại hình" }));
    fireEvent.click(await screen.findByText(/Nhập kinh doanh/i));

    await waitFor(() => {
      expect(screen.getByTestId("code-state").textContent).toContain('["A11"]');
    });

    fireEvent.click(screen.getAllByRole("button")[1]);

    await waitFor(() => {
      expect(screen.getByTestId("code-state").textContent).toBe("[]");
    });
  });

  it("cap nhat va them bac trong TierEditor", async () => {
    const { container } = render(<TierEditorHarness />);
    const numberInputs = container.querySelectorAll('input[type="number"]');

    fireEvent.change(numberInputs[0], { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm bậc" }));

    await waitFor(() => {
      expect(screen.getByTestId("tier-state").textContent).toContain('"from":3');
      expect(screen.getByTestId("tier-state").textContent).toContain('"from":11');
    });
  });

  it("uppercase ma trong LicenseCodeInput va hien goi y tu datalist", () => {
    const handleChange = vi.fn();
    render(
      <LicenseCodeInput
        value="zb"
        onChange={handleChange}
        options={[{ value: "ZB02", count: 3 }]}
      />
    );

    const input = screen.getByDisplayValue("zb");
    fireEvent.change(input, { target: { value: "zb02" } });

    expect(handleChange).toHaveBeenCalledWith("ZB02");
    expect(document.querySelector('datalist option[value="ZB02"]')).not.toBeNull();
  });

  it("giu text tu do va khong lap goi y trong AgencyInput", () => {
    const handleChange = vi.fn();
    render(
      <AgencyInput
        value=""
        onChange={handleChange}
        options={[
          { value: "G&B", hint: "Công ty A" },
          { value: "G&B", hint: "Công ty A" },
        ]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ví dụ: G&B"), {
      target: { value: "G&B" },
    });

    expect(handleChange).toHaveBeenCalledWith("G&B");
    expect(document.querySelectorAll('datalist option[value="G&B"]')).toHaveLength(1);
  });

  it("them dong diem ma giay phep va chuan hoa code", async () => {
    render(<LicensePointTableHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Thêm mã giấy phép" }));
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: ZB02"), {
      target: { value: "zb02" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("license-state").textContent).toContain('"code":"ZB02"');
      expect(screen.getByTestId("license-state").textContent).toContain('"points":1.5');
    });
  });

  it("them dai ly loai tru va chon ma giay phep ap dung", async () => {
    render(<AgencyExcludeEditorHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Thêm đại lý loại trừ" }));
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: G&B"), {
      target: { value: "G&B" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Chọn mã giấy phép" }));
    fireEvent.click(await screen.findByText("ZB02"));

    await waitFor(() => {
      expect(screen.getByTestId("agency-state").textContent).toContain('"agency":"G&B"');
      expect(screen.getByTestId("agency-state").textContent).toContain('"codes":["ZB02"]');
    });
  });
});
