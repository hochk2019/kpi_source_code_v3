import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

import { BackgroundStatusIndicator } from '@/components/appShell/BackgroundStatusIndicator';
import { createBackgroundOperationsStore } from '@/lib/backgroundOperationsStore';

/**
 * Component tests for BackgroundStatusIndicator — persistent non-blocking
 * status indicator surfaced in the application shell.
 *
 * Validates: Requirements 4.5
 */

describe('BackgroundStatusIndicator', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no running operations', () => {
    const store = createBackgroundOperationsStore();
    const { container } = render(<BackgroundStatusIndicator store={store} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a single running operation label', () => {
    const store = createBackgroundOperationsStore();
    store.start({ kind: 'sync', label: 'Đồng bộ ECUS' });

    render(<BackgroundStatusIndicator store={store} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getAllByText('Đồng bộ ECUS').length).toBeGreaterThan(0);
  });

  it('reacts to store changes (appears then disappears)', () => {
    const store = createBackgroundOperationsStore();
    const { container } = render(<BackgroundStatusIndicator store={store} />);

    expect(container).toBeEmptyDOMElement();

    let id;
    act(() => {
      id = store.start({ kind: 'import', label: 'Nhập dữ liệu' });
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      store.complete(id, 'success');
    });
    // Completed operations are not "running", so the indicator hides.
    expect(container).toBeEmptyDOMElement();
  });

  it('summarises multiple running operations with a count', () => {
    const store = createBackgroundOperationsStore();
    store.start({ kind: 'sync', label: 'Đồng bộ' });
    store.start({ kind: 'export', label: 'Xuất báo cáo' });

    render(<BackgroundStatusIndicator store={store} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-operation-count', '2');
    expect(status.textContent).toContain('2');
  });
});
