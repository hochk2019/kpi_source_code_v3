// tests/ConflictResolutionDialog.test.jsx
// SYNC-001: Tests for Conflict Resolution Dialog

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import ConflictResolutionDialog from "../src/components/ConflictResolutionDialog.jsx";

describe("ConflictResolutionDialog", () => {
  const mockLocalData = {
    id: "1",
    name: "Local Version",
    version: 5,
    updatedAt: "2026-04-29T08:00:00Z",
  };

  const mockServerData = {
    id: "1",
    name: "Server Version",
    version: 8,
    updatedAt: "2026-04-29T10:00:00Z",
  };

  const mockConflictFields = ["name", "version"];
  const mockOnResolve = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ConflictResolutionDialog
        isOpen={false}
        localData={mockLocalData}
        serverData={mockServerData}
        onResolve={mockOnResolve}
        onClose={mockOnClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders correctly when isOpen is true", () => {
    render(
      <ConflictResolutionDialog
        isOpen={true}
        dataType="declarations"
        localData={mockLocalData}
        serverData={mockServerData}
        conflictFields={mockConflictFields}
        onResolve={mockOnResolve}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Phát hiện xung đột dữ liệu")).toBeInTheDocument();
    expect(screen.getByText("declarations")).toBeInTheDocument();
    expect(screen.getByText("📁 Phiên bản Local")).toBeInTheDocument();
    expect(screen.getByText("☁️ Phiên bản Server")).toBeInTheDocument();
  });

  it("calls onResolve with server-wins strategy when clicking Server button", () => {
    render(
      <ConflictResolutionDialog
        isOpen={true}
        localData={mockLocalData}
        serverData={mockServerData}
        onResolve={mockOnResolve}
        onClose={mockOnClose}
      />
    );

    const serverButtons = screen.getAllByTestId("server-wins-button");
    fireEvent.click(serverButtons[0]);

    expect(mockOnResolve).toHaveBeenCalledWith({
      strategy: "server-wins",
      data: mockServerData,
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onResolve with local-wins strategy when clicking Local button", () => {
    render(
      <ConflictResolutionDialog
        isOpen={true}
        localData={mockLocalData}
        serverData={mockServerData}
        onResolve={mockOnResolve}
        onClose={mockOnClose}
      />
    );

    const localButtons = screen.getAllByTestId("local-wins-button");
    fireEvent.click(localButtons[0]);

    expect(mockOnResolve).toHaveBeenCalledWith({
      strategy: "local-wins",
      data: mockLocalData,
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onCancel when clicking Cancel button", () => {
    render(
      <ConflictResolutionDialog
        isOpen={true}
        localData={mockLocalData}
        serverData={mockServerData}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    const cancelButtons = screen.getAllByTestId("cancel-button");
    fireEvent.click(cancelButtons[0]);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("displays conflict fields with values", () => {
    render(
      <ConflictResolutionDialog
        isOpen={true}
        localData={mockLocalData}
        serverData={mockServerData}
        conflictFields={mockConflictFields}
        onResolve={mockOnResolve}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Các trường bị xung đột:")).toBeInTheDocument();
    // Should show local vs server values
    expect(screen.getByText(/Local Version/)).toBeInTheDocument();
    expect(screen.getByText(/Server Version/)).toBeInTheDocument();
  });

  it("has correct ARIA attributes for accessibility", () => {
    render(
      <ConflictResolutionDialog
        isOpen={true}
        localData={mockLocalData}
        serverData={mockServerData}
        onResolve={mockOnResolve}
        onClose={mockOnClose}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "conflict-title");
  });
});
