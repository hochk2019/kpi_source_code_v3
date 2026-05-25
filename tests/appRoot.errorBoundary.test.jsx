import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/App.tsx', () => ({
  default: function AppCrashStub() {
    throw new Error('app root crashed');
  },
}));

vi.mock('@/designSystem/ThemeProvider.tsx', () => ({
  ThemeProvider: function ThemeProviderStub({ children }) {
    return <>{children}</>;
  },
}));

import AppRoot from '@/AppRoot.jsx';

describe('AppRoot error boundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('giữ lại fallback cấp ứng dụng khi App ném lỗi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<AppRoot />);

    expect(screen.getByRole('alert')).toHaveTextContent('Ứng dụng gặp lỗi khi hiển thị.');
    expect(screen.getByText(/Chi tiết kỹ thuật: app root crashed/i)).toBeInTheDocument();
  });
});
