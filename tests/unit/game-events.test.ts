import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEvents } from "../../src/lib/game-events.ts";

test("normalizeEvents: giữ sự kiện hợp lệ, lọc props", () => {
  const out = normalizeEvents([
    { name: "ad_rewarded" },
    { name: "level_complete", props: { level: 3, mode: "normal", kid: false, bad: { x: 1 }, nan: NaN, "có dấu": 1 } },
    { name: "x".repeat(65) },
    { name: "has space" },
    { name: "revive_offer_shown", props: { note: "a".repeat(300) } },
    null,
    "str",
  ]);
  assert.deepEqual(out, [
    { name: "ad_rewarded" },
    { name: "level_complete", props: { level: 3, mode: "normal", kid: false } },
    { name: "revive_offer_shown", props: { note: "a".repeat(100) } },
  ]);
});

test("normalizeEvents: tối đa 50 sự kiện / lô, tối đa 10 props", () => {
  assert.equal(normalizeEvents(Array.from({ length: 80 }, () => ({ name: "e" }))).length, 50);
  const props = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`k${i}`, i]));
  assert.equal(Object.keys(normalizeEvents([{ name: "e", props }])[0]!.props!).length, 10);
  assert.deepEqual(normalizeEvents("nope"), []);
});
