import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PageHeader } from '@/components/designSystem/PageHeader';

afterEach(() => {
  cleanup();
});

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Test Page" />);
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('renders eyebrow above title', () => {
    render(<PageHeader title="Test Page" eyebrow="SECTION" />);
    expect(screen.getByText('SECTION')).toBeInTheDocument();
    // Eyebrow should be before title in DOM order
    const eyebrow = screen.getByText('SECTION');
    const title = screen.getByText('Test Page');
    expect(eyebrow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders subtitle below title', () => {
    render(<PageHeader title="Test Page" subtitle="This is a subtitle" />);
    expect(screen.getByText('This is a subtitle')).toBeInTheDocument();
  });

  it('renders meta items', () => {
    render(
      <PageHeader
        title="Test Page"
        meta={[<span key="1">Item 1</span>, <span key="2">Item 2</span>]}
      />
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders actions', () => {
    render(
      <PageHeader
        title="Test Page"
        actions={<button>Action</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('back link triggers callback', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <PageHeader
        title="Test Page"
        back={{ label: 'Go Back', onClick: onBack }}
      />
    );
    const backLink = screen.getByText('Go Back');
    await user.click(backLink);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('info tooltip button is rendered when info prop provided', () => {
    render(<PageHeader title="Test Page" info="Tooltip content" />);
    // InfoTooltip renders a button with aria-label "Thông tin"
    expect(screen.getByLabelText('Thông tin')).toBeInTheDocument();
  });

  it('sticky mode applies sticky class', () => {
    const { container } = render(<PageHeader title="Test Page" sticky />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('sticky');
  });
});
