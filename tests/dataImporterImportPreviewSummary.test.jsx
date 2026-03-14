import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import DataImporterImportPreviewSummary from "@/components/dataImporter/DataImporterImportPreviewSummary.jsx";

afterEach(() => {
  cleanup();
});

const ERROR_REASON_LABELS = {
  duplicate: "Trùng dữ liệu",
  unknown: "Không xác định",
};

describe("DataImporterImportPreviewSummary", () => {
  it("hiển thị preview summary, sample lỗi, sample thêm mới và MST mới", () => {
    render(
      <DataImporterImportPreviewSummary
        importPreview={{
          totalIncoming: 12,
          totalAfter: 10,
          mode: "overwrite",
          inserted: 2,
          updated: 3,
          skipped: 4,
          locked: 1,
          invalid: 1,
          newBusinessCount: 2,
          newBusinesses: [
            { mst: "0100123456", company: "Công ty Mới A" },
            { mst: "0100654321", company: "Công ty Mới B" },
          ],
          samples: {
            errors: [
              {
                reason: "duplicate",
                so_tk: "TK-ERR-01",
                nhanh: "HN",
                mst: "0100999999",
                company: "Công ty lỗi",
              },
            ],
            inserted: [
              {
                so_tk: "TK-NEW-01",
                nhanh: "HP",
                mst: "0100111222",
                cong_ty: "Công ty thêm mới",
                date: "2026-03-08",
                nhan_vien: "An",
                team: "Đội 1",
              },
            ],
          },
        }}
        errorReasonLabels={ERROR_REASON_LABELS}
        formatDeclarationLabel={(row) => `${row.so_tk}/${row.nhanh || "—"}`}
      />,
    );

    expect(screen.getByText("Kết quả kiểm tra trước khi import")).toBeInTheDocument();
    expect(screen.getByText("Ghi đè toàn bộ")).toBeInTheDocument();
    expect(screen.getByText("Dòng sẽ thêm mới")).toBeInTheDocument();
    expect(screen.getByText("Dòng sẽ cập nhật")).toBeInTheDocument();
    expect(screen.getByText("MST mới")).toBeInTheDocument();
    expect(screen.getByText("Dòng lỗi sẽ bị bỏ qua (1)")).toBeInTheDocument();
    expect(screen.getByText("Dòng thêm mới (2)")).toBeInTheDocument();
    expect(screen.getByText("Doanh nghiệp mới (2)")).toBeInTheDocument();

    const errorTable = screen.getByRole("table", { name: "Bảng các dòng lỗi import" });
    expect(within(errorTable).getByText("Trùng dữ liệu")).toBeInTheDocument();
    expect(within(errorTable).getByText("TK-ERR-01")).toBeInTheDocument();

    const insertedTable = screen.getByRole("table", { name: "Bảng các dòng thêm mới từ file import" });
    expect(within(insertedTable).getByText("TK-NEW-01/HP")).toBeInTheDocument();
    expect(within(insertedTable).getByText("08/03/2026")).toBeInTheDocument();
    expect(within(insertedTable).getByText("Đội 1")).toBeInTheDocument();

    expect(screen.getByText("0100123456 – Công ty Mới A")).toBeInTheDocument();
    expect(screen.getByText("0100654321 – Công ty Mới B")).toBeInTheDocument();
  });

  it("hiển thị lỗi preview khi không thể phân tích file import", () => {
    render(
      <DataImporterImportPreviewSummary
        importPreview={{
          error: { message: "Sai định dạng file" },
        }}
        errorReasonLabels={ERROR_REASON_LABELS}
      />,
    );

    expect(screen.getByText("Không thể kiểm tra file import. Sai định dạng file")).toBeInTheDocument();
    expect(screen.queryByText("Kết quả kiểm tra trước khi import")).not.toBeInTheDocument();
  });
});
