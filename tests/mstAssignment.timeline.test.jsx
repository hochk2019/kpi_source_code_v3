import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MstAssignmentTimelinePanel from "@/components/mst-assignment/timeline/MstAssignmentTimelinePanel.jsx";

afterEach(() => {
  cleanup();
});

describe("MSTAssignment timeline", () => {
  it("shows disabled aggregate action when there is no grouped stage", () => {
    render(
      <MstAssignmentTimelinePanel
        groupedStages={[]}
        onOpenAllTimelines={vi.fn()}
        timelineDialogState={{ open: false, title: "", subtitle: "", groups: [] }}
        onTimelineDialogOpenChange={vi.fn()}
        formatDate={(value) => value}
        getStageKey={(stage, index) => `${stage?.mst || "stage"}-${index}`}
      />
    );

    expect(screen.getByRole("button", { name: "Mở tổng hợp (0)" })).toBeDisabled();
  });

  it("renders grouped stages in dialog timeline", () => {
    render(
      <MstAssignmentTimelinePanel
        groupedStages={[{ mst: "0100000001" }]}
        onOpenAllTimelines={vi.fn()}
        timelineDialogState={{
          open: true,
          title: "Dòng thời gian — 0100000001",
          subtitle: "Công ty: Công ty Ánh Dương",
          groups: [
            {
              mst: "0100000001",
              company: "Công ty Ánh Dương",
              stages: [
                {
                  effective_from: "2024-01-01",
                  effective_to: "",
                  person_import: "Lan",
                  person_export: "Hùng",
                  status: "Đã gán",
                },
              ],
            },
          ],
        }}
        onTimelineDialogOpenChange={vi.fn()}
        formatDate={(value) => value}
        getStageKey={(stage, index) => `${stage?.effective_from || "stage"}-${index}`}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Dòng thời gian — 0100000001/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText(/0100000001/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Lan/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Hùng/)).toBeInTheDocument();
  });
});
