import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { generateBreadcrumbs, toTitleCase, Breadcrumbs } from '@/components/layout/Breadcrumbs';

afterEach(cleanup);

// ─── Unit Tests: toTitleCase ────────────────────────────────────────────────

describe('toTitleCase', () => {
  it('converts a simple word to title case', () => {
    expect(toTitleCase('reports')).toBe('Reports');
  });

  it('converts kebab-case to title case with spaces', () => {
    expect(toTitleCase('data-import')).toBe('Data Import');
  });

  it('handles multi-word kebab-case', () => {
    expect(toTitleCase('kpi-adjustment-rules')).toBe('Kpi Adjustment Rules');
  });

  it('handles single character segments', () => {
    expect(toTitleCase('a')).toBe('A');
  });

  it('returns empty string for empty input', () => {
    expect(toTitleCase('')).toBe('');
  });
});

// ─── Unit Tests: generateBreadcrumbs ────────────────────────────────────────

describe('generateBreadcrumbs', () => {
  it('returns only Home for root path "/"', () => {
    const result = generateBreadcrumbs('/');
    expect(result).toEqual([{ label: 'Home', path: '/' }]);
  });

  it('generates correct breadcrumbs for a single-level path', () => {
    const result = generateBreadcrumbs('/reports');
    expect(result).toEqual([
      { label: 'Home', path: '/' },
      { label: 'Reports', path: '/reports' },
    ]);
  });

  it('generates correct breadcrumbs for a multi-level path', () => {
    const result = generateBreadcrumbs('/reports/monthly');
    expect(result).toEqual([
      { label: 'Home', path: '/' },
      { label: 'Reports', path: '/reports' },
      { label: 'Monthly', path: '/reports/monthly' },
    ]);
  });

  it('generates correct breadcrumbs for a 3-level path', () => {
    const result = generateBreadcrumbs('/admin/settings/general');
    expect(result).toEqual([
      { label: 'Home', path: '/' },
      { label: 'Admin', path: '/admin' },
      { label: 'Settings', path: '/admin/settings' },
      { label: 'General', path: '/admin/settings/general' },
    ]);
  });

  it('converts kebab-case segments to title case', () => {
    const result = generateBreadcrumbs('/data-import');
    expect(result).toEqual([
      { label: 'Home', path: '/' },
      { label: 'Data Import', path: '/data-import' },
    ]);
  });

  it('uses custom routeLabels when provided', () => {
    const routeLabels = { 'data-import': 'Import Wizard', monthly: 'Monthly View' };
    const result = generateBreadcrumbs('/reports/monthly', routeLabels);
    expect(result).toEqual([
      { label: 'Home', path: '/' },
      { label: 'Reports', path: '/reports' },
      { label: 'Monthly View', path: '/reports/monthly' },
    ]);
  });

  it('falls back to title case when segment is not in routeLabels', () => {
    const routeLabels = { reports: 'Report Center' };
    const result = generateBreadcrumbs('/reports/monthly', routeLabels);
    expect(result).toEqual([
      { label: 'Home', path: '/' },
      { label: 'Report Center', path: '/reports' },
      { label: 'Monthly', path: '/reports/monthly' },
    ]);
  });

  it('strips trailing slash from path', () => {
    const result = generateBreadcrumbs('/reports/monthly/');
    expect(result).toEqual([
      { label: 'Home', path: '/' },
      { label: 'Reports', path: '/reports' },
      { label: 'Monthly', path: '/reports/monthly' },
    ]);
  });

  it('each segment path is a prefix of the next', () => {
    const result = generateBreadcrumbs('/a/b/c/d');
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i + 1].path.startsWith(result[i].path === '/' ? '/' : result[i].path)).toBe(true);
    }
  });

  it('final segment path equals the input path', () => {
    const path = '/reports/monthly';
    const result = generateBreadcrumbs(path);
    expect(result[result.length - 1].path).toBe(path);
  });
});

// ─── Component Tests: Breadcrumbs ───────────────────────────────────────────

describe('Breadcrumbs component', () => {
  const renderWithRouter = (ui: React.ReactElement, initialEntries = ['/reports/monthly']) =>
    render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);

  it('renders nothing when at root path', () => {
    const { container } = renderWithRouter(<Breadcrumbs />, ['/']);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders breadcrumbs with correct navigation structure', () => {
    renderWithRouter(<Breadcrumbs />);
    expect(screen.getByLabelText('breadcrumb')).toBeInTheDocument();
  });

  it('renders Home as a clickable link', () => {
    renderWithRouter(<Breadcrumbs />);
    const homeLink = screen.getByText('Home');
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders intermediate segments as clickable links', () => {
    renderWithRouter(<Breadcrumbs />, ['/admin/settings/general']);
    const settingsLink = screen.getByText('Settings');
    expect(settingsLink.closest('a')).toHaveAttribute('href', '/admin/settings');
  });

  it('renders the final segment as non-clickable current page', () => {
    renderWithRouter(<Breadcrumbs />);
    const currentPage = screen.getByText('Monthly');
    expect(currentPage).toHaveAttribute('aria-current', 'page');
    expect(currentPage.closest('a')).toBeNull();
  });

  it('uses provided routePath instead of location', () => {
    renderWithRouter(<Breadcrumbs routePath="/custom/path" />, ['/other']);
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Path')).toBeInTheDocument();
  });

  it('applies custom routeLabels', () => {
    renderWithRouter(
      <Breadcrumbs routeLabels={{ reports: 'Report Center' }} />,
    );
    expect(screen.getByText('Report Center')).toBeInTheDocument();
  });

  it('renders separators between breadcrumb items', () => {
    const { container } = renderWithRouter(<Breadcrumbs />);
    const separators = container.querySelectorAll('[data-slot="breadcrumb-separator"]');
    // For /reports/monthly: Home > Reports > Monthly → 2 separators
    expect(separators.length).toBe(2);
  });
});
