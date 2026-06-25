import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import PageSkeleton from '@/components/PageSkeleton';

describe('PageSkeleton', () => {
  it('renders lightweight pulsing skeleton blocks', () => {
    const { container } = render(<PageSkeleton />);

    // Should have animate-pulse class for CSS animation
    const root = container.firstElementChild;
    expect(root).toHaveClass('animate-pulse');
  });

  it('renders within 50ms (requirement 1.3 — no heavy dependencies)', () => {
    const start = performance.now();
    render(<PageSkeleton />);
    const elapsed = performance.now() - start;

    // Must render within 50ms
    expect(elapsed).toBeLessThan(50);
  });

  it('uses aria-hidden since the parent status container handles accessibility', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders header, content rows, cards, and table skeleton blocks', () => {
    const { container } = render(<PageSkeleton />);

    // Should contain multiple skeleton blocks (rounded gray boxes)
    const roundedBoxes = container.querySelectorAll('[class*="rounded"]');
    expect(roundedBoxes.length).toBeGreaterThan(5);
  });
});
