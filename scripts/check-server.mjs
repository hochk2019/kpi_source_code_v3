import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  envCandidates,
  findFirstExisting,
  parseEnvFile,
  loadEnvCascade,
  ensureRequiredEnvVariables,
  main
} from './check-server-core.mjs';

export {
  envCandidates,
  findFirstExisting,
  parseEnvFile,
  loadEnvCascade,
  ensureRequiredEnvVariables,
  main
};

const executedPath = process.argv[1]
  ? pathToFileURL(resolve(process.cwd(), process.argv[1])).href
  : '';

if (import.meta.url === executedPath) {
  main().catch((error) => {
    console.error('Khong the kiem tra bien moi truong:', error.message);
    process.exit(1);
  });
}
