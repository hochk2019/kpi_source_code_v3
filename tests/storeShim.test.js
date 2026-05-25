import { describe, expect, it } from "vitest";

import * as store from "@/lib/store.js";
import * as storeRuntime from "@/lib/storeRuntime.js";

describe("store compatibility shim", () => {
  it("re-exports runtime facade symbols without changing references", () => {
    expect(store.getData).toBe(storeRuntime.getData);
    expect(store.saveDeclRows).toBe(storeRuntime.saveDeclRows);
    expect(store.getTeamRoster).toBe(storeRuntime.getTeamRoster);
    expect(store.getImportColumnConfig).toBe(storeRuntime.getImportColumnConfig);
    expect(store.normalizeStr).toBe(storeRuntime.normalizeStr);
    expect(store.DECL_KEY).toBe(storeRuntime.DECL_KEY);
  });
});
