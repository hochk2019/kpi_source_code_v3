const CODE_SPLIT_REGEX = /[\s,;|]+/;



const DIRECT_LICENSE_COUNT_FIELDS = [

  'Số lượng GP',

  'So luong GP',

  'Số lượng giấy phép',

  'So luong giay phep',

];



const LICENSE_CODE_FIELDS = [

  ['Mã giấy phép', 'Số giấy phép'],

  ['Mã giấy phép 1', 'Số giấy phép 1'],

  ['Mã giấy phép 2', 'Số giấy phép 2'],

  ['Mã giấy phép 3', 'Số giấy phép 3'],

  ['Mã giấy phép 4', 'Số giấy phép 4'],

  ['Mã giấy phép 5', 'Số giấy phép 5'],

];



function normalizeStr(value) {

  return (value ?? '')

    .toString()

    .replace(/\s+/g, ' ')

    .trim();

}



export function normalizeLicenseCode(value) {

  const normalized = normalizeStr(value);

  if (!normalized) return '';

  return normalized.toUpperCase();

}



export function normalizeAgencyKey(value) {

  let normalized = normalizeStr(value);

  if (!normalized) return '';

  let previous = null;

  while (normalized && normalized !== previous) {

    previous = normalized;

    normalized = normalized.replace(/^[\s"'([{<]+|[\s"'(){}\]}>]+$/g, '');

    normalized = normalizeStr(normalized);

  }

  if (!normalized) return '';

  return normalized.toUpperCase();

}



function uniqueNormalized(list, normalizer = (value) => value) {

  const result = [];

  const seen = new Set();

  if (!Array.isArray(list)) {

    return result;

  }

  for (const item of list) {

    const normalized = normalizer(item);

    if (!normalized) continue;

    if (seen.has(normalized)) continue;

    seen.add(normalized);

    result.push(normalized);

  }

  return result;

}



function parseNumericCandidate(value) {

  if (value === null || value === undefined || value === '') {

    return null;

  }

  const str = String(value).trim();

  if (str === '') return null;

  const num = Number(str);

  if (!Number.isFinite(num)) {

    return null;

  }

  return Math.max(0, Math.round(num));

}



function readManualCount(row) {

  if (!row || typeof row !== 'object') {

    return null;

  }

  const candidates = [

    row.licenseManualCount,

    row.manual_license_count,

    row.manualLicenseCount,

    row?.__raw?.licenseManualCount,

    row?.__raw?.manual_license_count,

  ];

  for (const candidate of candidates) {

    const parsed = parseNumericCandidate(candidate);

    if (parsed !== null) {

      return parsed;

    }

  }

  return null;

}



function readFallbackCount(row) {

  if (!row || typeof row !== 'object') {

    return 0;

  }

  const candidates = [

    row.licenses,

    row.so_luong_gp,

    row.soLuongGiayPhep,

    row?.__raw?.licenses,

    row?.__raw?.so_luong_gp,

    row?.__raw?.soLuongGiayPhep,

  ];

  for (const key of DIRECT_LICENSE_COUNT_FIELDS) {

    candidates.push(row?.__raw?.[key]);

  }

  for (const candidate of candidates) {

    const parsed = parseNumericCandidate(candidate);

    if (parsed !== null) {

      return parsed;

    }

  }

  return 0;

}



function splitAgencyValues(value) {

  if (Array.isArray(value)) {

    return value.map((entry) => normalizeStr(entry)).filter(Boolean);

  }

  const normalized = normalizeStr(value);

  if (!normalized) return [];

  return normalized

    .split(/[,;|]/g)

    .map((entry) => normalizeStr(entry))

    .filter(Boolean);

}



export function extractAgencyKeys(row) {

  const keys = new Set();

  if (!row || typeof row !== 'object') {

    return [];

  }

  const addKey = (value) => {

    if (value === null || value === undefined) return;

    const normalized = normalizeAgencyKey(value);

    if (normalized) {

      keys.add(normalized);

    }

    const matches = String(value).match(/\(([^)]+)\)/g);

    if (matches) {

      for (const segment of matches) {

        const inner = segment.replace(/^\(|\)$/g, '');

        const normalizedInner = normalizeAgencyKey(inner);

        if (normalizedInner) {

          keys.add(normalizedInner);

        }

      }

    }

  };



  const candidateFields = [

    'agents',

    'agency',

    'agencyName',

    'agency_name',

    'dai_ly',

    'daiLy',

    'hq_agency',

    'hqAgency',

    'hqAgencyName',

    'hq_agency_name',

    'customsAgency',

  ];



  for (const field of candidateFields) {

    const value = row[field];

    if (Array.isArray(value)) {

      for (const part of value) {

        addKey(part);

      }

    } else {

      for (const part of splitAgencyValues(value)) {

        addKey(part);

      }

    }

  }



  if (row.__raw && typeof row.__raw === 'object') {

    for (const [key, value] of Object.entries(row.__raw)) {

      const normalizedKey = normalizeStr(key).toLowerCase();

      if (

        normalizedKey.includes('đại lý') ||

        normalizedKey.includes('dai ly') ||

        normalizedKey.includes('hq')

      ) {

        for (const part of splitAgencyValues(value)) {

          addKey(part);

        }

      }

    }

  }



  return Array.from(keys);

}



function extractCodesFromStructuredRow(row) {

  const codes = new Set();

  if (!row || typeof row !== 'object') {

    return codes;

  }



  for (const [codeKey, numberKey] of LICENSE_CODE_FIELDS) {

    const code = normalizeLicenseCode(row[codeKey]);

    const number = normalizeStr(row[numberKey]);

    if (code && number) {

      if (/[A-Z]/.test(code)) {

        codes.add(code);

      }

    }

  }



  const rawCandidates = Object.entries(row)

    .filter(([key]) => {

      const normalizedKey = normalizeStr(key).toLowerCase();

      if (normalizedKey.startsWith('__')) return false;

      return (

        normalizedKey.includes('license') ||

        normalizedKey.includes('giấy phép') ||

        normalizedKey.includes('giay phep') ||

        normalizedKey.includes('ma_gp')

      );

    })

    .map(([, value]) => value);



  for (const candidate of rawCandidates) {

    if (candidate === null || candidate === undefined) continue;

    if (Array.isArray(candidate)) {

      for (const code of candidate) {

        const normalized = normalizeLicenseCode(code);

        if (normalized && /[A-Z]/.test(normalized)) {

          codes.add(normalized);

        }

      }

      continue;

    }

    const parts = String(candidate)

      .split(CODE_SPLIT_REGEX)

      .map((part) => normalizeLicenseCode(part))

      .filter((part) => part && /[A-Z]/.test(part));

    for (const part of parts) {

      codes.add(part);

    }

  }



  return codes;

}



function collectSnapshotCodes(row) {

  const source = new Set();

  const explicitExcluded = new Set();



  const addCode = (value, { excluded = false } = {}) => {

    const normalized = normalizeLicenseCode(value);

    if (!normalized || !/[A-Z]/.test(normalized)) {

      return;

    }

    source.add(normalized);

    if (excluded) {

      explicitExcluded.add(normalized);

    }

  };



  const addMany = (values, options) => {

    if (!values) return;

    if (Array.isArray(values)) {

      values.forEach((code) => addCode(code, options));

      return;

    }

    if (typeof values === 'string') {

      const parts = values

        .split(CODE_SPLIT_REGEX)

        .map((code) => normalizeLicenseCode(code))

        .filter((code) => code && /[A-Z]/.test(code));

      parts.forEach((code) => addCode(code, options));

    }

  };



  addMany(row?.licenseSourceCodes);

  addMany(row?.licenseCodes);

  addMany(row?.licenseExcludedCodes, { excluded: true });

  addMany(row?.__license_source_codes);

  addMany(row?.__license_included_codes);

  addMany(row?.__license_excluded_codes, { excluded: true });



  if (row?.__raw && typeof row.__raw === 'object') {

    const structured = extractCodesFromStructuredRow(row.__raw);

    structured.forEach((code) => addCode(code));

    addMany(row.__raw.licenseSourceCodes);

    addMany(row.__raw.licenseCodes);

    addMany(row.__raw.licenseExcludedCodes, { excluded: true });

  }



  const structuredFromRow = extractCodesFromStructuredRow(row);

  structuredFromRow.forEach((code) => addCode(code));



  return { source, explicitExcluded };

}



export function computeLicenseSnapshot(row, rules) {

  if (!row || typeof row !== 'object') {

    return {

      sourceCodes: [],

      includedCodes: [],

      excludedCodes: [],

      sourceCount: 0,

      includedCount: 0,

      excludedCount: 0,

      manualCount: null,

    };

  }



  const { source, explicitExcluded } = collectSnapshotCodes(row);

  const manualCount = readManualCount(row);

  const fallbackCount = readFallbackCount(row);



  const sourceCodes = Array.from(source).sort((a, b) => a.localeCompare(b));

  const explicitExcludedCodes = Array.from(explicitExcluded);



  const licenseRules = rules?.license || {};

  const globalExclude = new Set(uniqueNormalized(licenseRules?.exclude?.codes || [], normalizeLicenseCode));

  const agencyExcludeMap = new Map();

  const agencyEntries = Array.isArray(licenseRules?.exclude?.agencies) ? licenseRules.exclude.agencies : [];

  for (const entry of agencyEntries) {

    const key = normalizeAgencyKey(entry?.agency);

    if (!key) continue;

    const codes = uniqueNormalized(entry?.codes || [], normalizeLicenseCode);

    if (!codes.length) continue;

    agencyExcludeMap.set(key, new Set(codes));

  }



  const agencyKeys = extractAgencyKeys(row);

  for (const key of agencyKeys) {

    if (!agencyExcludeMap.has(key)) continue;

    for (const code of agencyExcludeMap.get(key)) {

      globalExclude.add(code);

    }

  }



  const excludedSet = new Set(explicitExcludedCodes.map((code) => normalizeLicenseCode(code)).filter(Boolean));

  for (const code of sourceCodes) {

    if (globalExclude.has(code)) {

      excludedSet.add(code);

    }

  }



  const excludedCodes = Array.from(excludedSet).sort((a, b) => a.localeCompare(b));

  const includedCodes = sourceCodes.filter((code) => !excludedSet.has(code));



  let includedCount = 0;

  if (manualCount !== null) {

    includedCount = manualCount;

  } else if (includedCodes.length > 0) {

    includedCount = includedCodes.length;

  } else if (fallbackCount > 0) {

    includedCount = fallbackCount;

  }



  const sourceCount = sourceCodes.length

    ? sourceCodes.length

    : manualCount !== null

    ? manualCount

    : fallbackCount;



  return {

    sourceCodes,

    includedCodes,

    excludedCodes,

    sourceCount,

    includedCount,

    excludedCount: excludedCodes.length,

    manualCount,

  };

}



export default computeLicenseSnapshot;

