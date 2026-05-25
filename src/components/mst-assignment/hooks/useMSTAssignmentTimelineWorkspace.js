import { useCallback, useMemo, useState } from "react";

import { buildTimelineGroupsByMST } from "@/components/mst-assignment/model/displaySelectors.js";

export default function useMSTAssignmentTimelineWorkspace({ groupedStages }) {
  const timelineGroupsByMST = useMemo(() => {
    return buildTimelineGroupsByMST(groupedStages);
  }, [groupedStages]);

  const [timelineDialogState, setTimelineDialogState] = useState({
    open: false,
    groups: [],
    title: "",
    subtitle: "",
  });

  const showTimelineDialog = useCallback(({ title, subtitle, groups }) => {
    const normalizedGroups = Array.isArray(groups) ? groups.filter(Boolean) : [];

    if (!normalizedGroups.length) {
      setTimelineDialogState((prev) => ({ ...prev, open: false }));
      return;
    }

    setTimelineDialogState({
      open: true,
      groups: normalizedGroups,
      title: title || "Dòng thời gian giai đoạn",
      subtitle: subtitle || "",
    });
  }, []);

  const handleTimelineDialogOpenChange = useCallback((nextOpen) => {
    setTimelineDialogState((prev) => ({ ...prev, open: nextOpen }));
  }, []);

  const handleOpenTimelineGroup = useCallback(
    (group) => {
      if (!group) return;

      const safeGroup = {
        mst: group?.mst || "",
        company: group?.company || "",
        stages: Array.isArray(group?.stages) ? group.stages : [],
      };

      showTimelineDialog({
        title: `Dòng thời gian — ${safeGroup.mst || "(MST trống)"}`,
        subtitle: safeGroup.company ? `Công ty: ${safeGroup.company}` : "",
        groups: [safeGroup],
      });
    },
    [showTimelineDialog]
  );

  const handleOpenAllTimelines = useCallback(() => {
    if (!groupedStages.length) return;

    showTimelineDialog({
      title: "Dòng thời gian giai đoạn",
      subtitle: `${groupedStages.length} MST khớp bộ lọc hiện tại`,
      groups: groupedStages,
    });
  }, [groupedStages, showTimelineDialog]);

  return {
    handleOpenAllTimelines,
    handleOpenTimelineGroup,
    handleTimelineDialogOpenChange,
    timelineDialogState,
    timelineGroupsByMST,
  };
}
