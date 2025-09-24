#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { XMLParser } from 'fast-xml-parser';

const DEFAULT_MEMBERS = [
  { name: 'Phương', team: 'Team 1' },
  { name: 'Hạnh', team: 'Team 1' },
  { name: 'Bảo', team: 'Team 1' },
  { name: 'Hà Bé', team: 'Team 1' },
  { name: 'Hương', team: 'Team 1' },
  { name: 'Tuấn', team: 'Team 2' },
  { name: 'Hòa', team: 'Team 2' },
  { name: 'Thu', team: 'Team 2' },
  { name: 'Hằng', team: 'Team 2' },
  { name: 'Huyền', team: 'Team 2' },
  { name: 'Học', team: 'Team 3' },
  { name: 'Thanh', team: 'Team 3' },
  { name: 'Huy', team: 'Team 3' },
  { name: 'Linh', team: 'Team 3' },
  { name: 'Thảo', team: 'Team 3' },
  { name: 'Hưng', team: 'Team 3' },
];

const COLUMN_ALIASES = {
  so_tk: ['so_tk', 'So_tk', 'SoTK', 'sotk'],
  date: ['ngay_dang_ky', 'Ngay_dang_ky', 'ngay_dk', 'NgayDK', 'NgayLapToKhai'],
  mst: ['mst', 'MST', 'ma_so_thue', 'MaSoThue'],
  cong_ty: ['cong_ty', 'ten_dn', 'TenDoanhNghiep'],
  loai_hinh: ['loai_hinh', 'Loai_hinh', 'ma_loai_hinh'],
  num_items: ['muc_hang', 'so_muc'],
  licenses: ['ds_gp', 'ds_giay_phep', 'DanhSachGiayPhep', 'ma_gp'],
  nhan_vien_import: ['nhan_vien_nhap', 'NhanVienNhap', 'NVNhap'],
  nhan_vien_export: ['nhan_vien_xuat', 'NhanVienXuat', 'NVXuat'],
};

function usage() {
  console.log(`Sử dụng: pnpm ecus:mock [tùy chọn]\n` +
    `  --count <n>       Số bản ghi mô phỏng (mặc định 10)\n` +
    `  --start <yyyy-mm-dd> Ngày bắt đầu mô phỏng\n` +
    `  --range <n>       Số ngày trải dài dữ liệu (mặc định 5)\n` +
    `  --output <file>   Ghi JSON mô phỏng vào file\n\n` +
    `Sử dụng: pnpm ecus:inspect --file <đường dẫn XML>\n` +
    `  Phân tích file XML tờ khai ECUS và in ra các trường quan trọng.`);
}

function toISODate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function pad(num, size) {
  return String(num).padStart(size, '0');
}

function buildMockRows({ count, start, range }) {
  const rows = [];
  const startDate = start ? new Date(start) : new Date();
  const licensePool = ['GP01', 'GP02', 'HDGC', 'ZN02', 'GP03'];
  for (let i = 0; i < count; i += 1) {
    const offset = i % Math.max(range, 1);
    const rowDate = new Date(startDate.getTime() + offset * 24 * 60 * 60 * 1000);
    const staff = DEFAULT_MEMBERS[i % DEFAULT_MEMBERS.length];
    const isExport = i % 2 === 1;
    const licenses = [];
    const licenseCount = (i % 3) + 1;
    for (let j = 0; j < licenseCount; j += 1) {
      licenses.push(licensePool[(i + j) % licensePool.length]);
    }
    const formattedLicenses = licenses.join(', ');
    rows.push({
      so_tk: `TK${pad(i + 1, 6)}`,
      ngay_dang_ky: `${toISODate(rowDate)}T08:00:00.000Z`,
      loai_hinh: isExport ? 'B13' : 'A11',
      nhanh: 'MRHOC',
      mst: `010${pad(1000000 + i, 7)}`,
      cong_ty: `Công ty ${pad(i + 1, 3)}`,
      muc_hang: (i % 5) + 1,
      licenses: formattedLicenses,
      nhan_vien_nhap: isExport ? '' : staff.name,
      nhan_vien_xuat: isExport ? staff.name : '',
      team: staff.team,
    });
  }
  return rows;
}

function buildKeyLookup(record) {
  const lookup = new Map();
  for (const key of Object.keys(record)) {
    lookup.set(key.toLowerCase(), key);
  }
  return lookup;
}

