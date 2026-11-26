#!/usr/bin/env node
/**
 * @monlabs/cli – đẩy bản build game lên Monlabs Game Hub từ terminal / CI.
 *
 *   npx @monlabs/cli login                       # dán token tạo ở Studio → Token cho CLI / CI
 *   npx @monlabs/cli games                       # game của studio
 *   npx @monlabs/cli deploy ./dist --game my-game --version 1.0.1 --notes "Sửa lỗi"
 *   npx @monlabs/cli sandbox http://localhost:5173
 *
 * Token: biến môi trường MONLABS_TOKEN (khuyên dùng trong CI) hoặc file ~/.monlabs/config.json (quyền 600).
 * Không bao giờ in token ra màn hình.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const DEFAULT_HUB = "https://play.monlabs.fun";
const CONFIG_DIR = path.join(os.homedir(), ".monlabs");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const MAX_ZIP = 50 * 1024 * 1024;
const SKIP = /(^|\/)(node_modules|\.git|\.svn|\.idea|\.vscode)(\/|$)|(^|\/)(\.DS_Store|Thumbs\.db)$|(^|\/)\.env(\..*)?$|\.map$/;

// ───────── tiện ích ─────────
const color = !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = { green: paint(32), red: paint(31), yellow: paint(33), dim: paint(2), bold: paint(1) };

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // Windows: bỏ qua
  }
}

/** Cấu hình dự án (monlabs.json ở thư mục hiện tại): { "game": "my-game", "dir": "dist" } */
function readProject() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve("monlabs.json"), "utf8"));
  } catch {
    return {};
  }
}

function hubUrl(args) {
  return String(args.hub || process.env.MONLABS_HUB || readConfig().hub || DEFAULT_HUB).replace(/\/+$/, "");
}

function token() {
  const t = process.env.MONLABS_TOKEN || readConfig().token;
  if (!t) {
    console.error(c.red("✗ Chưa có token.") + " Chạy `monlabs login` hoặc đặt biến môi trường MONLABS_TOKEN.");
    process.exit(2);
  }
  return t;
}

