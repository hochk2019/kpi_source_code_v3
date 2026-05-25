import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterSyncStatusToast from "@/components/dataImporter/useDataImporterSyncStatusToast.js";

const STORAGE_LIMIT_ERROR_MESSAGE = "Dung luong luu tru vuot gioi han";

describe("useDataImporterSyncStatusToast", () => {
  it("shows the initial storage-limit error and dedupes repeated notifications until cleared", () => {
    let listener = null;
    const notifyError = vi.fn();
    const subscribeSyncStatus = vi.fn((nextListener) => {
      listener = nextListener;
      return vi.fn();
    });

    renderHook(() =>
      useDataImporterSyncStatusToast({
        getSyncStatus: () => ({ lastError: STORAGE_LIMIT_ERROR_MESSAGE }),
        subscribeSyncStatus,
        storageLimitErrorMessage: STORAGE_LIMIT_ERROR_MESSAGE,
        notifyError,
      }),
    );

    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError).toHaveBeenCalledWith(STORAGE_LIMIT_ERROR_MESSAGE);

    act(() => {
      listener?.({ lastError: STORAGE_LIMIT_ERROR_MESSAGE });
    });

    expect(notifyError).toHaveBeenCalledTimes(1);

    act(() => {
      listener?.({ lastError: "" });
      listener?.({ lastError: STORAGE_LIMIT_ERROR_MESSAGE });
    });

    expect(notifyError).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes on cleanup", () => {
    const unsubscribe = vi.fn();
    const subscribeSyncStatus = vi.fn(() => unsubscribe);

    const { unmount } = renderHook(() =>
      useDataImporterSyncStatusToast({
        getSyncStatus: () => ({ lastError: "" }),
        subscribeSyncStatus,
        storageLimitErrorMessage: STORAGE_LIMIT_ERROR_MESSAGE,
        notifyError: vi.fn(),
      }),
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
