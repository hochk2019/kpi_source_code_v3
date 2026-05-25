/**
 * @deprecated Legacy alerts routes — retained for backward compatibility.
 * Migration tracked under CQ-007.
 */
function parseNotificationLimit(rawLimit) {
  const parsed = Number.parseInt(rawLimit ?? '50', 10);
  return Number.isFinite(parsed) ? parsed : 50;
}

function readActor(context) {
  const username = context?.account?.username;
  if (typeof username === 'string' && username.trim()) {
    return username.trim();
  }
  return 'system';
}

export function registerLegacyNotificationRoutes(
  app,
  {
    requireNotificationAccess,
    listNotifications,
    registerSseClient,
  },
) {
  app.get('/api/notifications', (req, res) => {
    const { denied } = requireNotificationAccess(req, res);
    if (denied) {
      return;
    }

    try {
      const events = listNotifications({ limit: parseNotificationLimit(req.query?.limit) });
      res.json({ ok: true, events });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || 'Không thể tải thông báo' });
    }
  });

  app.get('/api/notifications/stream', (req, res) => {
    const { denied } = requireNotificationAccess(req, res);
    if (denied) {
      if (!res.headersSent) {
        res.end();
      }
      return;
    }

    registerSseClient(res);
  });
}

export function registerLegacyImportAlertRoutes(
  app,
  {
    requireAlertsManage,
    buildAlertPayload,
    getAlertConfig,
    saveAlertConfig,
    evaluateDeclarationAlerts,
    markDeclarationsReviewed,
    unmarkDeclarationsReviewed,
  },
) {
  app.get('/api/import/alerts', (req, res) => {
    const { denied } = requireAlertsManage(req, res);
    if (denied) {
      return;
    }

    const payload = buildAlertPayload();
    res.json({ ok: true, ...payload });
  });

  app.get('/api/import/alerts/config', (req, res) => {
    const { denied } = requireAlertsManage(req, res);
    if (denied) {
      return;
    }

    res.json({ ok: true, config: getAlertConfig() });
  });

  app.put('/api/import/alerts/config', (req, res) => {
    const { context, denied } = requireAlertsManage(req, res);
    if (denied) {
      return;
    }

    try {
      const actor = readActor(context);
      const next = saveAlertConfig(req.body?.config || {});
      const summary = evaluateDeclarationAlerts({ actor, reason: 'alert-config' });
      res.json({ ok: true, config: next, summary });
    } catch (err) {
      res.status(400).json({ ok: false, error: err?.message || 'Không thể cập nhật cấu hình cảnh báo' });
    }
  });

  app.post('/api/import/alerts/review', (req, res) => {
    const { context, denied } = requireAlertsManage(req, res);
    if (denied) {
      return;
    }

    const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
    const actor = readActor(context);
    const updated = markDeclarationsReviewed(keys, { actor });
    const summary = evaluateDeclarationAlerts({ actor, reason: 'manual-review' });
    res.json({ ok: true, updated, summary });
  });

  app.post('/api/import/alerts/unreview', (req, res) => {
    const { context, denied } = requireAlertsManage(req, res);
    if (denied) {
      return;
    }

    const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
    const actor = readActor(context);
    const updated = unmarkDeclarationsReviewed(keys, { actor });
    const summary = evaluateDeclarationAlerts({ actor, reason: 'manual-unreview' });
    res.json({ ok: true, updated, summary });
  });
}
