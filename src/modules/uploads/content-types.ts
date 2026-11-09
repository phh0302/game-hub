// Đuôi file được phép trong bản build game → Content-Type khi phục vụ
// Không có trong danh sách = bị từ chối (chặn file thực thi, script server…)

export const BUILD_CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  map: "application/json",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
  csv: "text/csv; charset=utf-8",
  // Hình ảnh
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  // Âm thanh / video
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp4: "video/mp4",
  webm: "video/webm",
  // Font
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  // Engine game (Phaser, Cocos, Unity WebGL không nén, Godot…)
  wasm: "application/wasm",
  data: "application/octet-stream",
  bin: "application/octet-stream",
  unityweb: "application/octet-stream",
  pck: "application/octet-stream",
  atlas: "text/plain; charset=utf-8",
  fnt: "text/plain; charset=utf-8",
  plist: "application/xml",
  tmx: "application/xml",
  tsx: "application/xml",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
};

export function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function buildContentType(path: string): string | null {
  return BUILD_CONTENT_TYPES[extensionOf(path)] ?? null;
}
