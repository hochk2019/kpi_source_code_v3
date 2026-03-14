import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import DataImporterLastSyncSummaryCard from "@/components/dataImporter/DataImporterLastSyncSummaryCard.jsx";

afterEach(() => {
  cleanup();
});

describe("DataImporterLastSyncSummaryCard", () => {
  it("renders the latest sync summary details when visible", () => {
    render(
      <DataImporterLastSyncSummaryCard
        visible
        rangeLabel="01/03/2026 - 08/03/2026"
        runAtLabel="11/03/2026 08:00"
        fetched={12}
        inserted={3}
        updated={4}
        skipped={1}
        total={20}
      />,
    );

    expect(screen.getByText("Ket qua dong bo gan nhat")).toBeInTheDocument();
    expect(screen.getByText("Khoang: 01/03/2026 - 08/03/2026")).toBeInTheDocument();
    expect(screen.getByText("Run: 11/03/2026 08:00")).toBeInTheDocument();
    expect(screen.getByText("Thu thap: 12")).toBeInTheDocument();
    expect(screen.getByText("Them moi: 3")).toBeInTheDocument();
    expect(screen.getByText("Cap nhat: 4")).toBeInTheDocument();
    expect(screen.getByText("Bo qua: 1")).toBeInTheDocument();
    expect(screen.getByText("Tong: 20")).toBeInTheDocument();
  });

  it("renders nothing when hidden", () => {
    const { container } = render(<DataImporterLastSyncSummaryCard visible={false} />);

    expect(container).toBeEmptyDOMElement();
  });
});
