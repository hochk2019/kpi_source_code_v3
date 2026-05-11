import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';

import { PageHeader, InfoTooltip } from '@/components/designSystem/PageHeader';
import {
  EmptyState,
  PermissionBanner,
  BulkActionBar,
  LoadingState,
  FilterBar,
  ExportDropdown,
} from '@/components/designSystem/primitives';

expect.extend({ toHaveNoViolations });

afterEach(() => {
  cleanup();
});

describe('A11y: PageHeader', () => {
  it('has no violations with full props', async () => {
    const { container } = render(
      <PageHeader
        eyebrow="Section"
        title="Test Page"
        subtitle="Description"
        info="Tooltip info"
        meta={[<span key="1">10 records</span>]}
        actions={<button>Action</button>}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('A11y: InfoTooltip', () => {
  it('has no violations', async () => {
    const { container } = render(<InfoTooltip content="Info text" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('A11y: EmptyState', () => {
  it('has no violations with icon and actions', async () => {
    const { container } = render(
      <EmptyState
        title="No data"
        description="Create your first item"
        icon={<span>📄</span>}
        actions={[{ label: 'Create', onClick: () => {} }]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('A11y: PermissionBanner', () => {
  it('has no violations', async () => {
    const { container } = render(
      <PermissionBanner
        title="Access Denied"
        description="You don't have permission"
        level="warning"
        actions={[{ label: 'Request Access', onClick: () => {} }]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('A11y: BulkActionBar', () => {
  it('has no violations when visible', async () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={3}
        totalCount={10}
        actions={[
          { id: 'delete', label: 'Delete', onClick: () => {} },
          { id: 'export', label: 'Export', onClick: () => {} },
        ]}
        onClear={() => {}}
        onSelectAll={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('A11y: LoadingState', () => {
  it('has no violations', async () => {
    const { container } = render(<LoadingState message="Loading data" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('A11y: FilterBar', () => {
  it('has no violations', async () => {
    const { container } = render(
      <FilterBar activeFilterCount={2} onReset={() => {}}>
        <FilterBar.Search value="" onChange={() => {}} />
        <FilterBar.Select
          label="Status"
          value="active"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          onChange={() => {}}
        />
      </FilterBar>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('A11y: ExportDropdown', () => {
  it('has no violations (closed state)', async () => {
    const { container } = render(
      <ExportDropdown
        items={[
          { id: 'xlsx', label: 'Excel', format: 'xlsx' },
          { id: 'csv', label: 'CSV', format: 'csv' },
        ]}
        onExport={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
