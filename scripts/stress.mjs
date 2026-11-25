#!/usr/bin/env node
/**
 * Bắn tải vào các API đọc công khai để xem hub chịu được bao nhiêu và lớp chặn (429) hoạt động đúng.
 *
 *   node scripts/stress.mjs --url http://localhost:3000 --concurrency 20 --duration 30
 *   node scripts/stress.mjs --url https://staging.example.com --rps 50 --duration 60
 *
 * Mặc định CHỈ cho chạy vào localhost / 127.0.0.1 / *.test / staging.* – chạy vào production phải thêm --i-know-this-is-prod
 * (sẽ đốt hạn mức, có thể tự chặn IP của bạn và bắn cảnh báo Telegram). Chỉ gửi GET, không ghi dữ liệu.
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);
if (args.help) {
  console.log("Dùng: node scripts/stress.mjs --url <base> [--concurrency 20] [--duration 30] [--rps 0] [--paths /api/v1/games,/api/v1/status]");
  process.exit(0);
}
const base = new URL(args.url ?? "http://localhost:3000");
const SAFE = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.test|.*\.localhost|staging\..*|.*-staging\..*|.*\.vercel\.app)$/i;
if (!SAFE.test(base.hostname) && args["i-know-this-is-prod"] !== "true") {
  console.error(`Từ chối chạy vào ${base.hostname} (trông như production). Thêm --i-know-this-is-prod nếu chắc chắn.`);
  process.exit(2);
}
const concurrency = Math.max(1, Number(args.concurrency ?? 20));
const durationMs = Math.max(1, Number(args.duration ?? 30)) * 1000;
const rps = Number(args.rps ?? 0); // 0 = không giới hạn, chạy hết tốc độ theo số luồng
const paths = (args.paths ?? "/api/v1/games,/api/v1/status,/api/v1/health,/").split(",").map((p) => p.trim()).filter(Boolean);

const latencies = [];
const statuses = new Map();
let sent = 0;
let errors = 0;
const started = Date.now();
const deadline = started + durationMs;
const interval = rps > 0 ? 1000 / rps : 0;
let nextSlot = started;

async function worker(id) {
  let i = id;
  while (Date.now() < deadline) {
    if (interval) {
      const wait = nextSlot - Date.now();
      nextSlot = Math.max(nextSlot, Date.now()) + interval;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (Date.now() >= deadline) break;
    }
    const path = paths[i++ % paths.length];
    const t0 = performance.now();
    sent++;
    try {
      const res = await fetch(new URL(path, base), { headers: { "user-agent": "monlabs-stress/1" }, signal: AbortSignal.timeout(15_000) });
      await res.arrayBuffer();
      statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
    } catch {
      errors++;
    }
    latencies.push(performance.now() - t0);
  }
}

const progress = setInterval(() => {
  process.stdout.write(`\r${Math.round((Date.now() - started) / 1000)}s  sent=${sent}  errors=${errors}   `);
}, 1000);
await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
clearInterval(progress);

latencies.sort((a, b) => a - b);
const pct = (p) => (latencies.length ? Math.round(latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]) : 0);
const secs = (Date.now() - started) / 1000;
const count = (pred) => [...statuses].filter(([s]) => pred(s)).reduce((a, [, n]) => a + n, 0);
const report = {
  target: base.origin,
  concurrency,
  seconds: Math.round(secs),
  requests: sent,
  rps: Math.round(sent / secs),
  status: Object.fromEntries([...statuses].sort((a, b) => a[0] - b[0])),
  networkErrors: errors,
  latencyMs: { p50: pct(50), p95: pct(95), p99: pct(99), max: Math.round(latencies.at(-1) ?? 0) },
};
console.log("\n" + JSON.stringify(report, null, 2));
const fivexx = count((s) => s >= 500);
if (fivexx > 0 || errors > 0) {
  console.error(`✗ Có ${fivexx} lỗi 5xx và ${errors} lỗi mạng`);
  process.exit(1);
}
console.log(`✓ Không có 5xx. ${count((s) => s === 429)} request bị giới hạn (429) – lớp chặn đang hoạt động.`);
