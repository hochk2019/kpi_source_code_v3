export const MIN_PASSWORD_LENGTH = 8;

export function getPasswordMinLengthMessage() {
  return `Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`;
}

export function getNewPasswordMinLengthMessage() {
  return `Mật khẩu mới cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`;
}

export function getPasswordMinLengthPlaceholder() {
  return `Ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
}
