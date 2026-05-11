import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDropdown } from '@/components/designSystem/primitives';

afterEach(() => {
  cleanup();
});

const ITEMS = [
  { id: 'xlsx', label: 'Excel', description: 'Xuất file .xlsx', format: 'xlsx' },
  { id: 'csv', label: 'CSV', description: 'Xuất file .csv', format: 'csv' },
  { id: 'pdf', label: 'PDF', format: 'pdf', disabled: true, disabledReason: 'Chưa hỗ trợ' },
];

describe('ExportDropdown', () => {
  it('renders trigger button with default label', () => {
    render(<ExportDropdown items={ITEMS} onExport={vi.fn()} />);
    expect(screen.getByRole('button', { name: /xuất báo cáo/i })).toBeInTheDocument();
  });

  it('renders trigger button with custom label', () => {
    render(<ExportDropdown items={ITEMS} onExport={vi.fn()} triggerLabel="Tải xuống" />);
    expect(screen.getByRole('button', { name: /tải xuống/i })).toBeInTheDocument();
  });

  it('opens dropdown on click and renders all items', async () => {
    const user = userEvent.setup();
    render(<ExportDropdown items={ITEMS} onExport={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /xuất báo cáo/i }));

    expect(await screen.findByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('calls onExport with correct item', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportDropdown items={ITEMS} onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: /xuất báo cáo/i }));
    await user.click(await screen.findByText('Excel'));

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('does not call onExport for disabled item', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportDropdown items={ITEMS} onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: /xuất báo cáo/i }));
    await user.click(await screen.findByText('PDF'));

    expect(onExport).not.toHaveBeenCalled();
  });

  it('disabled trigger button prevents opening', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportDropdown items={ITEMS} onExport={onExport} disabled />);

    const trigger = screen.getByRole('button', { name: /xuất báo cáo/i });
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByText('Excel')).not.toBeInTheDocument();
  });

  it('shows description for items that have it', async () => {
    const user = userEvent.setup();
    render(<ExportDropdown items={ITEMS} onExport={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /xuất báo cáo/i }));

    expect(await screen.findByText('Xuất file .xlsx')).toBeInTheDocument();
    expect(screen.getByText('Xuất file .csv')).toBeInTheDocument();
  });

  it('shows loading state during async export', async () => {
    const user = userEvent.setup();
    let resolveExport: () => void;
    const onExport = vi.fn(() => new Promise<void>((r) => { resolveExport = r; }));
    render(<ExportDropdown items={ITEMS} onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: /xuất báo cáo/i }));
    await user.click(await screen.findByText('Excel'));

    // Trigger should show loading spinner and be disabled
    const trigger = screen.getByRole('button', { name: /xuất báo cáo/i });
    expect(trigger).toBeDisabled();

    // Resolve the export
    resolveExport!();
    await waitFor(() => {
      expect(trigger).not.toBeDisabled();
    });
  });

  it('closes dropdown after selecting an item', async () => {
    const user = userEvent.setup();
    render(<ExportDropdown items={ITEMS} onExport={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /xuất báo cáo/i }));
    await user.click(await screen.findByText('Excel'));

    await waitFor(() => {
      expect(screen.queryByText('Excel')).not.toBeInTheDocument();
    });
  });
});
