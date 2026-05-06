import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState } from '@/components/designSystem/primitives';

describe('LoadingState', () => {
  it('renders default message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<LoadingState message="Loading data" />);
    expect(screen.getByText('Loading data')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<LoadingState description="Please wait" />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });

  it('renders spinner by default', () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders custom icon', () => {
    const { container } = render(
      <LoadingState icon={<span data-testid="custom-icon">⏳</span>} />
    );
    expect(container.querySelector('[data-testid="custom-icon"]')).toBeInTheDocument();
  });

  it('renders different sizes', () => {
    const { rerender } = render(<LoadingState size="sm" />);
    rerender(<LoadingState size="md" />);
    rerender(<LoadingState size="lg" />);
    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
  });

  it('has status role', () => {
    const { container } = render(<LoadingState />);
    expect(container.firstChild).toHaveAttribute('role', 'status');
  });

  it('has aria-live polite', () => {
    const { container } = render(<LoadingState />);
    expect(container.firstChild).toHaveAttribute('aria-live', 'polite');
  });
});
