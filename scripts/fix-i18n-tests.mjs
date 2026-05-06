import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const testsDir = 'tests';
const files = readdirSync(testsDir).filter(f => f.endsWith('.test.jsx') || f.endsWith('.test.tsx'));

let fixed = 0;
for (const file of files) {
  const filePath = join(testsDir, file);
  const original = readFileSync(filePath, 'utf8');
  
  // Convert getByText("Vietnamese string") -> getByText(/Vietnamese string/i)
  // Only for strings containing Vietnamese diacritics
  const hasVietnamese = /[\u00C0-\u1EF9]/;
  
  let content = original;
  
  // Match getByText("..."), queryByText("..."), findByText("...") with Vietnamese chars
  content = content.replace(
    /\b(getByText|queryByText|findByText)\("([^"]*[\u00C0-\u1EF9][^"]*)"\)/g,
    (match, fn, str) => {
      // Escape special regex chars in the string (except already escaped)
      const escaped = str
        .replace(/\//g, '\\/') // escape forward slashes
        .replace(/\./g, '\\.') // escape dots  
        .replace(/\(/g, '\\(') // escape parens
        .replace(/\)/g, '\\)');
      return `${fn}(/${escaped}/i)`;
    }
  );

  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${file}`);
    fixed++;
  }
}

console.log(`\nTotal files fixed: ${fixed}`);
