function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function sortByValueDescending(items = []) {
  return [...items].sort((left = {}, right = {}) => toNumber(right.value) - toNumber(left.value));
}

export function buildExecutiveSummaryModel({
  summary = {},
  adjustmentsReport = {},
  trendComparison = null,
  topStaffByKpi = [],
  teamPieData = [],
} = {}) {
  const totalKpi = toNumber(summary.kpi);
  const totalDecls = toNumber(summary.decls);
  const kpiPerDecl = totalDecls > 0 ? totalKpi / totalDecls : 0;
  const topStaff = Array.isArray(topStaffByKpi) && topStaffByKpi.length ? topStaffByKpi[0] : null;
  const sortedTeams = sortByValueDescending(teamPieData);
  const topTeam = sortedTeams.length ? sortedTeams[0] : null;
  const topTeamShare = totalKpi > 0 && topTeam ? (toNumber(topTeam.value) / totalKpi) * 100 : 0;
  const pendingAdjustments = toNumber(adjustmentsReport.pendingCount);
  const approvedAdjustments = toNumber(adjustmentsReport.approvedCount);
  const deltaKpi = toNumber(trendComparison?.delta?.kpi);
  const deltaDecls = toNumber(trendComparison?.delta?.decls);
  const deltaPercent =
    trendComparison?.delta?.kpiPercent === null || trendComparison?.delta?.kpiPercent === undefined
      ? null
      : toNumber(trendComparison.delta.kpiPercent);

  const highlights = [
    {
      title: "KPI / tờ khai",
      value: kpiPerDecl,
      valueType: "decimal",
      subtitle: totalDecls > 0 ? `${totalDecls} tờ khai trong kỳ` : "Chưa có tờ khai hợp lệ trong kỳ",
    },
    {
      title: "Nhân sự dẫn đầu",
      value: topStaff?.name || "Chưa có dữ liệu",
      valueType: "text",
      subtitle: topStaff ? `${toNumber(topStaff?.stats?.kpi)} điểm KPI` : "Cần dữ liệu KPI để xếp hạng",
    },
    {
      title: "Tổ đội chiếm tỷ trọng cao nhất",
      value: topTeam?.name || "Chưa có dữ liệu",
      valueType: "text",
      subtitle: topTeam ? `${topTeamShare.toFixed(1)}% tổng KPI` : "Chưa có dữ liệu phân bổ KPI",
    },
    {
      title: "Điều chỉnh chờ duyệt",
      value: pendingAdjustments,
      valueType: "int",
      subtitle:
        approvedAdjustments > 0
          ? `${approvedAdjustments} điều chỉnh đã duyệt trong kỳ`
          : "Chưa có điều chỉnh được duyệt trong kỳ",
    },
  ];

  const signals = [];

  if (deltaKpi < 0) {
    signals.push({
      tone: "critical",
      title: "Xu hướng KPI đang giảm",
      detail:
        deltaPercent === null
          ? `${deltaKpi.toFixed(1)} điểm KPI so với kỳ liền trước, trong khi số tờ khai đổi ${deltaDecls}.`
          : `${deltaKpi.toFixed(1)} điểm KPI (${deltaPercent.toFixed(1)}%) so với kỳ liền trước, trong khi số tờ khai đổi ${deltaDecls}.`,
    });
  } else if (deltaKpi > 0) {
    signals.push({
      tone: "positive",
      title: "Xu hướng KPI đang tăng",
      detail:
        deltaPercent === null
          ? `Tăng ${deltaKpi.toFixed(1)} điểm KPI so với kỳ liền trước; số tờ khai đổi ${deltaDecls}.`
          : `Tăng ${deltaKpi.toFixed(1)} điểm KPI (${deltaPercent.toFixed(1)}%) so với kỳ liền trước; số tờ khai đổi ${deltaDecls}.`,
    });
  }

  if (pendingAdjustments > 0) {
    signals.push({
      tone: "warning",
      title: "Điều chỉnh KPI chưa khóa sổ",
      detail: `${pendingAdjustments} điều chỉnh đang chờ duyệt, cần chốt trước khi phát hành báo cáo điều hành.`,
    });
  }

  if (topTeam && sortedTeams.length > 1 && topTeamShare >= 45) {
    signals.push({
      tone: "warning",
      title: "KPI đang tập trung mạnh vào một tổ đội",
      detail: `${topTeam.name} chiếm ${topTeamShare.toFixed(1)}% tổng KPI, cần kiểm tra xem đây là đỉnh năng suất hay lệch tải.`,
    });
  }

  if (topStaff && totalKpi > 0) {
    const topStaffShare = (toNumber(topStaff?.stats?.kpi) / totalKpi) * 100;
    if (topStaffShare >= 35) {
      signals.push({
        tone: "warning",
        title: "Top nhân sự chiếm tỷ trọng KPI cao",
        detail: `${topStaff.name} đang đóng góp ${topStaffShare.toFixed(1)}% tổng KPI của kỳ này.`,
      });
    }
  }

  return {
    highlights,
    signals,
  };
}
