import { describe, expect, it } from "vitest";

import { extractDataImporterErrorMessage } from "@/components/dataImporter/dataImporterResponseErrors.js";

describe("extractDataImporterErrorMessage", () => {
  it("prefers json error and message payloads", async () => {
    const response = {
      clone() {
        return this;
      },
      async json() {
        return { error: "Lỗi đồng bộ" };
      },
      async text() {
        return "";
      },
      status: 400,
    };

    await expect(extractDataImporterErrorMessage(response, "fallback")).resolves.toBe("Lỗi đồng bộ");
  });

  it("falls back to response text and then HTTP status", async () => {
    const response = {
      clone() {
        return this;
      },
      async json() {
        throw new Error("bad json");
      },
      async text() {
        return "  Từ text  ";
      },
      status: 503,
    };

    await expect(extractDataImporterErrorMessage(response, "fallback")).resolves.toBe("Từ text");

    const statusOnly = {
      clone() {
        return this;
      },
      async json() {
        throw new Error("bad json");
      },
      async text() {
        throw new Error("bad text");
      },
      status: 502,
    };

    await expect(extractDataImporterErrorMessage(statusOnly, "fallback")).resolves.toBe("HTTP 502");
  });
});
