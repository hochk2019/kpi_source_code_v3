import React from "react";

import DataImporterCardResults from "@/components/dataImporter/DataImporterCardResults.jsx";
import DataImporterTableResults from "@/components/dataImporter/DataImporterTableResults.jsx";

export default function DataImporterResultsPanel({ viewMode, tableProps, cardProps }) {
  return (
    <>
      {viewMode === "table" ? (
        <DataImporterTableResults {...tableProps} />
      ) : (
        <DataImporterCardResults {...cardProps} />
      )}
      <p className="text-xs text-gray-500">
        * Số lượng GP được tự động đếm theo các loại giấy phép hợp lệ (đã loại trừ theo mục Quy tắc KPI).
        Bạn có thể điều chỉnh thủ công trước khi lưu để phản ánh thực tế kiểm tra.
      </p>
    </>
  );
}
