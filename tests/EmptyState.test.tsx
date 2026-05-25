import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/designSystem/primitives';

afterEach(() => {
  cleanup();
});

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<EmptyState title="No data" description="No records found" />);
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('hides description in compact size', () => {
    const { queryByText } = render(
      <EmptyState title="No data" description="Should be hidden" size="compact" />
    );
    expect(queryByText('Should be hidden')).not.toBeInTheDocument();
  });

  it('renders actions', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No data"
        actions={[{ label: 'Create', onClick }]}
      />
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('calls action on click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No data"
        actions={[{ label: 'Create', onClick }]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders with icon', () => {
    const { container } = render(
      <EmptyState title="No data" icon={<span data-testid="icon">📄</span>} />
    );
    expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<EmptyState title="Test" size="compact" />);
    rerender(<EmptyState title="Test" size="md" />);
    rerender(<EmptyState title="Test" size="lg" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('applies tone class', () => {
    const { container } = render(<EmptyState title="Test" tone="info" icon={<span>!</span>} />);
    expect(container.querySelector('.text-ds-info')).toBeInTheDocument();
  });
});
