import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Toaster } from 'sonner';

const KPICalculator = React.lazy(() => import('./components/KPICalculator'));

const Login = React.lazy(() => import('./components/Login.tsx'));

const ChangePasswordDialog = React.lazy(() => import('./components/ChangePasswordDialog.tsx'));

const SupportCenter = React.lazy(() => import('./components/SupportCenter'));

import { getAuth, getViewerAuth, loadSession, logout } from './auth/localAuth.js';

import './App.css';

import {
  APP_SHELL_FALLBACK_TAB,
  parseAppShellLocation,
  serializeAppShellLocation,
} from './lib/appShellNavigation';

import useTooltipTitles from './hooks/useTooltipTitles.js';

import ThemeToggle from './components/ThemeToggle';

import NotificationCenter from './components/NotificationCenter';

import CommandCenter from './components/CommandCenter';

import { subscribeCommand } from './lib/commandBus.js';
import { t } from './lib/i18n.js';
import type { AuthAccountView, AccountPermissions } from './types/index.js';

// ─── Types ─────────────────────────────────────────────────────────────────

interface NavigationIntent {
  tab: string;
  focus: string | null;
  nonce: number;
}



export default function App() {

  const [auth, setAuth] = useState<AuthAccountView | null>(null);

  const [showLogin, setShowLogin] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);

  const [activeTab, setActiveTab] = useState(() => {
    const initialUser =
      getAuth() ||
      getViewerAuth() || {
        username: 'guest',
        role: 'viewer',
        permissions: {
          importEdit: false,
          importUpload: false,
          mstEdit: false,
          rulesEdit: false,
          teamsEdit: false,
          syncManage: false,
          reportsExport: false,
          alertsManage: false,
          auditView: false,
          accountManage: false,
          adjustSubmit: false,
          adjustApprove: false,
          adjustOverridePoints: false,
          aiAssistUse: false,
          aiAssistManage: false,
          dataHealthView: false,
          dataHealthManage: false,
        } satisfies AccountPermissions,
      };

    if (typeof window === 'undefined') {
      return APP_SHELL_FALLBACK_TAB;
    }

    return parseAppShellLocation(window.location.search, initialUser).tab;
  });
  const [navigationIntent, setNavigationIntent] = useState<NavigationIntent | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const effectiveAuthRef = useRef<AuthAccountView | null | undefined>(null);



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

    let idleHandle: number | null = null;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const prefetch = () => {

      import('./components/SupportCenter');

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



  const effectiveAuth = useMemo(() => auth || (getViewerAuth() as AuthAccountView), [auth]);

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

    logout().finally(() => {

      setAuth(getAuth());

    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.username]);

  const handleSkipToContent = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
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



  const handlePasswordDialogClose = (changed: boolean) => {

    setShowChangePassword(false);

    if (changed) {

      setAuth(getAuth());

    }

  };



  return (

    <div ref={rootRef} className="min-h-screen bg-ds-surface-base text-ds-text-primary transition-colors duration-300">
      <a
        href="#app-main-content"
        onClick={handleSkipToContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-ds-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ds-text-inverse focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-ring"
      >
        {t('app.skipToContent')}
      </a>

      <header className="border-b border-ds-border-subtle/80 bg-ds-surface-card/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-ds-surface-card/75">

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ds-text-secondary">
            <span className="rounded-full border border-ds-border-subtle/80 bg-ds-surface-card/70 px-3 py-1">
              Golden Logistics
            </span>
            <span className="rounded-full border border-ds-accent/15 bg-ds-accent/5 px-3 py-1 text-ds-accent-strong">
              Ops shell
            </span>
          </div>

          <div className="flex flex-col items-stretch gap-2 text-sm lg:items-end">

            <div className="flex flex-wrap items-center justify-end gap-2 text-right text-ds-text-secondary">

              {auth ? (

                <span>

                  {t('app.greeting', { name: auth.name, role: auth.role })}

                </span>

              ) : (

                <span>{t('app.guestNotice')}</span>

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

                    className="rounded-full border border-ds-accent/20 bg-ds-surface-card/80 px-3 py-1.5 text-ds-accent-strong transition hover:bg-ds-accent-soft"

                    data-tooltip="Đổi mật khẩu cho tài khoản đang đăng nhập"

                  >

                    {t('app.changePassword')}

                  </button>

                  <button

                    type="button"

                    onClick={handleLogout}

                    className="rounded-full border border-ds-border-subtle bg-ds-surface-card/80 px-3 py-1.5 transition hover:bg-ds-surface-muted"

                    data-tooltip="Đăng xuất khỏi phiên làm việc hiện tại"

                  >

                    {t('app.logout')}

                  </button>

                </>

              ) : (

                <button

                  type="button"

                  onClick={() => setShowLogin(true)}

                  className="rounded-full bg-ds-accent px-3 py-1.5 font-medium text-ds-text-inverse shadow-sm transition hover:bg-ds-accent-strong"

                  data-tooltip="Mở hộp thoại đăng nhập quản trị"

                >

                  {t('app.adminLogin')}

                </button>

              )}

            </div>

          </div>

        </div>

      </header>



      <main id="app-main-content" tabIndex={-1} className="px-4 py-6">

        <Suspense fallback={<div className="text-sm text-gray-500 dark:text-gray-400">{t('app.loadingDashboard')}</div>}>

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

