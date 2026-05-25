import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import useRulesConfigState from "@/components/rules-editor/hooks/useRulesConfigState.js";

function UseRulesConfigStateHarness() {
  const [rule, setRule] = useState({
    groups: {
      business: {
        title: "Nhập kinh doanh",
        codes: ["a11"],
        base: 1.5,
        perItem: 0.2,
      },
    },
    license: {
      defaultPoints: 1.5,
      codePoints: [{ code: "zb02", points: 2 }],
      exclude: { codes: ["zb03"], agencies: [] },
    },
  });

  const state = useRulesConfigState({
    data: [
      {
        loai_hinh: "A11",
        licenseCodes: ["ZB02"],
        agency: "G&B",
        cong_ty: "Công ty A",
      },
      {
        loai_hinh: "B11",
        licenseSourceCodes: "ZB04",
        dai_ly: "Alpha",
        company: "Công ty B",
      },
    ],
    rule,
    hqAgencies: [{ agent: "HQ", company: "Tổng công ty", agents: ["G&B"] }],
    updateRule: (updater) =>
      setRule((prev) => (typeof updater === "function" ? updater(prev) : updater)),
  });

  return (
    <>
      <button type="button" onClick={() => state.handleCodesChange("business", ["b11", "B11"])}>
        update-codes
      </button>
      <button type="button" onClick={() => state.handleGroupNumber("business", "base", 3.2)}>
        update-base
      </button>
      <button
        type="button"
        onClick={() =>
          state.handleLicenseChange((license) => ({
            ...license,
            defaultPoints: 4.5,
          }))
        }
      >
        update-license
      </button>
      <button
        type="button"
        onClick={() => state.handleAgencyChange([{ agency: "G&B", codes: ["ZB02"] }])}
      >
        update-agencies
      </button>
      <pre data-testid="groups-state">{JSON.stringify(state.groups)}</pre>
      <pre data-testid="type-options">{JSON.stringify(state.typeOptions)}</pre>
      <pre data-testid="license-config">{JSON.stringify(state.licenseConfig)}</pre>
      <pre data-testid="license-options">{JSON.stringify(state.licenseOptions)}</pre>
      <pre data-testid="agency-options">{JSON.stringify(state.agencyOptions)}</pre>
    </>
  );
}

describe("useRulesConfigState", () => {
  afterEach(() => {
    cleanup();
  });

  it("tong hop options tu data va rule hien tai", () => {
    render(<UseRulesConfigStateHarness />);

    expect(screen.getByTestId("type-options").textContent).toContain('"value":"A11"');
    expect(screen.getByTestId("type-options").textContent).toContain('"value":"B11"');
    expect(screen.getByTestId("license-options").textContent).toContain('"value":"ZB02"');
    expect(screen.getByTestId("license-options").textContent).toContain('"value":"ZB04"');
    expect(screen.getByTestId("agency-options").textContent).toContain('"value":"G&B"');
    expect(screen.getByTestId("agency-options").textContent).toContain('"value":"HQ"');
  });

  it("cap nhat groups va license thong qua cac handler da tach", () => {
    render(<UseRulesConfigStateHarness />);

    fireEvent.click(screen.getByRole("button", { name: "update-codes" }));
    fireEvent.click(screen.getByRole("button", { name: "update-base" }));
    fireEvent.click(screen.getByRole("button", { name: "update-license" }));
    fireEvent.click(screen.getByRole("button", { name: "update-agencies" }));

    expect(screen.getByTestId("groups-state").textContent).toContain('"codes":["B11"]');
    expect(screen.getByTestId("groups-state").textContent).toContain('"base":3.2');
    expect(screen.getByTestId("license-config").textContent).toContain('"defaultPoints":4.5');
    expect(screen.getByTestId("license-config").textContent).toContain('"agency":"G&B"');
  });
});
