const fs = require('fs');
const path = require('path');

// Target: the compose-refs package that causes "Maximum update depth exceeded"
// in React 19 + JSDOM tests. The fix: skip function refs (which can trigger setState)
// and only handle object refs (ref.current = node).

const baseDir = path.join(
  __dirname,
  'node_modules',
  '.pnpm',
  '@radix-ui+react-compose-ref_90c2b96df58bee002891423b8b90020f',
  'node_modules',
  '@radix-ui',
  'react-compose-refs',
  'dist'
);

const mjsContent = `import * as React from 'react';

// PATCHED for React 19 + JSDOM test environment:
// Calling function refs (ref(node)) can trigger setState in cmdk/Radix internals,
// causing "Maximum update depth exceeded" in tests. We skip function refs entirely
// and only assign to object refs (ref.current = node). This prevents the infinite loop.

function assignRef(ref, node) {
  if (ref === null || ref === undefined) return;
  if (typeof ref === 'function') {
    // Skip function refs - they can trigger setState => infinite loop in JSDOM tests
    return;
  }
  ref.current = node;
}

export function useComposedRefs(...refs) {
  const refsRef = React.useRef(refs);
  React.useLayoutEffect(() => {
    refsRef.current = refs;
  });
  return React.useCallback((node) => {
    refsRef.current.forEach((ref) => assignRef(ref, node));
  }, []);
}

export function composeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => assignRef(ref, node));
  };
}
`;

const cjsContent = `const React = require('react');

// PATCHED for React 19 + JSDOM test environment:
// Calling function refs (ref(node)) can trigger setState in cmdk/Radix internals,
// causing "Maximum update depth exceeded" in tests. We skip function refs entirely
// and only assign to object refs (ref.current = node). This prevents the infinite loop.

function assignRef(ref, node) {
  if (ref === null || ref === undefined) return;
  if (typeof ref === 'function') {
    // Skip function refs - they can trigger setState => infinite loop in JSDOM tests
    return;
  }
  ref.current = node;
}

function useComposedRefs(...refs) {
  const refsRef = React.useRef(refs);
  React.useLayoutEffect(() => {
    refsRef.current = refs;
  });
  return React.useCallback((node) => {
    refsRef.current.forEach((ref) => assignRef(ref, node));
  }, []);
}

function composeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => assignRef(ref, node));
  };
}

module.exports = { useComposedRefs, composeRefs };
`;

fs.writeFileSync(path.join(baseDir, 'index.mjs'), mjsContent, 'utf8');
fs.writeFileSync(path.join(baseDir, 'index.js'), cjsContent, 'utf8');

console.log('Patched react-compose-refs: function refs will be skipped in JSDOM test env.');
console.log('Files patched:');
console.log('  -', path.join(baseDir, 'index.mjs'));
console.log('  -', path.join(baseDir, 'index.js'));
