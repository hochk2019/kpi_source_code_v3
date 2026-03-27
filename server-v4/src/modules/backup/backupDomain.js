export function createBackupDomain({
  fs,
  path,
  cron,
  logger = console,
  getDbFile,
  getBackupDirectory,
  getBackupConfig,
  getDefaultBackupRetention,
  getState,
  setBackupInProgress,
  setRestoreInProgress,
  setBackupJob,
  getJSONValue,
  inferAuditCategory,
  pushAuditLog,
  initializeDatabase,
  getDatabase,
  setDatabase,
  onRestoreSuccess,
  normalizeCronExpression,
  describeCronExpression,
  formatNextRunHuman,
  isCronDisabled,
}) {
  function normalizeBackupAuditEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const ts = typeof entry.ts === 'string' ? entry.ts : null;
    const actor = entry.actor || 'system';
    const action = entry.action || 'unknown';
    const detail = entry.detail || '';
    const meta = entry.meta ?? null;
    const result = entry.result ?? null;
    const note = entry.note ?? null;
    const category = entry.category || inferAuditCategory(action);
    return { ts, actor, action, detail, meta, result, note, category };
  }

  function nextBackupRunISO() {
    const { backupScheduleMeta, dbBackupJob } = getState();
    if (!backupScheduleMeta.active || !dbBackupJob || typeof dbBackupJob.nextDates !== 'function') {
      return null;
    }
    try {
      const next = dbBackupJob.nextDates();
      if (!next) return null;
      if (typeof next.toISO === 'function') {
        return next.toISO();
      }
      if (next instanceof Date) {
        return next.toISOString();
      }
      if (typeof next.toDate === 'function') {
        return next.toDate().toISOString();
      }
      return new Date(next).toISOString();
    } catch {
      return null;
    }
  }

  async function ensureBackupDirectory(backupDir) {
    if (!backupDir || backupDir === ':memory:') {
      throw new Error('Thư mục sao lưu không hợp lệ.');
    }
    await fs.mkdir(backupDir, { recursive: true });
  }

  async function rotateBackups(backupDir, retention) {
    const limit = Number.isFinite(retention) && retention >= 0 ? Math.trunc(retention) : null;
    if (limit === null) {
      return;
    }
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith('storage-') || !entry.name.endsWith('.sqlite')) {
        continue;
      }
      const fullPath = path.join(backupDir, entry.name);
      try {
        const stats = await fs.stat(fullPath);
        files.push({ path: fullPath, mtime: stats.mtimeMs });
      } catch {
        // ignore file that disappeared
      }
    }
    files.sort((a, b) => b.mtime - a.mtime);
    if (limit === 0) {
      return;
    }
    while (files.length > limit) {
      const removed = files.pop();
      if (!removed) break;
      try {
        await fs.rm(removed.path);
      } catch (err) {
        logger.warn('Không thể xóa bản sao lưu cũ', removed.path, err);
      }
    }
  }

  async function performDatabaseBackup({
    dbFile = getDbFile(),
    backupDir = getBackupDirectory(),
    retention,
    reason = 'manual',
    actor = 'system',
    note = null,
  } = {}) {
    const logOutcome = (status, meta = {}) => {
      const detailReason = meta.reason || reason || 'không rõ';
      const { note: metaNote, ...restMeta } = meta ?? {};
      pushAuditLog({
        actor,
        action: 'db.backup',
        detail:
          status === 'success'
            ? `Sao lưu CSDL (${detailReason})`
            : `Sao lưu CSDL thất bại (${detailReason})`,
        result: status,
        note: metaNote ?? note,
        meta: { status, reason: detailReason, ...restMeta },
      });
    };

    const logFailure = (failureReason, extraMeta = {}) => {
      logOutcome('failure', { reason: failureReason, ...extraMeta });
    };

    const { backupInProgress, restoreInProgress } = getState();

    if (!dbFile || dbFile === ':memory:') {
      logFailure('memory_db', { dbFile });
      return { ok: false, reason: 'memory_db' };
    }
    if (!backupDir || backupDir === ':memory:') {
      logFailure('invalid_backup_dir', { backupDir });
      return { ok: false, reason: 'invalid_backup_dir' };
    }
    if (restoreInProgress) {
      logFailure('restore_in_progress', { dbFile, backupDir });
      return { ok: false, reason: 'restore_in_progress' };
    }
    const sourceFile = dbFile === ':memory:' ? null : path.resolve(dbFile);
    if (!sourceFile) {
      logFailure('memory_db', { dbFile });
      return { ok: false, reason: 'memory_db' };
    }
    if (backupInProgress) {
      logFailure('in_progress', { dbFile, backupDir });
      return { ok: false, reason: 'in_progress' };
    }

    setBackupInProgress(true);
    try {
      await fs.access(sourceFile);
    } catch {
      setBackupInProgress(false);
      logFailure('missing_source', { dbFile: sourceFile });
      return { ok: false, reason: 'missing_source' };
    }

    let retentionLimit = null;
    if (Number.isFinite(retention) && retention >= 0) {
      retentionLimit = Math.trunc(retention);
    } else {
      const config = getBackupConfig();
      let retentionFromConfig = false;
      if (config) {
        if (config.retentionCopies === null) {
          retentionLimit = null;
          retentionFromConfig = true;
        } else if (Number.isFinite(config.retentionCopies) && config.retentionCopies >= 0) {
          retentionLimit = Math.trunc(config.retentionCopies);
          retentionFromConfig = true;
        }
      }
      if (!retentionFromConfig) {
        const defaultRetention = getDefaultBackupRetention();
        if (Number.isFinite(defaultRetention) && defaultRetention >= 0) {
          retentionLimit = Math.trunc(defaultRetention);
        }
      }
    }

    try {
      await ensureBackupDirectory(backupDir);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `storage-${timestamp}.sqlite`;
      const destination = path.join(backupDir, filename);
      await fs.copyFile(sourceFile, destination);
      const stats = await fs.stat(destination);
      await rotateBackups(backupDir, retentionLimit);
      logOutcome('success', { reason, file: destination, bytes: stats.size, retention: retentionLimit });
      logger.log(`💾 Đã sao lưu CSDL tới ${destination}`);
      return { ok: true, file: destination, bytes: stats.size, reason };
    } catch (err) {
      logger.error('Không thể sao lưu CSDL:', err);
      logFailure('error', { error: err?.message || String(err) });
      return { ok: false, error: err?.message || String(err) };
    } finally {
      setBackupInProgress(false);
    }
  }

  async function listBackupFiles({ backupDir = getBackupDirectory(), limit = 50 } = {}) {
    if (!backupDir || backupDir === ':memory:') {
      return [];
    }
    const targetDir = path.resolve(backupDir);
    let entries;
    try {
      entries = await fs.readdir(targetDir, { withFileTypes: true });
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith('storage-') || !entry.name.endsWith('.sqlite')) {
        continue;
      }
      const fullPath = path.join(targetDir, entry.name);
      try {
        const stats = await fs.stat(fullPath);
        files.push({
          filename: entry.name,
          path: fullPath,
          bytes: stats.size,
          modifiedAt: stats.mtime ? new Date(stats.mtime).toISOString() : null,
        });
      } catch {
        // skip files we can't stat
      }
    }
    files.sort((a, b) => {
      const aTime = a.modifiedAt ? Date.parse(a.modifiedAt) : 0;
      const bTime = b.modifiedAt ? Date.parse(b.modifiedAt) : 0;
      return bTime - aTime;
    });
    const sliceLimit = Number.isFinite(limit) && limit > 0 ? Math.min(files.length, Math.trunc(limit)) : files.length;
    return files.slice(0, sliceLimit).map((file) => ({
      filename: file.filename,
      bytes: file.bytes,
      modifiedAt: file.modifiedAt,
    }));
  }

  async function restoreDatabaseBackup({
    filename,
    backupDir = getBackupDirectory(),
    dbFile = getDbFile(),
    actor = 'system',
    note = null,
  } = {}) {
    const logOutcome = (status, meta = {}) => {
      const name = meta.filename || filename || 'không xác định';
      const { note: metaNote, ...restMeta } = meta ?? {};
      pushAuditLog({
        actor,
        action: 'db.restore',
        detail:
          status === 'success'
            ? `Khôi phục CSDL từ ${name}`
            : `Khôi phục CSDL thất bại (${name})`,
        result: status,
        note: metaNote ?? note,
        meta: { filename: name, ...restMeta },
      });
    };

    const safeFilename = typeof filename === 'string' ? filename.trim() : '';
    const { backupInProgress, restoreInProgress } = getState();

    if (!safeFilename) {
      logOutcome('failure', { reason: 'missing_filename' });
      return { ok: false, reason: 'missing_filename' };
    }
    if (!backupDir || backupDir === ':memory:') {
      logOutcome('failure', { reason: 'invalid_backup_dir' });
      return { ok: false, reason: 'invalid_backup_dir' };
    }
    if (!dbFile || dbFile === ':memory:') {
      logOutcome('failure', { reason: 'memory_db' });
      return { ok: false, reason: 'memory_db' };
    }
    if (restoreInProgress) {
      logOutcome('failure', { reason: 'restore_in_progress' });
      return { ok: false, reason: 'restore_in_progress' };
    }
    if (backupInProgress) {
      logOutcome('failure', { reason: 'backup_in_progress' });
      return { ok: false, reason: 'backup_in_progress' };
    }

    const targetDir = path.resolve(backupDir);
    const resolvedSource = path.resolve(targetDir, path.basename(safeFilename));
    if (!resolvedSource.startsWith(targetDir)) {
      logOutcome('failure', { reason: 'invalid_filename', filename: safeFilename });
      return { ok: false, reason: 'invalid_filename' };
    }

    let stats;
    try {
      stats = await fs.stat(resolvedSource);
    } catch (err) {
      logOutcome('failure', {
        reason: err?.code === 'ENOENT' ? 'missing_file' : 'stat_failed',
        error: err?.message,
        filename: safeFilename,
      });
      return { ok: false, reason: err?.code === 'ENOENT' ? 'missing_file' : 'stat_failed' };
    }

    const targetFile = path.resolve(dbFile);
    const tempFile = `${targetFile}.restore-${Date.now()}.tmp`;
    const backupBeforeRestore = `${targetFile}.pre-restore-${Date.now()}.bak`;

    setRestoreInProgress(true);
    const previousDb = getDatabase();
    try {
      if (previousDb && typeof previousDb.close === 'function') {
        previousDb.close();
      }
      await fs.mkdir(path.dirname(targetFile), { recursive: true });
      try {
        await fs.copyFile(targetFile, backupBeforeRestore);
      } catch (err) {
        if (err?.code !== 'ENOENT') {
          logger.warn('Không thể tạo bản sao DB hiện tại trước khi restore:', err);
        }
      }

      await fs.copyFile(resolvedSource, tempFile);
      await fs.rename(tempFile, targetFile);

      setDatabase(await initializeDatabase({ dbFile: targetFile }));
      refreshDatabaseBackupSchedule();
      onRestoreSuccess?.();

      logOutcome('success', {
        filename: safeFilename,
        file: resolvedSource,
        bytes: stats.size,
        backupBeforeRestore,
      });
      logger.log(`♻️ Đã khôi phục CSDL từ ${resolvedSource}`);
      return { ok: true, file: resolvedSource, bytes: stats.size, backupBeforeRestore };
    } catch (err) {
      logger.error('Không thể khôi phục CSDL:', err);
      logOutcome('failure', {
        reason: 'error',
        error: err?.message || String(err),
        filename: safeFilename,
      });
      try {
        if (!getDatabase() || getDatabase() === previousDb) {
          setDatabase(await initializeDatabase({ dbFile: targetFile }));
        }
      } catch (reopenErr) {
        logger.error('Không thể mở lại CSDL sau khi restore thất bại:', reopenErr);
      }
      return { ok: false, error: err?.message || 'Không thể khôi phục CSDL' };
    } finally {
      setRestoreInProgress(false);
      try {
        await fs.rm(tempFile);
      } catch {
        // ignore temp cleanup errors
      }
    }
  }

  function buildBackupSummary({ limit = 10 } = {}) {
    const logs = getJSONValue('audit_logs_v1', []);
    const backupLogs = Array.isArray(logs)
      ? logs.filter((entry) => entry && entry.action === 'db.backup')
      : [];
    const clamp = Number.isFinite(limit) && limit > 0 ? Math.min(limit, backupLogs.length) : backupLogs.length;
    const recent = backupLogs.slice(0, clamp).map((entry) => normalizeBackupAuditEntry(entry)).filter(Boolean);
    const lastSuccess = normalizeBackupAuditEntry(
      backupLogs.find((entry) => entry?.meta?.status === 'success') || null
    );
    const lastFailure = normalizeBackupAuditEntry(
      backupLogs.find((entry) => entry?.meta?.status === 'failure') || null
    );
    const config = getBackupConfig();
    const cronExpr = normalizeCronExpression(config.cron);
    const retention =
      Number.isFinite(config.retentionCopies) && config.retentionCopies >= 0 ? config.retentionCopies : null;
    const nextRun = nextBackupRunISO();
    const nextRunHuman = formatNextRunHuman(nextRun);
    const { backupScheduleMeta } = getState();
    const description = backupScheduleMeta.description || describeCronExpression(cronExpr);

    return {
      schedule: {
        cron: cronExpr,
        cronDescription: description,
        retentionCopies: retention,
        directory: config.directory,
        directoryRaw: config.directoryRaw,
        active: backupScheduleMeta.active,
        reasons: [...backupScheduleMeta.reasons],
        lastError: backupScheduleMeta.lastError,
        refreshedAt: backupScheduleMeta.refreshedAt,
        nextRun,
        nextRunHuman,
      },
      lastSuccess,
      lastFailure,
      recent,
    };
  }

  function refreshDatabaseBackupSchedule() {
    const { backupScheduleMeta, dbBackupJob } = getState();
    if (dbBackupJob) {
      dbBackupJob.stop();
      setBackupJob(null);
    }
    backupScheduleMeta.active = false;
    backupScheduleMeta.reasons = [];
    backupScheduleMeta.lastError = null;
    backupScheduleMeta.refreshedAt = new Date().toISOString();
    const config = getBackupConfig();
    const cronExpr = normalizeCronExpression(config.cron);
    backupScheduleMeta.cron = cronExpr;
    backupScheduleMeta.description = describeCronExpression(cronExpr);
    if (isCronDisabled()) {
      backupScheduleMeta.reasons.push('cron_disabled_env');
      return;
    }
    if (!cronExpr || cronExpr.toLowerCase() === 'never') {
      backupScheduleMeta.reasons.push('cron_disabled_config');
      return;
    }
    const backupDir = getBackupDirectory();
    const dbFile = getDbFile();
    if (dbFile === ':memory:' || backupDir === ':memory:') {
      if (dbFile === ':memory:') {
        backupScheduleMeta.reasons.push('memory_db');
      }
      if (backupDir === ':memory:') {
        backupScheduleMeta.reasons.push('memory_backup_dir');
      }
      return;
    }
    if (typeof cron.validate === 'function' && !cron.validate(cronExpr)) {
      backupScheduleMeta.reasons.push('invalid_cron_expression');
      return;
    }
    try {
      const scheduledJob = cron.schedule(cronExpr, () => {
        performDatabaseBackup({ reason: 'scheduled' }).catch((err) => {
          logger.error('Cron sao lưu CSDL thất bại:', err);
        });
      });
      setBackupJob(scheduledJob);
      backupScheduleMeta.active = true;
    } catch (err) {
      logger.error('Không thể thiết lập lịch sao lưu CSDL:', err);
      backupScheduleMeta.lastError = err?.message || String(err);
      backupScheduleMeta.reasons.push('schedule_error');
    }
  }

  return {
    ensureBackupDirectory,
    rotateBackups,
    performDatabaseBackup,
    listBackupFiles,
    restoreDatabaseBackup,
    buildBackupSummary,
    refreshDatabaseBackupSchedule,
  };
}
