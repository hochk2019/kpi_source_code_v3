import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import DataImporterLastSyncSummaryCard from "@/components/dataImporter/DataImporterLastSyncSummaryCard.jsx";

afterEach(() => {
  cleanup();
});

describe("DataImporterLastSyncSummaryCard", () => {
  it("renders the latest sync summary details when visible", () => {
    const recentRunAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    render(
      <DataImporterLastSyncSummaryCard
        visible
        rangeLabel="01/03/2026 - 08/03/2026"
        runAtLabel="11/03/2026 08:00"
        runAt={recentRunAt}
        fetched={12}
        inserted={3}
        updated={4}
        skipped={1}
        total={20}
      />,
    );

    expect(screen.getByText("Kết quả đồng bộ gần nhất")).toBeInTheDocument();
    expect(screen.getByText("Khoảng: 01/03/2026 - 08/03/2026")).toBeInTheDocument();
    expect(screen.getByText("Run: 11/03/2026 08:00")).toBeInTheDocument();
    expect(screen.getByText("Thu thập: 12")).toBeInTheDocument();
    expect(screen.getByText("Thêm mới: 3")).toBeInTheDocument();
    expect(screen.getByText("Cập nhật: 4")).toBeInTheDocument();
    expect(screen.getByText("Bỏ qua: 1")).toBeInTheDocument();
    expect(screen.getByText("Tổng: 20")).toBeInTheDocument();
  });

  it("renders nothing when hidden", () => {
    const { container } = render(<DataImporterLastSyncSummaryCard visible={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows stale warning when data is older than 24 hours", () => {
    const staleRunAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
    render(
      <DataImporterLastSyncSummaryCard
        visible
        rangeLabel="01/03/2026 - 08/03/2026"
        runAtLabel="08/03/2026 08:00"
        runAt={staleRunAt}
        fetched={10}
        inserted={5}
        updated={2}
        skipped={1}
        total={18}
      />,
    );

    expect(screen.getByText("Cảnh báo: dữ liệu đồng bộ đã cũ")).toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu được đồng bộ cách đây 3 ngày/)).toBeInTheDocument();
  });

  it("does not show stale warning when data is recent", () => {
    const recentRunAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
    render(
      <DataImporterLastSyncSummaryCard
        visible
        rangeLabel="01/03/2026 - 08/03/2026"
        runAtLabel="11/03/2026 08:00"
        runAt={recentRunAt}
        fetched={10}
        inserted={5}
        updated={2}
        skipped={1}
        total={18}
      />,
    );

    expect(screen.getByText("Kết quả đồng bộ gần nhất")).toBeInTheDocument();
    expect(screen.queryByText(/Cảnh báo/)).not.toBeInTheDocument();
  });

  it("handles missing runAt gracefully", () => {
    render(
      <DataImporterLastSyncSummaryCard
        visible
        rangeLabel="01/03/2026 - 08/03/2026"
        runAtLabel="11/03/2026 08:00"
        fetched={10}
        inserted={5}
        updated={2}
        skipped={1}
        total={18}
      />,
    );

    expect(screen.getByText("Kết quả đồng bộ gần nhất")).toBeInTheDocument();
    expect(screen.queryByText(/Cảnh báo/)).not.toBeInTheDocument();
  });
});
