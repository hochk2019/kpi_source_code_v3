import { describe, expect, it } from "vitest";

import {
  makeRowKey,
  tidyMST,
} from "@/components/mst-assignment/model/rowIdentity.js";

describe("tidyMST", () => {
  it("giữ chữ số và loại ký tự không phải số", () => {
    expect(tidyMST(" 03-123.456/78 ")).toBe("0312345678");
  });

  it("trả chuỗi rỗng cho nullish", () => {
    expect(tidyMST(null)).toBe("");
    expect(tidyMST(undefined)).toBe("");
  });
});

describe("makeRowKey", () => {
  it("ghép mst và khoảng ngày thành key ổn định", () => {
    expect(
      makeRowKey({
        mst: "0312345678",
        effective_from: "2026-03-01",
        effective_to: "2026-03-31",
      })
    ).toBe("0312345678__2026-03-01__2026-03-31");
  });

  it("fallback về chuỗi rỗng khi thiếu row hoặc field", () => {
    expect(makeRowKey(null)).toBe("");
    expect(makeRowKey({ mst: "0312345678" })).toBe("0312345678____");
  });
});
