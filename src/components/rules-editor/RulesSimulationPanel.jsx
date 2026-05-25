import React from "react";

import { Button } from "@/components/ui/button.tsx";

export default function RulesSimulationPanel({
  declarationCount = 0,
  simRunning = false,
  simError = "",
  simResult = null,
  onRunSimulation,
}) {
  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Mô phỏng KPI "Thu"</div>
          <p className="text-xs text-gray-500">
            Ước tính tổng điểm dựa trên {declarationCount.toLocaleString("vi-VN")} tờ khai đang lưu
            bằng phiên bản quy tắc hiện tại và bản đã lưu gần nhất.
          </p>
        </div>
        <Button onClick={onRunSimulation} disabled={simRunning || !declarationCount} variant="outline">
          {simRunning ? "Đang tính…" : "Chạy mô phỏng"}
        </Button>
      </div>
      {simError ? <p className="text-xs text-red-500">{simError}</p> : null}
      {simResult ? (
        <div className="space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            {simResult.preview ? (
              <div className="rounded border p-3">
                <div className="text-xs uppercase text-gray-500">Phiên bản đang chỉnh</div>
                <div className="text-lg font-semibold text-gray-800">
                  {simResult.preview.total.toFixed(2)} điểm
                </div>
                <div>Trung bình / tờ khai: {simResult.preview.average.toFixed(2)}</div>
                <div>Phiên bản: {simResult.preview.version}</div>
              </div>
            ) : null}
            {simResult.baseline ? (
              <div className="rounded border p-3">
                <div className="text-xs uppercase text-gray-500">Phiên bản đã lưu</div>
                <div className="text-lg font-semibold text-gray-800">
                  {simResult.baseline.total.toFixed(2)} điểm
                </div>
                <div>Trung bình / tờ khai: {simResult.baseline.average.toFixed(2)}</div>
                <div>Phiên bản: {simResult.baseline.version}</div>
              </div>
            ) : null}
          </div>
          {simResult.difference !== null ? (
            <div className="text-xs">
              Chênh lệch tổng điểm so với bản đã lưu:{" "}
              <span
                className={
                  simResult.difference >= 0
                    ? "font-semibold text-emerald-600"
                    : "font-semibold text-red-600"
                }
              >
                {simResult.difference >= 0 ? "+" : ""}
                {simResult.difference.toFixed(2)}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Chưa có dữ liệu mô phỏng. Nhấn "Chạy mô phỏng" để xem kết quả.</p>
      )}
    </div>
  );
}
