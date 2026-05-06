import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import useRulesEditorWorkflow from "@/components/rules-editor/hooks/useRulesEditorWorkflow.js";
import * as rulesModule from "@/lib/rules.js";
import { clearStorageCache } from "@/lib/storageClient.js";
import { toast } from "@/shared/toast";
import { AppDialogProvider } from "@/hooks/useAppDialog.tsx";

vi.mock("@/shared/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const { appDialogAlertMock, appDialogConfirmMock } = vi.hoisted(() => ({
  appDialogAlertMock: vi.fn().mockResolvedValue(undefined),
  appDialogConfirmMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => ({
    alert: appDialogAlertMock,
    confirm: appDialogConfirmMock,
  }),
  AppDialogProvider: ({ children }) => children,
}));

function createHistoryEntry() {
  const currentRule = rulesModule.loadRules();

  return {
    id: "history-1",
    name: "Bộ lịch sử test",
    updatedAt: "2026-03-25T10:00:00.000Z",
    applyFrom: "2026-03-01",
    snapshot: {
      ...currentRule,
      id: currentRule.id,
      name: "Bộ lịch sử test",
      version: 3,
      points: { base: 1.5, licenses: 0.3 },
    },
  };
}

function UseRulesEditorWorkflowHarness({
  canEdit = true,
  currentUser = { username: "admin" },
  data = [],
  restoreEntry = null,
}) {
  const state = useRulesEditorWorkflow({ canEdit, currentUser, data });

  return (
    <>
      <button type="button" onClick={state.runSimulation}>
        run-simulation
      </button>
      <button type="button" onClick={state.handleHistoryRefresh}>
        refresh-history
      </button>
      <button
        type="button"
        onClick={() => {
          if (restoreEntry) {
            state.handleRestoreEntry(restoreEntry);
          }
        }}
      >
        restore-history
      </button>
      <pre data-testid="sim-result">{JSON.stringify(state.simResult)}</pre>
      <pre data-testid="history-state">
        {JSON.stringify({
          count: state.historyEntries.length,
          loading: state.historyLoading,
          error: state.historyError,
        })}
      </pre>
      <pre data-testid="version-state">
        {JSON.stringify({
          currentVersion: state.currentVersion,
          savedVersion: state.savedVersion,
          isDefaultRule: state.isDefaultRule,
        })}
      </pre>
    </>
  );
}

describe("useRulesEditorWorkflow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearStorageCache();

    appDialogAlertMock.mockReset().mockResolvedValue(undefined);
    appDialogConfirmMock.mockReset().mockResolvedValue(true);

    const historyEntry = createHistoryEntry();
    vi.spyOn(rulesModule, "fetchRulesHistoryFromServer").mockResolvedValue([historyEntry]);
    vi.spyOn(rulesModule, "getRulesHistory").mockReturnValue([historyEntry]);
    vi.spyOn(rulesModule, "restoreRuleVersion").mockImplementation((snapshot) => ({
      ...snapshot,
      updatedAt: new Date("2026-03-25T11:00:00.000Z").toISOString(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    clearStorageCache();
  });

  it("mo phong KPI tu preview va saved snapshot", async () => {
    render(
      <AppDialogProvider>
        <UseRulesEditorWorkflowHarness
          data={[
            {
              loai_hinh: "A11",
              num_items: 3,
              licenseCodes: [],
            },
          ]}
        />
      </AppDialogProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "run-simulation" }));

    await waitFor(() => {
      expect(screen.getByTestId("sim-result").textContent).toContain('"count":1');
    });
    expect(screen.getByTestId("sim-result").textContent).toContain('"preview"');
    expect(screen.getByTestId("sim-result").textContent).toContain('"baseline"');
    expect(screen.getByTestId("sim-result").textContent).toContain('"difference":0');
    expect(screen.getByTestId("version-state").textContent).toContain('"isDefaultRule":true');
  });

  it("tai lai lich su va khoi phuc phien ban qua hook", async () => {
    const historyEntry = createHistoryEntry();

    render(
      <AppDialogProvider>
        <UseRulesEditorWorkflowHarness
          data={[{ loai_hinh: "A11", num_items: 2, licenseCodes: [] }]}
          restoreEntry={historyEntry}
        />
      </AppDialogProvider>
    );

    await waitFor(() => {
      expect(rulesModule.fetchRulesHistoryFromServer).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("history-state").textContent).toContain('"count":1');

    fireEvent.click(screen.getByRole("button", { name: "refresh-history" }));

    await waitFor(() => {
      expect(rulesModule.fetchRulesHistoryFromServer).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "restore-history" }));

    expect(appDialogConfirmMock).toHaveBeenCalledWith(expect.stringContaining("Khôi phục phiên bản 3"));
    await waitFor(() => {
      expect(rulesModule.restoreRuleVersion).toHaveBeenCalledWith(
        expect.objectContaining({ version: 3, name: "Bộ lịch sử test" }),
        expect.objectContaining({ actor: "admin", setAsDefault: true })
      );
    });
    expect(toast.success).toHaveBeenCalled();
  });
});
