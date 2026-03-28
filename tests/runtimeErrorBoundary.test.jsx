import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RuntimeErrorBoundary from '@/components/errorBoundaries/RuntimeErrorBoundary.jsx';

function AlwaysCrash() {
  throw new Error('boom');
}

function RecoverableBoundaryHarness() {
  const [shouldCrash, setShouldCrash] = React.useState(true);

  return (
    <RuntimeErrorBoundary
      title="Panel gặp lỗi."
      description="Có thể thử hiển thị lại panel."
      onReset={() => setShouldCrash(false)}
    >
      {shouldCrash ? <AlwaysCrash /> : <div>Panel đã phục hồi</div>}
    </RuntimeErrorBoundary>
  );
}

describe('RuntimeErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hiển thị fallback và cho phép reset boundary', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<RecoverableBoundaryHarness />);

    expect(screen.getByRole('alert')).toHaveTextContent('Panel gặp lỗi.');
    expect(screen.getByRole('alert')).toHaveTextContent('Lỗi runtime');
    expect(screen.getByText(/Chi tiết kỹ thuật: boom/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Thử hiển thị lại/i }));

    expect(screen.getByText('Panel đã phục hồi')).toBeInTheDocument();
  });
});
