#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  BACKUP_REMEDIATION_COMMAND,
  IGNORED_BACKUP_ISSUE_CODES,
  runHealthcheck,
} from './healthcheck-core.mjs';

export {
  BACKUP_REMEDIATION_COMMAND,
  IGNORED_BACKUP_ISSUE_CODES,
  runHealthcheck,
};

const executedPath = process.argv[1] ? pathToFileURL(resolve(process.cwd(), process.argv[1])).href : '';

if (import.meta.url === executedPath) {
  const exitCode = await runHealthcheck();
  process.exit(exitCode);
}
