// Tạo dist/ từ SDK trình duyệt (public/sdk/gamehub-sdk.js) – 1 nguồn duy nhất, không viết lại logic.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_API = "https://play.monlabs.fun";

/** Bọc mã SDK (IIFE gắn window.GameHub) thành module ESM: chỉ chạy khi dùng lần đầu, an toàn khi SSR */
export function buildModule(sdkSource) {
  return `// @monlabs/sdk – sinh tự động từ public/sdk/gamehub-sdk.js, đừng sửa tay
const DEFAULT_API = ${JSON.stringify(DEFAULT_API)};
let instance = null;

function load() {
  if (instance) return instance;
  if (typeof window === "undefined") {
    throw new Error("[@monlabs/sdk] chỉ chạy trên trình duyệt – gọi GameHub sau khi trang đã tải (không gọi lúc SSR)");
  }
  if (!window.GameHub) {
    (function () {
${sdkSource.replace(/^/gm, "      ")}
    }).call(window);
  }
  instance = window.GameHub;
  return instance;
}

/** Chế độ độc lập: mặc định gọi API của play.monlabs.fun (bản <script> lấy domain từ nơi tải file) */
function withDefaults(options) {
  if (options && options.projectKey && !options.apiBase) return { ...options, apiBase: DEFAULT_API };
  return options;
}

export const GameHub = new Proxy(
  {},
  {
    get(_, key) {
      const sdk = load();
      if (key === "init") return (options) => sdk.init(withDefaults(options));
      const value = sdk[key];
      return typeof value === "function" ? value.bind(sdk) : value;
    },
  },
);

export default GameHub;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const src = fs.readFileSync(path.join(here, "../../public/sdk/gamehub-sdk.js"), "utf8");
  fs.mkdirSync(path.join(here, "dist"), { recursive: true });
  fs.writeFileSync(path.join(here, "dist/index.js"), buildModule(src));
  fs.copyFileSync(path.join(here, "src/index.d.ts"), path.join(here, "dist/index.d.ts"));
  console.log("✓ dist/index.js, dist/index.d.ts");
}
