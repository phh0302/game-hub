// Phiên bản điều khoản người đăng game. ĐỔI chuỗi này khi sửa nội dung điều khoản
// → mọi studio phải đồng ý lại trước khi tạo game / upload tiếp.
export const DEVELOPER_TERMS_VERSION = "2026-11-09";

export function isTermsUpToDate(studio: { termsVersion: string | null }) {
  return studio.termsVersion === DEVELOPER_TERMS_VERSION;
}
