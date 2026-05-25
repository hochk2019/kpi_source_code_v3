const API_PATH_REGEX = /\/api\/[A-Za-z0-9_./:?${}=&%-]*/g

export function extractApiPathsFromSource(sourceText = '') {
  if (typeof sourceText !== 'string' || !sourceText) {
    return []
  }

  const paths = new Set()
  let match = API_PATH_REGEX.exec(sourceText)
  while (match) {
    const value = match[0]
    if (value && !value.startsWith('/api//')) {
      paths.add(value)
    }
    match = API_PATH_REGEX.exec(sourceText)
  }
  return Array.from(paths)
}

export function normalizeApiPath(path) {
  if (typeof path !== 'string') {
    return ''
  }
  const withoutQuery = path.split('?')[0] || ''
  return withoutQuery.replace(/\$\{[^}]+\}/g, ':param')
}

export function classifyApiPath(path) {
  const normalized = normalizeApiPath(path)
  if (!normalized.startsWith('/api/')) {
    return 'non-api'
  }
  if (normalized.startsWith('/api/v4/')) {
    return 'canonical'
  }
  return 'legacy'
}

export function summarizeApiUsage(fileEntries = []) {
  const canonical = []
  const legacy = []

  for (const entry of fileEntries) {
    const filePath = entry?.filePath || ''
    const sourceText = entry?.sourceText || ''
    const paths = extractApiPathsFromSource(sourceText)
    for (const rawPath of paths) {
      const normalizedPath = normalizeApiPath(rawPath)
      const classification = classifyApiPath(rawPath)
      const record = { filePath, rawPath, normalizedPath }
      if (classification === 'canonical') {
        canonical.push(record)
      } else if (classification === 'legacy') {
        legacy.push(record)
      }
    }
  }

  return {
    canonical,
    legacy,
    counts: {
      canonical: canonical.length,
      legacy: legacy.length,
    },
  }
}
