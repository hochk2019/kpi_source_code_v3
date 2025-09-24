import React, { useEffect, useState } from 'react';
import KPICalculator from './components/KPICalculator.jsx';
import Login from './components/Login.jsx';
import ChangePasswordDialog from './components/ChangePasswordDialog.jsx';
import { getAuth, getViewerAuth, logout } from './auth/localAuth.js';
import './App.css';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    setAuth(getAuth());
  }, []);

  const viewer = getViewerAuth();
  const effectiveAuth = auth || viewer;

  const handleLogout = () => {
    logout(auth?.username);
    setAuth(null);
  };

  const handlePasswordDialogClose = (changed) => {
    setShowChangePassword(false);
    if (changed) {
      setAuth(getAuth());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-3">
        <div className="text-sm">
          {auth ? (
            <>
              Xin chào, <b>{auth.name}</b> ({auth.role})
            </>
          ) : (
            <>Đang xem với quyền hạn giới hạn (khách).</>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {auth ? (
            <>
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="rounded border px-3 py-1"
              >
                Đổi mật khẩu
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded border px-3 py-1"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="rounded bg-black px-3 py-1 text-white"
            >
              Đăng nhập quản trị
            </button>
          )}
        </div>
      </header>

      <main className="p-4">
        <KPICalculator auth={effectiveAuth} />
      </main>

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

      {showChangePassword && auth && (
        <ChangePasswordDialog currentUser={auth} onClose={handlePasswordDialogClose} />
      )}
    </div>
  );
}
