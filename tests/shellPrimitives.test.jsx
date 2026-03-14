import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  SearchField,
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from '@/components/designSystem/shellPrimitives.jsx';

describe('shellPrimitives', () => {
  it('renders an accessible search field with clear action and trailing content', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleClear = vi.fn();

    render(
      <SearchField
        label="Tìm tài khoản"
        hideLabel
        value="admin"
        onChange={handleChange}
        onClear={handleClear}
        trailingContent={<span>Ctrl+K</span>}
      />,
    );

    expect(screen.getByRole('searchbox', { name: 'Tìm tài khoản' })).toHaveValue('admin');
    expect(screen.getByText('Ctrl+K')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /xóa tìm kiếm/i }));

    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('renders shared section chrome for headers and toolbars', () => {
    render(
      <SectionSurface>
        <SectionHeader
          title="Danh sách tài khoản"
          description="Theo dõi quyền truy cập và trạng thái gắn nhân viên."
          meta={<span>2/2 tài khoản</span>}
          actions={
            <button type="button">
              Làm mới
            </button>
          }
        />
        <SectionToolbar
          actions={
            <button type="button">
              Xuất
            </button>
          }
        >
          <span>Bộ lọc</span>
        </SectionToolbar>
      </SectionSurface>,
    );

    expect(screen.getByRole('heading', { name: /danh sách tài khoản/i })).toBeInTheDocument();
    expect(screen.getByText(/theo dõi quyền truy cập/i)).toBeInTheDocument();
    expect(screen.getByText('2/2 tài khoản')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất' })).toBeInTheDocument();
    expect(screen.getByText('Bộ lọc')).toBeInTheDocument();
  });
});