async function api(args, method, p, body) {
  const res = await fetch(`${hubUrl(args)}/api/v1${p}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, ...(body ? { "content-type": "application/json" } : {}), "user-agent": "monlabs-cli/1" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // không phải JSON
  }
  if (!res.ok) {
    const err = new Error(json?.error?.message || `HTTP ${res.status}`);
    err.code = json?.error?.code || `HTTP_${res.status}`;
    err.status = res.status;
    throw err;
  }
  return json;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

/** Gom các file của thư mục build (bỏ node_modules, .git, .env, *.map) */
export function collectFiles(dir) {
  const files = {};
  let count = 0;
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (SKIP.test(r)) continue;
      const a = path.join(abs, entry.name);
      if (entry.isDirectory()) walk(a, r);
      else if (entry.isFile()) {
        files[r] = new Uint8Array(fs.readFileSync(a));
        count++;
      }
    }
  };
  walk(dir, "");
  return { files, count };
}

function formatBytes(n) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

// ───────── lệnh ─────────
async function cmdLogin(args) {
  const t = process.env.MONLABS_TOKEN || (await ask("Token (Studio → Token cho CLI / CI): ", { hidden: true }));
  if (!/^mlb_[A-Za-z0-9_-]{32,64}$/.test(t)) {
    console.error(c.red("✗ Token không đúng định dạng (mlb_…)."));
    process.exit(2);
  }
  process.env.MONLABS_TOKEN = t;
  const r = await api(args, "GET", "/developer/games");
  writeConfig({ ...readConfig(), token: t, hub: hubUrl(args) });
  console.log(`${c.green("✓")} Đã đăng nhập studio ${c.bold(r.studio.name)} (${r.games.length} game). Token lưu ở ${CONFIG_FILE}`);
}

function cmdLogout() {
  const cfg = readConfig();
  delete cfg.token;
  writeConfig(cfg);
  console.log(`${c.green("✓")} Đã xóa token khỏi máy (token vẫn còn hiệu lực – thu hồi trong Studio nếu bị lộ).`);
}

async function cmdGames(args) {
  const r = await api(args, "GET", "/developer/games");
  console.log(c.bold(`Studio: ${r.studio.name}`));
  for (const g of r.games) {
    const live = g.versions?.find((v) => v.isCurrent)?.version;
    console.log(`  ${g.slug.padEnd(28)} ${String(g.status).padEnd(15)} ${live ? `v${live}` : c.dim("chưa có bản chạy")}`);
  }
  if (args.json) console.log(JSON.stringify(r.games.map((g) => ({ id: g.id, slug: g.slug, status: g.status }))));
}

export async function cmdDeploy(args) {
  const project = readProject();
  const dir = path.resolve(args._[1] || project.dir || "dist");
  const slug = args.game || project.game;
  let version = args.version;
  if (!version) {
    try {
      version = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")).version;
    } catch {
      // không có package.json
    }
  }
  if (!slug) throw Object.assign(new Error("Thiếu --game <slug> (hoặc \"game\" trong monlabs.json)"), { code: "USAGE" });
  if (!version) throw Object.assign(new Error("Thiếu --version (hoặc \"version\" trong package.json)"), { code: "USAGE" });
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw Object.assign(new Error(`Không thấy thư mục ${dir} – build game trước`), { code: "USAGE" });

  const { files, count } = collectFiles(dir);
  if (!files["index.html"]) throw Object.assign(new Error(`Thiếu index.html ở gốc ${dir}`), { code: "NO_INDEX" });
  const { zipSync } = await import("fflate");
  const zip = zipSync(files, { level: 6 });
  console.log(`${c.dim("•")} ${count} file → zip ${formatBytes(zip.byteLength)}`);
  if (zip.byteLength > MAX_ZIP) throw Object.assign(new Error("Bản build quá 50MB sau khi nén"), { code: "TOO_LARGE" });

  const { games } = await api(args, "GET", "/developer/games");
  const game = games.find((g) => g.slug === slug || g.id === slug);
  if (!game) throw Object.assign(new Error(`Studio không có game "${slug}" – xem \`monlabs games\``), { code: "GAME_NOT_FOUND" });

  if (args["dry-run"]) {
    console.log(`${c.yellow("○")} --dry-run: dừng trước khi upload (${game.slug} v${version})`);
    return { dryRun: true };
  }

  const { upload } = await api(args, "POST", "/developer/uploads", { kind: "build", contentType: "application/zip", size: zip.byteLength });
  const put = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: zip });
  if (!put.ok) throw Object.assign(new Error(`Tải file lên thất bại (HTTP ${put.status})`), { code: "UPLOAD_FAILED" });
  console.log(`${c.dim("•")} đã tải lên, đang giải nén + quét…`);

  const notes = typeof args.notes === "string" ? args.notes : undefined;
  const { version: v } = await api(args, "POST", `/developer/games/${game.id}/versions`, { version, uploadKey: upload.key, releaseNotes: notes });
  console.log(`${c.green("✓")} ${c.bold(`${game.slug} v${v.version}`)} – ${v.files} file, trạng thái ${v.status}`);
  if (v.scan) {
    const tone = v.scan.level === "critical" ? c.red : v.scan.level === "warning" ? c.yellow : c.green;
    console.log(`  quét: ${tone(v.scan.level)}`);
    for (const f of v.scan.findings?.slice(0, 10) ?? []) console.log(`   ${f.severity === "critical" ? c.red("!") : "-"} ${f.rule} ${c.dim(f.path)}`);
  }
  if (v.autoCover) console.log(`  ảnh bìa: lấy từ ${v.autoCover.path}`);
  console.log(c.dim(`  Studio: ${hubUrl(args)}/developer/games/${game.id}`));
  if (v.scan?.level === "critical") process.exitCode = 3;
  return v;
}

function cmdSandbox(args) {
  const url = args._[1] || "http://localhost:5173";
  const link = `${hubUrl(args)}/developer/sandbox?url=${encodeURIComponent(url)}`;
  console.log(`Mở trong trình duyệt:\n  ${link}`);
}

function help() {
  console.log(`monlabs – CLI cho Monlabs Game Hub

  monlabs login                      lưu token (tạo ở Studio → Token cho CLI / CI)
  monlabs logout                     xóa token khỏi máy
  monlabs games                      game của studio
  monlabs deploy [dir] --game <slug> [--version 1.0.1] [--notes "…"] [--dry-run]
  monlabs sandbox [url]              link thử game local với hub giả lập

Tùy chọn: --hub <url> (mặc định ${DEFAULT_HUB}) · biến môi trường MONLABS_TOKEN, MONLABS_HUB
monlabs.json: { "game": "my-game", "dir": "dist" }  ·  version mặc định lấy từ package.json`);
}

export async function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  try {
    if (!cmd || cmd === "help" || args.help) return help();
    if (cmd === "login") return await cmdLogin(args);
    if (cmd === "logout") return cmdLogout();
    if (cmd === "games") return await cmdGames(args);
    if (cmd === "deploy") return await cmdDeploy(args);
    if (cmd === "sandbox") return cmdSandbox(args);
    console.error(c.red(`✗ Không có lệnh "${cmd}"`));
    help();
    process.exitCode = 2;
  } catch (err) {
    console.error(`${c.red("✗")} ${err.message}${err.code ? c.dim(` (${err.code})`) : ""}`);
    if (err.status === 401) console.error("  Token sai, đã bị thu hồi hoặc hết hạn – tạo token mới trong Studio.");
    process.exitCode = err.code === "USAGE" ? 2 : 1;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  await main(process.argv.slice(2));
}
