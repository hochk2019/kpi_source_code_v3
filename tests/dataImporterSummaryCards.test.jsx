import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import DataImporterSummaryCards from "@/components/dataImporter/DataImporterSummaryCards.jsx";

afterEach(() => {
  cleanup();
});

describe("DataImporterSummaryCards", () => {
  it("renders localized summary card values", () => {
    render(
      <DataImporterSummaryCards
        summaryCards={[
          { label: "Tong so", value: 12 },
          { label: "Can xu ly", value: "N/A" },
        ]}
        cardSurfaceClass="rounded border"
      />,
    );

    expect(screen.getByText("Tong so")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Can xu ly")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders nothing when there are no summary cards", () => {
    const { container } = render(
      <DataImporterSummaryCards summaryCards={[]} cardSurfaceClass="rounded border" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
