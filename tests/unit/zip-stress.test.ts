// Stress / giới hạn của bước giải nén bản build: zip bomb, khai man kích thước, quá nhiều file, đường dẫn độc
import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { extractBuild, ZipValidationError } from "../../src/modules/uploads/zip.ts";
import { MAX_BUILD_FILES, MAX_UNZIPPED_BYTES } from "../../src/modules/uploads/limits.ts";

const html = strToU8("<!doctype html><title>x</title>");

function run(zip: Uint8Array) {
  const t0 = performance.now();
  try {
    extractBuild(zip);
    return { code: "OK", ms: performance.now() - t0 };
  } catch (err) {
    return { code: err instanceof ZipValidationError ? err.code : `OTHER: ${String(err)}`, ms: performance.now() - t0 };
  }
}

/** Sửa kích thước giải nén khai báo của 1 file trong zip (header cục bộ + danh mục trung tâm) – giả lập zip khai man */
function lieAboutSize(zip: Uint8Array, name: string, fakeSize: number) {
  const out = zip.slice();
  const view = new DataView(out.buffer);
  const nameBytes = strToU8(name);
  const matches = (at: number) => nameBytes.every((b, i) => out[at + i] === b);
  for (let i = 0; i + 46 < out.length; i++) {
    const sig = view.getUint32(i, true);
    if (sig === 0x04034b50 && view.getUint16(i + 26, true) === nameBytes.length && matches(i + 30)) view.setUint32(i + 22, fakeSize, true);
    if (sig === 0x02014b50 && view.getUint16(i + 28, true) === nameBytes.length && matches(i + 46)) view.setUint32(i + 24, fakeSize, true);
  }
  return out;
}

test("zip bomb: 1 file nén vài trăm KB nhưng giải nén > giới hạn → chặn ngay, không giải nén", () => {
  const zeros = new Uint8Array(MAX_UNZIPPED_BYTES + 1024 * 1024);
  const zip = zipSync({ "index.html": html, "data/blob.bin": zeros }, { level: 9 });
  assert.ok(zip.byteLength < 1024 * 1024, `zip ${zip.byteLength} bytes`);
  const r = run(zip);
  assert.equal(r.code, "ZIP_TOO_LARGE_UNZIPPED");
  assert.ok(r.ms < 2000, `mất ${Math.round(r.ms)}ms`);
});

test("zip bomb chia nhỏ: nhiều file cộng dồn vượt giới hạn", () => {
  const chunk = new Uint8Array(20 * 1024 * 1024);
  const files: Record<string, Uint8Array> = { "index.html": html };
  for (let i = 0; i < Math.ceil(MAX_UNZIPPED_BYTES / chunk.length) + 1; i++) files[`data/part-${i}.bin`] = chunk;
  assert.equal(run(zipSync(files, { level: 9 })).code, "ZIP_TOO_LARGE_UNZIPPED");
});

test("khai man kích thước: header nói 10 byte, dữ liệu thật 40MB → ZIP_INVALID, không nhận file", () => {
  const real = new Uint8Array(40 * 1024 * 1024).fill(7);
  const zip = lieAboutSize(zipSync({ "index.html": html, "data/x.bin": real }, { level: 9 }), "data/x.bin", 10);
  const r = run(zip);
  assert.equal(r.code, "ZIP_INVALID");
  assert.ok(r.ms < 5000, `mất ${Math.round(r.ms)}ms`);
});

test("quá nhiều file: đúng giới hạn thì nhận, thêm 1 file thì chặn", () => {
  const files: Record<string, Uint8Array> = { "index.html": html };
  for (let i = 1; i < MAX_BUILD_FILES; i++) files[`f/${i}.js`] = strToU8("1");
  assert.equal(run(zipSync(files)).code, "OK");
  files["f/extra.js"] = strToU8("1");
  assert.equal(run(zipSync(files)).code, "ZIP_TOO_MANY_FILES");
});

test("đường dẫn độc: ../, tuyệt đối, ổ đĩa Windows, ký tự điều khiển", () => {
  for (const bad of ["../evil.js", "..\\evil.js", "a/../../evil.js", "/etc/passwd.js", "C:/win.js", "a\u0000b.js", "./x.js", "a//b.js"]) {
    assert.equal(run(zipSync({ "index.html": html, [bad]: strToU8("1") })).code, "ZIP_UNSAFE_PATH", bad);
  }
});

test("rác: không phải zip / zip cụt / zip rỗng", () => {
  assert.equal(run(strToU8("not a zip at all")).code, "ZIP_INVALID");
  const zip = zipSync({ "index.html": html, "a.js": strToU8("x".repeat(5000)) });
  assert.notEqual(run(zip.slice(0, Math.floor(zip.length / 2))).code, "OK");
  assert.equal(run(zipSync({})).code, "ZIP_EMPTY");
});

test("nội dung bị sửa sau khi nén (CRC lệch, cùng kích thước) → ZIP_INVALID", () => {
  const body = strToU8("console.log('hello from a perfectly normal game file');");
  const zip = zipSync({ "index.html": html, "game.js": body }, { level: 0 }); // không nén: nội dung nằm nguyên trong zip
  const at = zip.findIndex((_, i) => body.every((b, k) => zip[i + k] === b));
  assert.ok(at > 0);
  const tampered = zip.slice();
  tampered[at + 5] ^= 0x20;
  assert.equal(run(tampered).code, "ZIP_INVALID");
  assert.equal(run(zip).code, "OK");
});
