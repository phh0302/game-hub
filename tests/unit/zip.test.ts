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
