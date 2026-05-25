import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionBanner } from '@/components/designSystem/primitives';

afterEach(() => {
  cleanup();
});

describe('PermissionBanner', () => {
  it('renders title and description', () => {
    render(
      <PermissionBanner
        title="Access Denied"
        description="You don't have permission"
      />
    );
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText("You don't have permission")).toBeInTheDocument();
  });

  it('renders with warning level by default', () => {
    const { container } = render(
      <PermissionBanner title="Warning" description="Test" />
    );
    expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
  });

  it('renders actions', () => {
    const onClick = vi.fn();
    render(
      <PermissionBanner
        title="Access"
        description="Test"
        actions={[{ label: 'Request', onClick }]}
      />
    );
    expect(screen.getByRole('button', { name: 'Request' })).toBeInTheDocument();
  });

  it('calls action on click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PermissionBanner
        title="Access"
        description="Test"
        actions={[{ label: 'Request', onClick }]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Request' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PermissionBanner
        title="Dismissible"
        description="Test"
        dismissible
      />
    );
    const closeBtn = screen.getByLabelText('Đóng thông báo');
    await user.click(closeBtn);
    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('renders different levels', () => {
    const { rerender } = render(
      <PermissionBanner title="Info" description="Test" level="info" />
    );
    rerender(<PermissionBanner title="Warning" description="Test" level="warning" />);
    rerender(<PermissionBanner title="Error" description="Test" level="error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
