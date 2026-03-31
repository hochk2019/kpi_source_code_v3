import { describe, expect, it } from "vitest";
import { createSyncError, normalizeSyncError } from "@/lib/storageSyncErrors.js";

describe("storageSyncErrors", () => {
  it("chuẩn hoá lỗi mạng về thông điệp retry rõ ràng", () => {
    const normalized = normalizeSyncError(new Error("Failed to fetch"), {
      storageLimitMessage: "LIMIT",
    });

    expect(normalized.code).toBe("network_unreachable");
    expect(normalized.retryable).toBe(true);
    expect(normalized.message).toContain("Không thể kết nối máy chủ đồng bộ");
    expect(normalized.hint).toContain("Kiểm tra mạng/VPN");
  });

  it("giữ nguyên metadata khi lỗi đã được gắn chuẩn từ trước", () => {
    const err = createSyncError({
      code: "write_request_failed",
      message: "Không thể gửi dữ liệu đồng bộ: offline",
      retryable: true,
      hint: "Thử lại",
    });
    const normalized = normalizeSyncError(err, { storageLimitMessage: "LIMIT" });

    expect(normalized.code).toBe("write_request_failed");
    expect(normalized.retryable).toBe(true);
    expect(normalized.message).toBe("Không thể gửi dữ liệu đồng bộ: offline");
    expect(normalized.hint).toBe("Thử lại");
  });

  it("ánh xạ HTTP 413 về thông điệp giới hạn dung lượng và chặn auto-retry", () => {
    const err = createSyncError({
      code: "http_non_retryable",
      status: 413,
      message: "HTTP 413 Payload Too Large",
      retryable: false,
    });
    const normalized = normalizeSyncError(err, {
      storageLimitMessage: "LIMIT MESSAGE",
    });

    expect(normalized.code).toBe("payload_too_large");
    expect(normalized.retryable).toBe(false);
    expect(normalized.message).toBe("LIMIT MESSAGE");
  });
});
