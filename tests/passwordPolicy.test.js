import { describe, expect, it } from 'vitest';

import {
  getNewPasswordMinLengthMessage,
  getPasswordMinLengthMessage,
  getPasswordMinLengthPlaceholder,
  MIN_PASSWORD_LENGTH,
} from '../packages/domain/src/passwordPolicy.js';

describe('passwordPolicy', () => {
  it('exports the shared minimum length', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('builds consistent validation messages', () => {
    expect(getPasswordMinLengthMessage()).toBe('Mật khẩu cần tối thiểu 8 ký tự');
    expect(getNewPasswordMinLengthMessage()).toBe('Mật khẩu mới cần tối thiểu 8 ký tự');
    expect(getPasswordMinLengthPlaceholder()).toBe('Ít nhất 8 ký tự');
  });
});
