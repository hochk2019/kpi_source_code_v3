import { Button } from "@/components/ui/button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";

import StageTimelineGroups from "@/components/mst-assignment/timeline/StageTimelineGroups.jsx";

export default function MstAssignmentTimelinePanel({
  groupedStages,
  onOpenAllTimelines,
  timelineDialogState,
  onTimelineDialogOpenChange,
  formatDate,
  getStageKey,
}) {
  return (
    <>
      <div className="mt-6 rounded border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Dòng thời gian giai đoạn</h2>
            <p className="text-xs text-slate-500">Xem tổng hợp theo bộ lọc hiện tại.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAllTimelines}
            disabled={!groupedStages.length}
          >
            Mở tổng hợp ({groupedStages.length})
          </Button>
        </div>
      </div>

      <Dialog open={timelineDialogState.open} onOpenChange={onTimelineDialogOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{timelineDialogState.title || "Dòng thời gian giai đoạn"}</DialogTitle>
            {timelineDialogState.subtitle ? (
              <DialogDescription>{timelineDialogState.subtitle}</DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto pr-1">
            <StageTimelineGroups
              groups={timelineDialogState.groups}
              formatDate={formatDate}
              getStageKey={getStageKey}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
