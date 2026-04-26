import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKpiPermissions } from '@/hooks/useKpiPermissions.js';

describe('useKpiPermissions', () => {
  it('returns guest defaults when auth is null', () => {
    const { result } = renderHook(() => useKpiPermissions(null));

    expect(result.current.effectiveAuth).toMatchObject({
      username: 'guest',
      role: 'viewer',
    });
    expect(result.current.canImportEdit).toBe(false);
    expect(result.current.canExportReports).toBe(true); // !== false default
    expect(result.current.canManageAccounts).toBe(false);
  });

  it('maps permission flags from auth', () => {
    const auth = {
      username: 'alice',
      role: 'admin',
      permissions: {
        importEdit: true,
        mstEdit: true,
        rulesEdit: true,
        accountManage: true,
        reportsExport: false,
        aiAssistManage: true,
      },
    };
    const { result } = renderHook(() => useKpiPermissions(auth));

    expect(result.current.canImportEdit).toBe(true);
    expect(result.current.canMstEdit).toBe(true);
    expect(result.current.canRulesEdit).toBe(true);
    expect(result.current.canManageAccounts).toBe(true);
    expect(result.current.canExportReports).toBe(false);
    expect(result.current.canUseAi).toBe(true);
    expect(result.current.canViewAudit).toBe(true); // accountManage cascade
  });

  it('treats missing permissions as empty object without crashing', () => {
    const auth = { username: 'bob', role: 'viewer' }; // no permissions key
    const { result } = renderHook(() => useKpiPermissions(auth));

    expect(result.current.canImportEdit).toBe(false);
    expect(result.current.canExportReports).toBe(true);
  });

  it('cascades accountManage to canViewAudit', () => {
    const auth = {
      role: 'admin',
      permissions: { accountManage: true },
    };
    const { result } = renderHook(() => useKpiPermissions(auth));

    expect(result.current.canViewAudit).toBe(true);
  });

  it('cascades dataHealthManage to canViewDataHealth', () => {
    const auth = {
      permissions: { dataHealthManage: true },
    };
    const { result } = renderHook(() => useKpiPermissions(auth));

    expect(result.current.canViewDataHealth).toBe(true);
    expect(result.current.canManageDataHealth).toBe(true);
  });

  it('returns stable reference when auth does not change (CQ-002)', () => {
    const auth = { username: 'alice', role: 'admin', permissions: { importEdit: true } };
    const { result, rerender } = renderHook(({ a }) => useKpiPermissions(a), {
      initialProps: { a: auth },
    });

    const firstResult = result.current;
    rerender({ a: auth });
    const secondResult = result.current;

    // Same auth reference → same hook return reference
    expect(secondResult).toBe(firstResult);
  });

  it('returns stable reference when auth permissions is falsy (CQ-002 regression guard)', () => {
    const auth = { username: 'guest', role: 'viewer' }; // no permissions
    const { result, rerender } = renderHook(({ a }) => useKpiPermissions(a), {
      initialProps: { a: auth },
    });

    const firstResult = result.current;
    rerender({ a: auth });
    const secondResult = result.current;

    // CRITICAL: must be same reference even when permissions is falsy
    // (previously failed because `auth.permissions || {}` created new {} every render)
    expect(secondResult).toBe(firstResult);
  });

  it('updates result when auth reference changes', () => {
    const authA = { permissions: { importEdit: true } };
    const authB = { permissions: { importEdit: false, mstEdit: true } };
    const { result, rerender } = renderHook(({ a }) => useKpiPermissions(a), {
      initialProps: { a: authA },
    });

    expect(result.current.canImportEdit).toBe(true);
    expect(result.current.canMstEdit).toBe(false);

    rerender({ a: authB });

    expect(result.current.canImportEdit).toBe(false);
    expect(result.current.canMstEdit).toBe(true);
  });
});
