import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActionBar } from '@/components/designSystem/primitives';

afterEach(() => {
  cleanup();
});

describe('BulkActionBar', () => {
  it('hidden when selectedCount=0 and autoHide=true', () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={0}
        actions={[{ id: 'delete', label: 'Delete' }]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('visible when selectedCount > 0', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        actions={[{ id: 'delete', label: 'Delete' }]}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('đã chọn')).toBeInTheDocument();
  });

  it('shows total count when provided', () => {
    render(
      <BulkActionBar
        selectedCount={2}
        totalCount={10}
        actions={[{ id: 'delete', label: 'Delete' }]}
      />
    );
    expect(screen.getByText('2/10')).toBeInTheDocument();
  });

  it('calls onClear when clear button clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <BulkActionBar
        selectedCount={3}
        actions={[{ id: 'delete', label: 'Delete' }]}
        onClear={onClear}
      />
    );
    await user.click(screen.getByText('Bỏ chọn'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectAll when select all clicked', async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    render(
      <BulkActionBar
        selectedCount={2}
        totalCount={10}
        actions={[{ id: 'delete', label: 'Delete' }]}
        onSelectAll={onSelectAll}
      />
    );
    await user.click(screen.getByText('Chọn tất cả 10'));
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('calls action on click', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <BulkActionBar
        selectedCount={3}
        actions={[{ id: 'delete', label: 'Delete', onClick: onDelete }]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('respects disabled actions', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        actions={[{ id: 'delete', label: 'Delete', disabled: true, disabledReason: 'Cannot delete' }]}
      />
    );
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'Cannot delete');
  });
});
