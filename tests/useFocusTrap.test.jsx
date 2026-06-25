import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useFocusTrap } from '@/hooks/useFocusTrap';

function TrapHarness({ onEscape }) {
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap({ active: open, onEscape });

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      {open ? (
        <div ref={ref} role="dialog" aria-label="trap">
          <button type="button">first</button>
          <button type="button">middle</button>
          <button type="button" onClick={() => setOpen(false)}>
            last
          </button>
        </div>
      ) : null}
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('useFocusTrap', () => {
  it('moves focus to the first focusable element on activation', async () => {
    const user = userEvent.setup();
    render(<TrapHarness />);

    await user.click(screen.getByRole('button', { name: 'open' }));

    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('wraps focus from the last element to the first on Tab', async () => {
    const user = userEvent.setup();
    render(<TrapHarness />);

    await user.click(screen.getByRole('button', { name: 'open' }));

    const last = screen.getByRole('button', { name: 'last' });
    last.focus();
    expect(last).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('wraps focus from the first element to the last on Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<TrapHarness />);

    await user.click(screen.getByRole('button', { name: 'open' }));

    const first = screen.getByRole('button', { name: 'first' });
    first.focus();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
  });

  it('invokes onEscape when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<TrapHarness onEscape={onEscape} />);

    await user.click(screen.getByRole('button', { name: 'open' }));
    await user.keyboard('{Escape}');

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger when the trap deactivates', async () => {
    const user = userEvent.setup();
    render(<TrapHarness />);

    const openButton = screen.getByRole('button', { name: 'open' });
    await user.click(openButton);

    // Close via the in-dialog button; focus should return to the opener.
    await user.click(screen.getByRole('button', { name: 'last' }));

    expect(openButton).toHaveFocus();
  });
});
