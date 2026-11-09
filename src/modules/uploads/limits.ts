// Giới hạn upload – dùng chung cho server và giao diện

/** File .zip bản build tối đa */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
/** Tổng dung lượng sau khi giải nén (chống zip bomb) */
export const MAX_UNZIPPED_BYTES = 150 * 1024 * 1024; // 150MB
/** Số file tối đa trong 1 bản build */
export const MAX_BUILD_FILES = 2000;
/** Ảnh bìa / avatar tối đa */
export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1MB

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
