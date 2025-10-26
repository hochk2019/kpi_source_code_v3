import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Toaster } from 'sonner';

const KPICalculator = React.lazy(() => import('./components/KPICalculator.jsx'));

const Login = React.lazy(() => import('./components/Login.jsx'));

const ChangePasswordDialog = React.lazy(() => import('./components/ChangePasswordDialog.jsx'));

const SupportCenter = React.lazy(() => import('./components/SupportCenter.jsx'));

import { getAuth, getViewerAuth, loadSession, logout } from './auth/localAuth.js';

import './App.css';

import { getSyncStatus, subscribeSyncStatus } from './lib/storageClient.js';

import useTooltipTitles from './hooks/useTooltipTitles.js';

import ThemeToggle from './components/ThemeToggle.jsx';

import NotificationCenter from './components/NotificationCenter.jsx';

import CommandCenter from './components/CommandCenter.jsx';

import { subscribeCommand } from './lib/commandBus.js';

import { isAdminRole } from './shared/accountRoles.js';



export default function App() {

  const [auth, setAuth] = useState(null);

  const [showLogin, setShowLogin] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);

  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus());

  const [activeTab, setActiveTab] = useState('reports');

  const rootRef = useRef(null);



  useTooltipTitles(rootRef, [auth, showLogin, showChangePassword, syncStatus]);



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



  useEffect(() => {

    if (typeof window === 'undefined') {

      return undefined;

    }

    let idleHandle = null;

    let timeoutId = null;

    const prefetch = () => {

      import('./components/SupportCenter.jsx');

      import('./lib/feedbackClient.js').then((mod) => {

        if (typeof mod.prefetchEngagementData === 'function') {

          mod.prefetchEngagementData();

        }

      });

    };

    if (typeof window.requestIdleCallback === 'function') {

      idleHandle = window.requestIdleCallback(prefetch, { timeout: 2500 });

    } else {

      timeoutId = window.setTimeout(prefetch, 1500);

    }

    return () => {

      if (idleHandle && typeof window.cancelIdleCallback === 'function') {

        window.cancelIdleCallback(idleHandle);

      }

      if (timeoutId) {

        window.clearTimeout(timeoutId);

      }

    };

  }, []);



  const viewer = getViewerAuth();

  const effectiveAuth = auth || viewer;

  const isAdmin = isAdminRole(effectiveAuth?.role);



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



  const handleLogout = useCallback(() => {

    logout(auth?.username).finally(() => {

      setAuth(getAuth());

    });

  }, [auth?.username]);



  useEffect(() => {

    const unsubscribe = subscribeCommand((id, payload) => {

      if (id === 'navigate:tab') {

        const target = typeof payload?.tab === 'string' ? payload.tab : null;

        if (target) {

          setActiveTab(target);

          if (rootRef.current) {

            rootRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });

          }

        }

      } else if (id === 'open:login') {

        setShowLogin(true);

      } else if (id === 'open:change-password') {

        setShowChangePassword(true);

      } else if (id === 'open:logout') {

        handleLogout();

      }

    });

    return () => unsubscribe();

  }, [handleLogout]);



  const handlePasswordDialogClose = (changed) => {

    setShowChangePassword(false);

    if (changed) {

      setAuth(getAuth());

    }

  };



  return (

    <div ref={rootRef} className="min-h-screen bg-gray-50 text-gray-900 transition-colors duration-300">

      <header className="border-b border-gray-200 bg-white/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-slate-900/70">

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-3">

            <img

              src="/golden-logistics-logo.svg"

              alt="Logo Golden Logistics"

              className="h-14 w-14 flex-shrink-0"

            />

            <div className="text-gray-800 dark:text-gray-100">

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">

                Golden Logistics Co., Ltd

              </p>

              <h1 className="text-xl font-semibold leading-tight">Hệ thống KPI nhân viên khai báo hải quan</h1>

              <p className="text-sm text-gray-500 dark:text-gray-400">Công ty TNHH Tiếp Vận Hoàng Kim</p>

            </div>

          </div>

          <div className="flex flex-col items-stretch gap-2 text-sm sm:items-end">

          <div className="flex flex-wrap items-center justify-end gap-2 text-right text-gray-600 dark:text-gray-300">

            {auth ? (

              <span>

                Xin chào, <b>{auth.name}</b> ({auth.role})

              </span>

            ) : (

              <span>Đang xem với quyền hạn giới hạn (khách).</span>

            )}

            <CommandCenter

              currentUser={effectiveAuth}

              onRequestLogin={() => setShowLogin(true)}

              onRequestLogout={handleLogout}

              onRequestChangePassword={() => setShowChangePassword(true)}

            />

            <NotificationCenter />

            <Suspense fallback={null}>

              <SupportCenter />

            </Suspense>

            <ThemeToggle />

          </div>

            <div className="flex flex-wrap items-center justify-end gap-2">

              {auth ? (

                <>

                  <button

                    type="button"

                    onClick={() => setShowChangePassword(true)}

                    className="rounded border border-amber-400 px-3 py-1 text-amber-700 transition hover:bg-amber-50 dark:border-amber-500 dark:text-amber-300 dark:hover:bg-amber-500/10"

                    data-tooltip="Đổi mật khẩu cho tài khoản đang đăng nhập"

                  >

                    Đổi mật khẩu

                  </button>

                  <button

                    type="button"

                    onClick={handleLogout}

                    className="rounded border border-gray-300 px-3 py-1 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-slate-800"

                    data-tooltip="Đăng xuất khỏi phiên làm việc hiện tại"

                  >

                    Đăng xuất

                  </button>

                </>

              ) : (

                <button

                  type="button"

                  onClick={() => setShowLogin(true)}

                  className="rounded bg-amber-500 px-3 py-1 font-medium text-white shadow-sm transition hover:bg-amber-600"

                  data-tooltip="Mở hộp thoại đăng nhập quản trị"

                >

                  Đăng nhập quản trị

                </button>

              )}

            </div>

          </div>

        </div>

      </header>



      {syncStatus?.waitingForBackend && isAdmin && (

        <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-500/15">

          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">

            <div className="font-medium">

              Dữ liệu mới đang tạm lưu cục bộ vì backend chưa sẵn sàng đồng bộ.

            </div>

            {syncDetail && <div className="text-xs text-amber-700 dark:text-amber-200 sm:text-sm">{syncDetail}</div>}

            <div className="text-xs text-amber-700 dark:text-amber-200 sm:text-sm">

              Vui lòng khởi động dịch vụ backend (pnpm server) hoặc kiểm tra kết nối LAN rồi chờ hệ thống tự đồng bộ.

            </div>

          </div>

        </div>

      )}



      <main className="px-4 py-6">

        <Suspense fallback={<div className="text-sm text-gray-500 dark:text-gray-400">Đang tải dashboard...</div>}>

          <KPICalculator auth={effectiveAuth} activeTab={activeTab} onTabChange={setActiveTab} />

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

