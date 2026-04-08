const ACCOUNT_STORAGE_KEY = 'kpi_users_v1';
const PATCHABLE_STORAGE_KEY = 'decl_rows_v1';

function verifyStoragePermission({ key, req, res, getSessionContext, permissionRequirements }) {
  const required = permissionRequirements[key];

  if (!required) {
    return { context: getSessionContext(req), required, denied: false };
  }

  const context = getSessionContext(req);

  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để thao tác với dữ liệu này' });
    return { context: null, required, denied: true };
  }

  const allowed = context.account?.permissions?.[required];

  if (!allowed) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền chỉnh sửa mục này' });
    return { context, required, denied: true };
  }

  return { context, required, denied: false };
}

function getBlockedMutationError(key, reportScheduleStorageKey) {
  if (key === ACCOUNT_STORAGE_KEY) {
    return 'Khoá này chỉ chỉnh sửa qua API tài khoản';
  }

  if (key === reportScheduleStorageKey) {
    return 'Khoá này chỉ chỉnh sửa qua API lịch báo cáo KPI';
  }

  return null;
}

export function createStorageRouteController({
  getValue,
  safeParse,
  storageRouteRuntime,
  getSessionContext,
  resolveActor,
  permissionRequirements,
  reportScheduleStorageKey,
}) {
  function getStorageValue(req, res) {
    const key = req.params.key;

    if (!key) {
      res.status(400).json({ ok: false, error: 'Thiếu key' });
      return;
    }

    const { denied } = verifyStoragePermission({
      key,
      req,
      res,
      getSessionContext,
      permissionRequirements,
    });

    if (denied) {
      return;
    }

    try {
      const raw = getValue(key);

      if (raw === undefined || raw === null) {
        res.json({ ok: true, key, value: null, raw: null });
        return;
      }

      const value = safeParse(raw, raw);
      res.json({ ok: true, key, value, raw });
    } catch (err) {
      console.error('Không thể đọc dữ liệu', err);
      res.status(500).json({ ok: false, error: 'Không thể đọc dữ liệu' });
    }
  }

  function putStorageValue(req, res) {
    const key = req.params.key;

    if (!key) {
      res.status(400).json({ ok: false, error: 'Thiếu key' });
      return;
    }

    const blockedError = getBlockedMutationError(key, reportScheduleStorageKey);
    if (blockedError) {
      res.status(403).json({ ok: false, error: blockedError });
      return;
    }

    const { value } = req.body || {};
    const { context, denied } = verifyStoragePermission({
      key,
      req,
      res,
      getSessionContext,
      permissionRequirements,
    });

    if (denied) {
      return;
    }

    const actor = context?.account?.username || resolveActor(req);

    try {
      res.json(
        storageRouteRuntime.putStorageValue(key, value, {
          actor,
          source: 'api',
        })
      );
    } catch (err) {
      console.error('Lỗi ghi dữ liệu', err);
      res.status(500).json({ ok: false, error: 'Không thể ghi dữ liệu' });
    }
  }

  function patchStorageValue(req, res) {
    const key = req.params.key;

    if (!key) {
      res.status(400).json({ ok: false, error: 'Thiếu key' });
      return;
    }

    if (key !== PATCHABLE_STORAGE_KEY) {
      res.status(405).json({ ok: false, error: 'Khoá này chưa hỗ trợ PATCH' });
      return;
    }

    const { updates } = req.body || {};

    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ ok: false, error: 'Không có dữ liệu cập nhật' });
      return;
    }

    const { context, denied } = verifyStoragePermission({
      key,
      req,
      res,
      getSessionContext,
      permissionRequirements,
    });

    if (denied) {
      return;
    }

    const actor = context?.account?.username || resolveActor(req);

    try {
      const result = storageRouteRuntime.patchDeclarationRows(updates, {
        actor,
        source: 'api-patch',
      });

      if (result.invalidCurrentData) {
        res.status(500).json({ ok: false, error: 'Dữ liệu hiện tại không hợp lệ' });
        return;
      }

      res.json(result);
    } catch (err) {
      console.error('Lỗi cập nhật từng phần kho chia sẻ', err);
      res.status(500).json({ ok: false, error: 'Không thể cập nhật dữ liệu' });
    }
  }

  function deleteStorageValue(req, res) {
    const key = req.params.key;

    if (!key) {
      res.status(400).json({ ok: false, error: 'Thiếu key' });
      return;
    }

    const blockedError = getBlockedMutationError(key, reportScheduleStorageKey);
    if (blockedError) {
      res.status(403).json({ ok: false, error: blockedError });
      return;
    }

    const { context, denied } = verifyStoragePermission({
      key,
      req,
      res,
      getSessionContext,
      permissionRequirements,
    });

    if (denied) {
      return;
    }

    const actor = context?.account?.username || resolveActor(req);

    try {
      res.json(
        storageRouteRuntime.deleteStorageValue(key, {
          actor,
          source: 'api-delete',
        })
      );
    } catch (err) {
      console.error('Lỗi xóa dữ liệu', err);
      res.status(500).json({ ok: false, error: 'Không thể xóa dữ liệu' });
    }
  }

  return {
    getStorageValue,
    putStorageValue,
    patchStorageValue,
    deleteStorageValue,
  };
}
