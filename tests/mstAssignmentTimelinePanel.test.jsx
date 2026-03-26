import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import MstAssignmentTimelinePanel from "@/components/mst-assignment/timeline/MstAssignmentTimelinePanel.jsx";

describe("mst assignment timeline panel", () => {
  it("renders timeline summary and disables the aggregate action when there are no groups", () => {
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

    expect(screen.getByText("Dòng thời gian giai đoạn")).toBeInTheDocument();
    expect(screen.getByText("Xem tổng hợp theo bộ lọc hiện tại.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở tổng hợp (0)" })).toBeDisabled();
  });

  it("opens the aggregate action and renders the dialog groups", async () => {
    const onOpenAllTimelines = vi.fn();
    const onTimelineDialogOpenChange = vi.fn();
    const baseProps = {
      groupedStages: [{ mst: "0100000001" }],
      onOpenAllTimelines,
      onTimelineDialogOpenChange,
      formatDate: (value) => `fmt:${value}`,
      getStageKey: (stage, index) => `${stage?.effective_from || "stage"}-${index}`,
    };

    const { rerender } = render(
      <MstAssignmentTimelinePanel
        {...baseProps}
        timelineDialogState={{ open: false, title: "", subtitle: "", groups: [] }}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Mở tổng hợp (1)" }));
    expect(onOpenAllTimelines).toHaveBeenCalled();

    rerender(
      <MstAssignmentTimelinePanel
        {...baseProps}
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
                  team: "Đội 1",
                  status: "Đã gán",
                },
              ],
            },
          ],
        }}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Dòng thời gian — 0100000001")).toBeInTheDocument();
    expect(within(dialog).getByText("Công ty: Công ty Ánh Dương")).toBeInTheDocument();
    expect(within(dialog).getAllByText("0100000001").length).toBeGreaterThan(0);
    expect(
      within(dialog).getAllByText((_, element) => element?.textContent?.includes("fmt:2024-01-01")).length
    ).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Lan/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Hùng/)).toBeInTheDocument();
  });
});
