import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '@/components/designSystem/primitives';

describe('FilterBar', () => {
  it('renders children', () => {
    render(
      <FilterBar>
        <div data-testid="child">Filter content</div>
      </FilterBar>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('shows reset button when onReset provided', () => {
    const onReset = vi.fn();
    render(
      <FilterBar onReset={onReset} activeFilterCount={2}>
        <div>Content</div>
      </FilterBar>
    );
    expect(screen.getByText('Xoá bộ lọc')).toBeInTheDocument();
  });

  it('calls onReset when reset clicked', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <FilterBar onReset={onReset} activeFilterCount={2}>
        <div>Content</div>
      </FilterBar>
    );
    await user.click(screen.getByText('Xoá bộ lọc'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('shows active filter count', () => {
    render(
      <FilterBar activeFilterCount={5} collapsible>
        <div>Content</div>
      </FilterBar>
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('FilterBar.Search', () => {
  it('renders search input', () => {
    render(
      <FilterBar>
        <FilterBar.Search value="" onChange={vi.fn()} />
      </FilterBar>
    );
    expect(screen.getByPlaceholderText('Tìm kiếm...')).toBeInTheDocument();
  });

  it('calls onChange with debounce', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBar>
        <FilterBar.Search value="" onChange={onChange} debounceMs={100} />
      </FilterBar>
    );
    const input = screen.getByPlaceholderText('Tìm kiếm...');
    await user.type(input, 'test');
    expect(onChange).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 150));
    expect(onChange).toHaveBeenCalledWith('test');
  });
});

describe('FilterBar.Select', () => {
  it('renders select with options', () => {
    render(
      <FilterBar>
        <FilterBar.Select
          label="Status"
          value="active"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          onChange={vi.fn()}
        />
      </FilterBar>
    );
    expect(screen.getByLabelText('Status:')).toBeInTheDocument();
  });
});
