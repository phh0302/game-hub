import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeRefCookie, inviteUrl, isInviteCode, newInviteCode, parseRefCookie } from "../../src/modules/referrals/codes.ts";

test("mã mời: 8 ký tự dễ đọc, kiểm tra định dạng", () => {
  const code = newInviteCode();
  assert.match(code, /^[a-z2-9]{8}$/);
  assert.ok(isInviteCode(code));
  for (const bad of ["", "abc", "ABCDEFGH", "abcd efg", "a".repeat(13), "x;drop", null, 42]) assert.equal(isInviteCode(bad), false);
});

test("cookie mời: mã + slug game, sai định dạng → null", () => {
  assert.equal(encodeRefCookie("abcd2345", "flying-miso"), "abcd2345.flying-miso");
  assert.equal(encodeRefCookie("abcd2345", "Bad Slug!"), "abcd2345");
  assert.deepEqual(parseRefCookie("abcd2345.flying-miso"), { code: "abcd2345", slug: "flying-miso" });
  assert.deepEqual(parseRefCookie("abcd2345"), { code: "abcd2345", slug: null });
  assert.equal(parseRefCookie("<script>.x"), null);
  assert.equal(parseRefCookie(undefined), null);
});

test("link mời: trang game + ref, có điểm thì thêm score", () => {
  assert.equal(inviteUrl("https://play.monlabs.fun", { slug: "snake", code: "abcd2345" }), "https://play.monlabs.fun/games/snake?ref=abcd2345");
  assert.equal(
    inviteUrl("https://play.monlabs.fun", { slug: "snake", code: "abcd2345", score: 99.9 }),
    "https://play.monlabs.fun/games/snake?score=99&ref=abcd2345",
  );
  assert.equal(inviteUrl("https://play.monlabs.fun", { slug: "snake", code: null }), "https://play.monlabs.fun/games/snake");
  assert.equal(inviteUrl("https://play.monlabs.fun", {}), "https://play.monlabs.fun/");
});
