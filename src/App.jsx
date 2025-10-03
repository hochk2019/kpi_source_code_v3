import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Toaster } from 'sonner';
const KPICalculator = React.lazy(() => import('./components/KPICalculator.jsx'));
const Login = React.lazy(() => import('./components/Login.jsx'));
const ChangePasswordDialog = React.lazy(() => import('./components/ChangePasswordDialog.jsx'));
import { getAuth, getViewerAuth, loadSession, logout } from './auth/localAuth.js';
import './App.css';
import { getSyncStatus, subscribeSyncStatus } from './lib/storageClient.js';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus());

  useEffect(() => {
    setAuth(getAuth());
    loadSession()
      .then((session) => {
        setAuth(session);
      })
      .catch(() => {
        setAuth(null);
      });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const viewer = getViewerAuth();
  const effectiveAuth = auth || viewer;

  const syncDetail = useMemo(() => {
    if (!syncStatus?.waitingForBackend) {
      return '';
    }
    const parts = [];
    if (typeof syncStatus.pendingWrites === 'number' && syncStatus.pendingWrites > 0) {
      parts.push(`${syncStatus.pendingWrites.toLocaleString('vi-VN')} thay đổi chưa gửi`);
    }
    if (syncStatus.nextRetryAt) {
      parts.push(`Thử lại lúc ${new Date(syncStatus.nextRetryAt).toLocaleTimeString('vi-VN')}`);
    } else if (syncStatus.retryDelayMs) {
      parts.push(`Thử lại sau khoảng ${Math.round(syncStatus.retryDelayMs / 1000)} giây`);
    }
    if (syncStatus.lastError) {
      parts.push(`Lý do gần nhất: ${syncStatus.lastError}`);
    }
    return parts.join(' • ');
  }, [syncStatus]);

  const handleLogout = () => {
    logout(auth?.username).finally(() => {
      setAuth(getAuth());
    });
  };

  const handlePasswordDialogClose = (changed) => {
    setShowChangePassword(false);
    if (changed) {
      setAuth(getAuth());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/golden-logistics-logo.svg"
              alt="Logo Golden Logistics"
              className="h-14 w-14 flex-shrink-0"
            />
            <div className="text-gray-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
                Golden Logistics Co., Ltd
              </p>
              <h1 className="text-xl font-semibold leading-tight">Hệ thống KPI nhân viên khai báo hải quan</h1>
              <p className="text-sm text-gray-500">Công ty TNHH Tiếp Vận Hoàng Kim</p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 text-sm sm:items-end">
            <div className="text-right text-gray-600">
              {auth ? (
                <span>
                  Xin chào, <b>{auth.name}</b> ({auth.role})
                </span>
              ) : (
                <span>Đang xem với quyền hạn giới hạn (khách).</span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {auth ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(true)}
                    className="rounded border border-amber-400 px-3 py-1 text-amber-700 hover:bg-amber-50"
                  >
                    Đổi mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLogin(true)}
                  className="rounded bg-amber-500 px-3 py-1 font-medium text-white shadow-sm hover:bg-amber-600"
                >
                  Đăng nhập quản trị
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {syncStatus?.waitingForBackend && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-medium">
              Dữ liệu mới đang tạm lưu cục bộ vì backend chưa sẵn sàng đồng bộ.
            </div>
            {syncDetail && <div className="text-xs text-amber-700 sm:text-sm">{syncDetail}</div>}
            <div className="text-xs text-amber-700 sm:text-sm">
              Vui lòng khởi động dịch vụ backend (pnpm server) hoặc kiểm tra kết nối LAN rồi chờ hệ thống tự đồng bộ.
            </div>
          </div>
        </div>
      )}

      <main className="px-4 py-6">
        <Suspense fallback={<div className="text-sm text-gray-500">Đang tải dashboard...</div>}>
          <KPICalculator auth={effectiveAuth} />
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {showLogin && (
          <Login
            variant="modal"
            onLoggedIn={(user) => {
              setAuth(user);
              setShowLogin(false);
            }}
            onCancel={() => setShowLogin(false)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showChangePassword && auth && (
          <ChangePasswordDialog currentUser={auth} onClose={handlePasswordDialogClose} />
        )}
      </Suspense>

      <Toaster position="top-right" richColors />
    </div>
  );
}
