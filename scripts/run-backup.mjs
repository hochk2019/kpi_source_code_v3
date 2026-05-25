#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DEFAULT_BACKUP_COMMAND, DEFAULT_BACKUP_REASON, main, parseBackupCliArgs } from './run-backup-core.mjs';

export { DEFAULT_BACKUP_COMMAND, DEFAULT_BACKUP_REASON, main, parseBackupCliArgs };

const executedPath = process.argv[1] ? pathToFileURL(resolve(process.cwd(), process.argv[1])).href : '';

if (import.meta.url === executedPath) {
  main().catch((error) => {
    console.error(error?.message || 'Không thể tạo backup local.');
    process.exit(1);
  });
}
