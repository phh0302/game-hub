import { test } from "node:test";
import assert from "node:assert/strict";
import { scanBuild } from "../../src/modules/uploads/scan.ts";

const f = (path: string, text: string) => ({ path, data: new TextEncoder().encode(text) });
const rules = (r: ReturnType<typeof scanBuild>) => r.findings.map((x) => `${x.severity}:${x.rule}`).sort();

test("game sạch → clean", () => {
  const r = scanBuild([
    f("index.html", '<!doctype html><script src="https://play.monlabs.fun/sdk/v3/gamehub-sdk.js"></script><canvas></canvas>'),
    f("game.js", "GameHub.init().then(()=>{ let score=0; requestAnimationFrame(loop); window.open('https://example.com'); })"),
    f("logo.png", "\u0089PNG coinhive"), // file nhị phân không quét
  ]);
  assert.equal(r.level, "clean");
  assert.equal(r.scannedFiles, 2);
});

test("đào coin / lừa ví → critical", () => {
  assert.deepEqual(rules(scanBuild([f("m.js", "var miner = new CoinHive.Anonymous('x'); miner.start()")])), ["critical:crypto_miner"]);
  const r = scanBuild([
    f("index.html", "<p>Nhập seed phrase để nhận thưởng</p><input type=password>"),
    f("a.js", "await ethereum.request({ method: 'eth_sendTransaction', params })"),
  ]);
  assert.equal(r.level, "critical");
  assert.deepEqual(rules(r), ["critical:wallet_drain", "critical:wallet_phishing", "warning:password_input", "warning:wallet_access"]);
});

test("quảng cáo ngoài, SDK cổng khác, chuyển hướng, script ngoài → warning/info", () => {
  const r = scanBuild([
    f("index.html", '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script><script src="//evil.example/x.js"></script>'),
    f("b.js", "if (x) top.location.href = 'https://scam.example'; gdsdk.showAd(); // html5.api.gamedistribution.com"),
  ]);
  assert.equal(r.level, "warning");
  assert.deepEqual(rules(r), [
    "info:external_script",
    "info:external_script",
    "warning:ad_network",
    "warning:other_portal_sdk",
    "warning:redirect",
  ]);
  assert.ok(r.findings.find((x) => x.rule === "external_script" && x.match === "evil.example"));
});

test("mã rối nặng và eval(atob()) → warning; ít _0x thì bỏ qua", () => {
  const heavy = Array.from({ length: 400 }, (_, i) => `_0x${(0x1a2b + i).toString(16)}`).join(";");
  assert.deepEqual(rules(scanBuild([f("o.js", heavy)])), ["warning:obfuscated"]);
  assert.deepEqual(rules(scanBuild([f("o.js", "_0x1a2b;_0x1a2c")])), []);
  assert.deepEqual(rules(scanBuild([f("e.js", "eval(atob('ZG9jdW1lbnQ='))")])), ["warning:eval_payload"]);
});

test("chữ cờ bạc / spam trong HTML hoặc tên, mô tả game", () => {
  assert.deepEqual(rules(scanBuild([f("index.html", "<h1>Nổ hũ đổi thưởng – nạp tiền nhận 100%</h1>")])), ["warning:gambling_spam"]);
  assert.deepEqual(rules(scanBuild([f("index.html", "<h1>Snake</h1>")], ["Tài xỉu online uy tín", "nhà cái số 1"])), ["warning:gambling_spam"]);
  // chữ trong file JS thư viện không tính (tránh báo nhầm)
  assert.deepEqual(rules(scanBuild([f("lib.js", "const casino = 'casino';")])), []);
});
