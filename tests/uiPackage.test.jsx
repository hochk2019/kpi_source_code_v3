import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  DataTable,
  SearchField,
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "../packages/ui/src/index.js";

describe("packages/ui", () => {
  it("renders shared shell primitives from the workspace package", async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();

    render(
      <SectionSurface>
        <SectionHeader title="Danh sách tài khoản" description="Theo dõi quyền truy cập." />
        <SectionToolbar actions={<button type="button">Xuất</button>}>
          <SearchField
            label="Tìm tài khoản"
            hideLabel
            value="admin"
            onChange={() => {}}
            onClear={handleClear}
          />
        </SectionToolbar>
      </SectionSurface>,
    );

    expect(screen.getByRole("heading", { name: "Danh sách tài khoản" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Tìm tài khoản" })).toHaveValue("admin");

    await user.click(screen.getByRole("button", { name: /xóa tìm kiếm/i }));

    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it("renders the shared data table from the workspace package", () => {
    render(
      <DataTable
        ariaLabel="Bảng tài khoản"
        caption="Bảng tài khoản"
        columns={[
          { key: "name", label: "Tên", renderCell: (row) => row.name },
          { key: "role", label: "Vai trò", renderCell: (row) => row.role },
        ]}
        data={[{ id: "acc-1", name: "Admin", role: "Quản trị" }]}
        rowKey="id"
      />,
    );

    expect(screen.getByRole("table", { name: "Bảng tài khoản" })).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText(/Quản trị/i)).toBeInTheDocument();
  });
});
