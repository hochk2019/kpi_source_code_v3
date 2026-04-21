import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Toaster } from 'sonner';

const KPICalculator = React.lazy(() => import('./components/KPICalculator.jsx'));

const Login = React.lazy(() => import('./components/Login.jsx'));

const ChangePasswordDialog = React.lazy(() => import('./components/ChangePasswordDialog.jsx'));

const SupportCenter = React.lazy(() => import('./components/SupportCenter.jsx'));

import { getAuth, getViewerAuth, loadSession, logout } from './auth/localAuth.js';

import './App.css';

import { clearStorageCache } from './lib/storageClient.js';
import {
  APP_SHELL_FALLBACK_TAB,
  parseAppShellLocation,
  serializeAppShellLocation,
} from './lib/appShellNavigation.js';

import useTooltipTitles from './hooks/useTooltipTitles.js';

import ThemeToggle from './components/ThemeToggle.jsx';

import NotificationCenter from './components/NotificationCenter.jsx';

import CommandCenter from './components/CommandCenter.jsx';

import { subscribeCommand } from './lib/commandBus.js';

import { isAdminRole } from '../packages/domain/src/accountRoles.js';



export default function App() {

  const [auth, setAuth] = useState(null);

  const [showLogin, setShowLogin] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);

  const [activeTab, setActiveTab] = useState(() => {
    const initialUser =
      getAuth() ||
      getViewerAuth() || {
        username: 'guest',
        role: 'viewer',
        permissions: {},
      };

    if (typeof window === 'undefined') {
      return APP_SHELL_FALLBACK_TAB;
    }

    return parseAppShellLocation(window.location.search, initialUser).tab;
  });
  const [navigationIntent, setNavigationIntent] = useState(null);

  const rootRef = useRef(null);
  const effectiveAuthRef = useRef(null);



  useTooltipTitles(rootRef, [auth, showLogin, showChangePassword]);



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



  const effectiveAuth = useMemo(() => auth || getViewerAuth(), [auth]);

  const isAdmin = isAdminRole(effectiveAuth?.role);

  useEffect(() => {
    effectiveAuthRef.current = effectiveAuth;
  }, [effectiveAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextTab = parseAppShellLocation(
      window.location.search,
      effectiveAuth,
      APP_SHELL_FALLBACK_TAB,
    ).tab;

    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [effectiveAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const applyLocationState = () => {
      const nextTab = parseAppShellLocation(
        window.location.search,
        effectiveAuthRef.current,
        APP_SHELL_FALLBACK_TAB,
      ).tab;
      setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
    };

    window.addEventListener('popstate', applyLocationState);
    return () => window.removeEventListener('popstate', applyLocationState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSearch = serializeAppShellLocation({
      search: window.location.search,
      tab: activeTab,
      currentUser: effectiveAuth,
      fallbackTab: APP_SHELL_FALLBACK_TAB,
    });

    if (nextSearch === window.location.search) {
      return;
    }

    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash || ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [activeTab, effectiveAuth]);






  const handleLogout = useCallback(() => {

    logout(auth?.username).finally(() => {

      setAuth(getAuth());

    });

  }, [auth?.username]);

  const handleSkipToContent = useCallback((event) => {
    event.preventDefault();
    if (typeof document === 'undefined') {
      return;
    }
    const target = document.getElementById('app-main-content');
    if (!target) {
      return;
    }
    target.focus();
    target.scrollIntoView?.({ block: 'start' });
  }, []);



  useEffect(() => {

    const unsubscribe = subscribeCommand((id, payload) => {

      if (id === 'navigate:tab') {

        const target = typeof payload?.tab === 'string' ? payload.tab : null;

        if (target) {

          setActiveTab(target);
          setNavigationIntent({
            tab: target,
            focus: typeof payload?.focus === 'string' ? payload.focus : null,
            nonce: Date.now(),
          });

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
      <a
        href="#app-main-content"
        onClick={handleSkipToContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-amber-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-200"
      >
        Bỏ qua tới nội dung chính
      </a>

      <header className="border-b border-stone-200/80 bg-[#fafaf5]/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[#fafaf5]/75 dark:border-stone-800 dark:bg-slate-900/75">

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">
            <span className="rounded-full border border-stone-300/80 bg-white/70 px-3 py-1 dark:border-stone-700 dark:bg-slate-900/60">
              Golden Logistics
            </span>
            <span className="rounded-full border border-teal-700/15 bg-teal-900/5 px-3 py-1 text-teal-800 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-200">
              Ops shell
            </span>
          </div>

          <div className="flex flex-col items-stretch gap-2 text-sm lg:items-end">

            <div className="flex flex-wrap items-center justify-end gap-2 text-right text-stone-600 dark:text-stone-300">

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

                <SupportCenter currentTabId={activeTab} />

              </Suspense>

              <ThemeToggle />

            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">

              {auth ? (

                <>

                  <button

                    type="button"

                    onClick={() => setShowChangePassword(true)}

                    className="rounded-full border border-teal-700/20 bg-white/80 px-3 py-1.5 text-teal-800 transition hover:bg-teal-50 dark:border-teal-400/25 dark:bg-slate-900/60 dark:text-teal-200 dark:hover:bg-teal-400/10"

                    data-tooltip="Đổi mật khẩu cho tài khoản đang đăng nhập"

                  >

                    Đổi mật khẩu

                  </button>

                  <button

                    type="button"

                    onClick={handleLogout}

                    className="rounded-full border border-stone-300 bg-white/80 px-3 py-1.5 transition hover:bg-stone-100 dark:border-stone-700 dark:bg-slate-900/60 dark:text-gray-200 dark:hover:bg-slate-800"

                    data-tooltip="Đăng xuất khỏi phiên làm việc hiện tại"

                  >

                    Đăng xuất

                  </button>

                </>

              ) : (

                <button

                  type="button"

                  onClick={() => setShowLogin(true)}

                  className="rounded-full bg-teal-700 px-3 py-1.5 font-medium text-white shadow-sm transition hover:bg-teal-800"

                  data-tooltip="Mở hộp thoại đăng nhập quản trị"

                >

                  Đăng nhập quản trị

                </button>

              )}

            </div>

          </div>

        </div>

      </header>



      <main id="app-main-content" tabIndex={-1} className="px-4 py-6">

        <Suspense fallback={<div className="text-sm text-gray-500 dark:text-gray-400">Đang tải dashboard...</div>}>

          <KPICalculator
            auth={effectiveAuth}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            navigationIntent={navigationIntent}
          />

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

