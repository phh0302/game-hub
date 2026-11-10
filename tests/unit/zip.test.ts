import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { extractBuild, ZipValidationError } from "../../src/modules/uploads/zip.ts";

const html = strToU8("<!doctype html><title>x</title>");
const js = strToU8("console.log(1)");

function code(fn: () => unknown) {
  try {
    fn();
    return "OK";
  } catch (err) {
    return err instanceof ZipValidationError ? err.code : `OTHER: ${String(err)}`;
  }
}

test("bản build hợp lệ ở gốc", () => {
  const zip = zipSync({ "index.html": html, "js/game.js": js, "img/a.png": new Uint8Array([1, 2, 3]) });
  const out = extractBuild(zip);
  assert.deepEqual(out.files.map((f) => f.path).sort(), ["img/a.png", "index.html", "js/game.js"]);
  assert.equal(out.strippedFolder, null);
  assert.equal(out.files.find((f) => f.path === "js/game.js")?.contentType, "text/javascript; charset=utf-8");
  assert.equal(out.totalBytes, html.length + js.length + 3);
});

test("tự bỏ 1 thư mục bao ngoài + bỏ qua file rác macOS", () => {
  const zip = zipSync({
    "my-game/index.html": html,
    "my-game/game.js": js,
    "__MACOSX/my-game/._game.js": new Uint8Array([0]),
    "my-game/.DS_Store": new Uint8Array([0]),
  });
  const out = extractBuild(zip);
  assert.equal(out.strippedFolder, "my-game");
  assert.deepEqual(out.files.map((f) => f.path).sort(), ["game.js", "index.html"]);
});

test("thiếu index.html", () => {
  assert.equal(code(() => extractBuild(zipSync({ "game.js": js }))), "ZIP_NO_INDEX_HTML");
  // 2 thư mục gốc → không đoán được
  assert.equal(code(() => extractBuild(zipSync({ "a/index.html": html, "b/x.js": js }))), "ZIP_NO_INDEX_HTML");
});

test("đường dẫn thoát thư mục bị chặn", () => {
  assert.equal(code(() => extractBuild(zipSync({ "index.html": html, "../evil.js": js }))), "ZIP_UNSAFE_PATH");
  assert.equal(code(() => extractBuild(zipSync({ "index.html": html, "a/../../evil.js": js }))), "ZIP_UNSAFE_PATH");
});

test("đuôi file không cho phép bị chặn", () => {
  assert.equal(code(() => extractBuild(zipSync({ "index.html": html, "run.exe": js }))), "ZIP_FILE_TYPE_NOT_ALLOWED");
  assert.equal(code(() => extractBuild(zipSync({ "index.html": html, "api.php": js }))), "ZIP_FILE_TYPE_NOT_ALLOWED");
});

test("file không phải zip / zip rỗng", () => {
  assert.equal(code(() => extractBuild(strToU8("not a zip at all"))), "ZIP_INVALID");
  assert.equal(code(() => extractBuild(zipSync({ "folder/": new Uint8Array(0) }))), "ZIP_EMPTY");
});

test("zip bomb: tổng dung lượng giải nén vượt giới hạn", () => {
  // 160MB số 0 nén lại còn rất nhỏ
  const big = new Uint8Array(160 * 1024 * 1024);
  const zip = zipSync({ "index.html": html, "bomb.bin": big }, { level: 9 });
  assert.ok(zip.byteLength < 1024 * 1024, "zip phải nhỏ hơn 1MB");
  assert.equal(code(() => extractBuild(zip)), "ZIP_TOO_LARGE_UNZIPPED");
});

test("Unity nén sẵn .br / .gz: giải nén, giữ tên file, Content-Type theo file bên trong", async () => {
  const { brotliCompressSync, gzipSync } = await import("node:zlib");
  const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const zip = zipSync({
    "index.html": html,
    "Build/game.framework.js.br": new Uint8Array(brotliCompressSync(js)),
    "Build/game.wasm.gz": new Uint8Array(gzipSync(wasm)),
  });
  const out = extractBuild(zip);
  const fw = out.files.find((f) => f.path === "Build/game.framework.js.br");
  const wa = out.files.find((f) => f.path === "Build/game.wasm.gz");
  assert.deepEqual(Array.from(fw!.data), Array.from(js));
  assert.equal(fw!.contentType, "text/javascript; charset=utf-8");
  assert.deepEqual(Array.from(wa!.data), Array.from(wasm));
  assert.equal(wa!.contentType, "application/wasm");
  assert.equal(out.totalBytes, html.length + js.length + wasm.length);
});

test("file .br hỏng / đuôi lạ bên trong / nén 2 lớp bị từ chối", () => {
  assert.equal(code(() => extractBuild(zipSync({ "index.html": html, "a.js.br": new Uint8Array([1, 2, 3, 4]) }))), "ZIP_COMPRESSED_INVALID");
  assert.equal(code(() => extractBuild(zipSync({ "index.html": html, "run.exe.gz": new Uint8Array([1]) }))), "ZIP_FILE_TYPE_NOT_ALLOWED");
  assert.equal(code(() => extractBuild(zipSync({ "index.html": html, "a.js.gz.br": new Uint8Array([1]) }))), "ZIP_FILE_TYPE_NOT_ALLOWED");
});

test("bomb nén: .gz giải ra vượt 150MB bị chặn", async () => {
  const { gzipSync } = await import("node:zlib");
  const bomb = new Uint8Array(gzipSync(new Uint8Array(151 * 1024 * 1024)));
  assert.equal(code(() => extractBuild(zipSync({ "index.html": html, "big.data.gz": bomb }))), "ZIP_TOO_LARGE_UNZIPPED");
});
