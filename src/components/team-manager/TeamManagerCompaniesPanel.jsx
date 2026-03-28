import React from "react";

function TeamManagerCompaniesPanel({
  activeMember,
  selectedTeam,
  displayCompanies,
  pagedCompanies,
  currentCompanyPage,
  totalCompanyPages,
  showPagination,
  onShowAllTeamCompanies,
  onPreviousPage,
  onNextPage,
}) {
  return (
    <div className="border rounded p-4 bg-white shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm uppercase text-gray-500">
          {activeMember
            ? `Doanh nghiệp phụ trách của ${activeMember.name}`
            : `Doanh nghiệp theo ${selectedTeam.name}`}
        </h3>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{displayCompanies.length} doanh nghiệp đang được gán</span>

          {activeMember && (
            <button
              type="button"
              onClick={onShowAllTeamCompanies}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
            >
              Xem toàn bộ team
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        {displayCompanies.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            {activeMember
              ? "Thành viên này chưa được gán doanh nghiệp nào trong bảng MST."
              : "Team chưa được gán doanh nghiệp nào trong bảng MST."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left w-28">MST</th>
                <th className="p-2 text-left">Công ty</th>
                {activeMember ? (
                  <th className="p-2 text-left w-24">Vai trò</th>
                ) : (
                  <>
                    <th className="p-2 text-left w-40">Phụ trách Nhập</th>
                    <th className="p-2 text-left w-40">Phụ trách Xuất</th>
                  </>
                )}
                <th className="p-2 text-left w-32">Áp dụng từ</th>
              </tr>
            </thead>

            <tbody>
              {pagedCompanies.map((row, index) => (
                <tr
                  key={`${row.mst}-${row.company}-${index}-${activeMember ? row.role : "team"}`}
                  className="border-t"
                >
                  <td className="p-2">{row.mst}</td>
                  <td className="p-2">{row.company}</td>

                  {activeMember ? (
                    <td className="p-2">{row.role}</td>
                  ) : (
                    <>
                      <td className="p-2">{row.person_import}</td>
                      <td className="p-2">{row.person_export}</td>
                    </>
                  )}

                  <td className="p-2">{row.effective_from || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPagination && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={currentCompanyPage <= 1}
            className={`px-3 py-1 rounded border ${
              currentCompanyPage <= 1 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            ← Trước
          </button>

          <span>
            Trang {currentCompanyPage}/{totalCompanyPages}
          </span>

          <button
            type="button"
            onClick={onNextPage}
            disabled={currentCompanyPage >= totalCompanyPages}
            className={`px-3 py-1 rounded border ${
              currentCompanyPage >= totalCompanyPages ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}

export default TeamManagerCompaniesPanel;