function readField(record, lookup, name) {
  if (!name) return undefined;
  const key = lookup.get(String(name).toLowerCase());
  return key ? record[key] : undefined;
}

function normalizeDeclaration(record) {
  if (!record || typeof record !== 'object') return null;
  const lookup = buildKeyLookup(record);
  const resolve = (field) => {
    const aliases = [field, ...(COLUMN_ALIASES[field] || [])];
    for (const alias of aliases) {
      const value = readField(record, lookup, alias);
      if (value !== undefined) return value;
    }
    return undefined;
  };
  return {
    so_tk: resolve('so_tk'),
    date: resolve('date') || resolve('ngay_dang_ky') || resolve('Ngay_dang_ky'),
    mst: resolve('mst'),
    cong_ty: resolve('cong_ty'),
    loai_hinh: resolve('loai_hinh'),
    num_items: resolve('num_items'),
    licenses: resolve('licenses'),
    nhan_vien_nhap: resolve('nhan_vien_import'),
    nhan_vien_xuat: resolve('nhan_vien_export'),
  };
}

async function handleMock(values) {
  const count = Number.parseInt(values.count || '10', 10);
  const range = Number.parseInt(values.range || values.days || '5', 10);
  const rows = buildMockRows({ count: Number.isFinite(count) ? count : 10, start: values.start, range: Number.isFinite(range) ? range : 5 });
  const output = JSON.stringify(rows, null, 2);
  if (values.output) {
    const target = path.resolve(process.cwd(), values.output);
    await writeFile(target, output, 'utf8');
    console.log(`Đã ghi ${rows.length} dòng mô phỏng vào ${target}`);
  } else {
    console.log(output);
  }
}

async function handleInspect(values, positionals = []) {
  const filePath = values.file || positionals[1];
  if (!filePath) {
    console.error('Thiếu đường dẫn file XML.');
    usage();
    process.exit(1);
  }
  const target = path.resolve(process.cwd(), filePath);
  const xmlContent = await readFile(target, 'utf8');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const data = parser.parse(xmlContent);
  const candidates = [];

  function visit(node, trail) {
    if (Array.isArray(node)) {
      node.forEach((child, idx) => visit(child, trail.concat(`[${idx}]`)));
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    const keys = Object.keys(node);
    const lowerKeys = keys.map((key) => key.toLowerCase());
    const hasDeclarationFields = lowerKeys.some((key) =>
      key.includes('so_tk') || key.includes('sotk') || key.includes('ma_so_thue') || key.includes('mst')
    );
    if (hasDeclarationFields) {
      candidates.push({ path: trail.join(' > ') || '/', record: node });
    }
    for (const [key, value] of Object.entries(node)) {
      visit(value, trail.concat(key));
    }
  }

  visit(data, []);

  if (!candidates.length) {
    console.warn('Không tìm thấy nút tờ khai nào trong file XML.');
    return;
  }

  for (const candidate of candidates) {
    const normalized = normalizeDeclaration(candidate.record);
    console.log(`\nĐường dẫn: ${candidate.path || '/'}`);
    console.log('  Trường nhận dạng:');
    console.log(`    Số tờ khai: ${normalized.so_tk ?? '—'}`);
    console.log(`    Ngày: ${toISODate(normalized.date) ?? '—'}`);
    console.log(`    MST: ${normalized.mst ?? '—'}`);
    console.log(`    Công ty: ${normalized.cong_ty ?? '—'}`);
    console.log(`    Loại hình: ${normalized.loai_hinh ?? '—'}`);
    console.log(`    Số mục hàng: ${normalized.num_items ?? '—'}`);
    console.log(`    Giấy phép: ${normalized.licenses ?? '—'}`);
    console.log(`    NV nhập: ${normalized.nhan_vien_nhap ?? '—'}`);
    console.log(`    NV xuất: ${normalized.nhan_vien_xuat ?? '—'}`);
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      count: { type: 'string' },
      range: { type: 'string' },
      days: { type: 'string' },
      start: { type: 'string' },
      output: { type: 'string' },
      file: { type: 'string' },
    },
  });

  const command = positionals[0];
  if (command === 'inspect') {
    await handleInspect(values, positionals);
    return;
  }
  if (command === 'mock' || !command) {
    await handleMock(values);
    return;
  }
  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error('Thao tác thất bại:', err);
  process.exit(1);
});
