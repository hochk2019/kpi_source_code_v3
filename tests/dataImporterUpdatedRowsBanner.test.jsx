import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterUpdatedRowsBanner from "@/components/dataImporter/DataImporterUpdatedRowsBanner.jsx";

afterEach(() => {
  cleanup();
});

describe("DataImporterUpdatedRowsBanner", () => {
  it("renders updated rows, preview chips, and action handlers", async () => {
    const user = userEvent.setup();
    const onSelectUpdated = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <DataImporterUpdatedRowsBanner
        isAdminRole
        showUpdatedBanner
        lastSyncUpdated={3}
        lastSyncRunAtLabel="11/03/2026 08:00"
        updatedPreview={[
          { so_tk: "TK-1", nhanh: "HN" },
          { so_tk: "TK-2", nhanh: "" },
        ]}
        updatedDeclarations={[
          { so_tk: "TK-1", nhanh: "HN" },
          { so_tk: "TK-2", nhanh: "" },
          { so_tk: "TK-3", nhanh: "HP" },
        ]}
        formatDeclarationLabel={(entry) => `${entry.so_tk}/${entry.nhanh || "main"}`}
        onSelectUpdated={onSelectUpdated}
        onClearSelection={onClearSelection}
      />,
    );

    expect(screen.getByText("Cap nhat 3 to khai trong lan dong bo gan nhat")).toBeInTheDocument();
    expect(screen.getByText("Thoi diem: 11/03/2026 08:00")).toBeInTheDocument();
    expect(screen.getByText("TK-1/HN")).toBeInTheDocument();
    expect(screen.getByText("TK-2/main")).toBeInTheDocument();
    expect(screen.getByText("+1 khac")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Chon tren bang" }));
    await user.click(screen.getByRole("button", { name: "Bo chon" }));

    expect(onSelectUpdated).toHaveBeenCalledTimes(1);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the banner should stay hidden", () => {
    const { container } = render(
      <DataImporterUpdatedRowsBanner
        isAdminRole={false}
        showUpdatedBanner
        updatedPreview={[]}
        updatedDeclarations={[]}
        formatDeclarationLabel={() => ""}
        onSelectUpdated={() => {}}
        onClearSelection={() => {}}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
