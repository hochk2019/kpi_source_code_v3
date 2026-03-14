import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { render, screen, waitFor, cleanup } from '@testing-library/react';

import userEvent from '@testing-library/user-event';



import Login from '@/components/Login.jsx';

import KPICalculator from '@/components/KPICalculator.jsx';

import { fetchWithAuth, getViewerAuth, login } from '@/auth/localAuth.js';

import { installMockApi } from './helpers/mockApi.js';



let fetchMock;



beforeEach(() => {

  cleanup();

  window.localStorage?.clear?.();

  fetchMock = installMockApi();

});



afterEach(() => {

  window.localStorage?.clear?.();

  cleanup();

  vi.unstubAllGlobals();

});



describe('Login component', () => {

  it('không gắn bearer token legacy vào request và vẫn gửi cookie session', async () => {

    window.localStorage?.setItem?.('kpi_session_token', 'legacy-token');

    await fetchWithAuth('/api/auth/session');

    const [, init] = fetchMock.mock.calls.at(-1);
    const headers = new Headers(init?.headers);

    expect(headers.get('Authorization')).toBeNull();
    expect(init?.credentials).toBe('include');
    expect(window.localStorage?.getItem?.('kpi_session_token')).toBeNull();

  });

  it('đăng nhập thành công mà không lưu bearer token legacy', async () => {

    window.localStorage?.setItem?.('kpi_session_token', 'legacy-token');

    const result = await login('admin', 'admin123');

    expect(result.ok).toBe(true);
    expect(window.localStorage?.getItem?.('kpi_session_token')).toBeNull();

  });

  it('đăng nhập thành công và gọi callback', async () => {

    const user = userEvent.setup();

    const onLoggedIn = vi.fn();

    render(<Login onLoggedIn={onLoggedIn} />);



    await user.type(screen.getByPlaceholderText('admin'), 'admin');

    await user.type(screen.getByPlaceholderText(/•/), 'admin123');

    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));



    await waitFor(() => expect(onLoggedIn).toHaveBeenCalled());

    expect(onLoggedIn.mock.calls[0][0]).toMatchObject({ username: 'admin', role: 'admin' });

  });



  it('hiển thị lỗi khi thông tin đăng nhập sai', async () => {

    const user = userEvent.setup();

    render(<Login onLoggedIn={vi.fn()} />);



    await user.type(screen.getByPlaceholderText('admin'), 'sai');

    await user.type(screen.getByPlaceholderText(/•/), 'matkhau');

    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));



    await waitFor(() => expect(screen.getByText(/Sai tài khoản hoặc mật khẩu/i)).toBeInTheDocument());

  });

});



describe('KPICalculator permission rendering', () => {

  it('khách chỉ xem không thấy tab tài khoản', () => {

    const viewer = getViewerAuth();

    render(<KPICalculator auth={viewer} />);



    expect(screen.queryByRole('tab', { name: /Tài khoản/i })).not.toBeInTheDocument();

    expect(screen.queryByRole('tab', { name: /Nhật ký/i })).not.toBeInTheDocument();

  });



  it('quản trị viên thấy đủ tab quản trị', async () => {

    const result = await login('admin', 'admin123');

    expect(result.ok).toBe(true);

    render(<KPICalculator auth={result.user} />);



    expect(screen.getByRole('tab', { name: /Tài khoản/i })).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /Nhật ký/i })).toBeInTheDocument();

  });

});

