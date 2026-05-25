import fs from 'fs';

const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { buildV4App')) {
  content = content.replace("import express from 'express';", "import express from 'express';\nimport { buildV4App, moduleCatalog } from '../dist/server-v4/index.js';");
}

if (!content.includes('app.use(v4App)')) {
  const anchor = "export const app = express();";
  const injection = `export const app = express();

try {
  const reportingModule = moduleCatalog.find(m => m.id === 'reporting');
  if (reportingModule) {
    const v4App = buildV4App({ modules: [reportingModule] });
    app.use(v4App);
    console.log('[v4 Migration] Successfully migrated Reporting domain to v4!');
  }
} catch (e) {
  console.error('[v4 Migration] Error mounting v4 reporting app:', e);
}`;

  content = content.replace(anchor, injection);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Patched server/index.js');
} else {
  console.log('Already patched.');
}
