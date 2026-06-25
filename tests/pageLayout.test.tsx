import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';
import { PageLayout } from '@/components/layout/PageLayout';

afterEach(cleanup);

describe('PageLayout', () => {
  it('renders the title in the header', () => {
    render(<PageLayout title="Test Page">Content</PageLayout>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Page');
  });

  it('renders children in the content area', () => {
    render(
      <PageLayout title="Page">
        <p>Main content here</p>
      </PageLayout>
    );
    expect(screen.getByText('Main content here')).toBeInTheDocument();
  });

  it('renders actions in the header when provided', () => {
    render(
      <PageLayout title="Page" actions={<button>Export</button>}>
        Content
      </PageLayout>
    );
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('does not render an actions container when actions is not provided', () => {
    const { container } = render(<PageLayout title="Page">Content</PageLayout>);
    expect(container.querySelector('.page-layout__actions')).toBeNull();
  });

  it('renders the sidebar when provided', () => {
    render(
      <PageLayout title="Page" sidebar={<nav>Sidebar nav</nav>}>
        Content
      </PageLayout>
    );
    expect(screen.getByText('Sidebar nav')).toBeInTheDocument();
    expect(document.querySelector('.page-layout__sidebar')).not.toBeNull();
  });

  it('does not render a sidebar element when sidebar is not provided', () => {
    const { container } = render(<PageLayout title="Page">Content</PageLayout>);
    expect(container.querySelector('.page-layout__sidebar')).toBeNull();
  });

  it('applies custom className to the root container', () => {
    const { container } = render(
      <PageLayout title="Page" className="custom-class">
        Content
      </PageLayout>
    );
    expect(container.firstElementChild).toHaveClass('custom-class');
  });

  it('renders header, content area, and sidebar together correctly', () => {
    const { container } = render(
      <PageLayout
        title="Full Layout"
        actions={<button>Save</button>}
        sidebar={<div>Filters</div>}
      >
        <div>Dashboard content</div>
      </PageLayout>
    );

    const root = within(container);

    // Header with title and actions
    expect(root.getByRole('heading', { level: 1 })).toHaveTextContent('Full Layout');
    expect(root.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    // Sidebar
    expect(root.getByText('Filters')).toBeInTheDocument();
    expect(container.querySelector('.page-layout__sidebar')).not.toBeNull();

    // Main content
    expect(root.getByText('Dashboard content')).toBeInTheDocument();
    expect(container.querySelector('.page-layout__content')).not.toBeNull();
  });
});
