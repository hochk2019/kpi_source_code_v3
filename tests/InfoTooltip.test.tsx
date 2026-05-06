import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InfoTooltip } from '@/components/designSystem/PageHeader';

afterEach(() => {
  cleanup();
});

describe('InfoTooltip', () => {
  it('renders info button with aria-label', () => {
    render(<InfoTooltip content="Tooltip text" />);
    expect(screen.getByLabelText('Thông tin')).toBeInTheDocument();
  });

  it('accepts custom aria-label', () => {
    render(<InfoTooltip content="Tooltip text" ariaLabel="Custom label" />);
    expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
  });

  it('button has focusable attributes', () => {
    render(<InfoTooltip content="Tooltip text" />);
    const button = screen.getByLabelText('Thông tin');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveFocus();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<InfoTooltip content="Tooltip" size="xs" />);
    expect(screen.getByLabelText('Thông tin')).toBeInTheDocument();
    
    rerender(<InfoTooltip content="Tooltip" size="sm" />);
    expect(screen.getByLabelText('Thông tin')).toBeInTheDocument();
    
    rerender(<InfoTooltip content="Tooltip" size="md" />);
    expect(screen.getByLabelText('Thông tin')).toBeInTheDocument();
  });

  it('applies subtle variant class', () => {
    const { container } = render(<InfoTooltip content="Tooltip" variant="subtle" />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('opacity-60');
  });
});
