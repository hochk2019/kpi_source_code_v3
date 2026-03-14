import { getBootstrapPasswordEnvKey } from '../../server/bootstrapAccountPasswords.js';

export const TEST_BOOTSTRAP_CREDENTIALS = Object.freeze({
  admin: 'admin123',
  nhanvien: '123456',
  'lead.hoc': 'Hoc@2024',
  'lead.phuong': 'Phuong@2024',
  'lead.tuan': 'Tuan@2024',
  'manager.hoangkimhoa': 'Hoa@2024',
  'manager.thuyha': 'ThuyHa@2024',
  'manager.hoainam': 'Nam@2024',
});

export function installTestBootstrapAuthEnv(target = process.env) {
  for (const [username, password] of Object.entries(TEST_BOOTSTRAP_CREDENTIALS)) {
    target[getBootstrapPasswordEnvKey(username)] = password;
  }
  return target;
}
