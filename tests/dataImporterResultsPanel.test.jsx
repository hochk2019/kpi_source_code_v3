import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let lastTableProps = null;
let lastCardProps = null;

vi.mock("@/components/dataImporter/DataImporterTableResults.jsx", () => ({
  default: function MockDataImporterTableResults(props) {
    lastTableProps = props;
    return <div>mock-table-results</div>;
  },
}));

vi.mock("@/components/dataImporter/DataImporterCardResults.jsx", () => ({
  default: function MockDataImporterCardResults(props) {
    lastCardProps = props;
    return <div>mock-card-results</div>;
  },
}));

import DataImporterResultsPanel from "@/components/dataImporter/DataImporterResultsPanel.jsx";

afterEach(() => {
  cleanup();
  lastTableProps = null;
  lastCardProps = null;
});

describe("DataImporterResultsPanel", () => {
  it("render table mode and forwards table props", () => {
    render(
      <DataImporterResultsPanel
        viewMode="table"
        tableProps={{ pageRows: [{ so_tk: "TK-001" }], totalColumns: 5 }}
        cardProps={{ pageRows: [] }}
      />,
    );

    expect(screen.getByText("mock-table-results")).toBeInTheDocument();
    expect(screen.queryByText("mock-card-results")).toBeNull();
    expect(lastTableProps.pageRows).toEqual([{ so_tk: "TK-001" }]);
    expect(screen.getByText(/Số lượng GP được tự động đếm/)).toBeInTheDocument();
  });

  it("render card mode and forwards card props", () => {
    render(
      <DataImporterResultsPanel
        viewMode="card"
        tableProps={{ pageRows: [] }}
        cardProps={{ pageRows: [{ so_tk: "TK-002" }], selectedKeys: ["row-2"] }}
      />,
    );

    expect(screen.getByText("mock-card-results")).toBeInTheDocument();
    expect(screen.queryByText("mock-table-results")).toBeNull();
    expect(lastCardProps.selectedKeys).toEqual(["row-2"]);
    expect(screen.getByText(/Bạn có thể điều chỉnh thủ công trước khi lưu/)).toBeInTheDocument();
  });
});
