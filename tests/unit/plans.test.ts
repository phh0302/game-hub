import { test } from "node:test";
import assert from "node:assert/strict";
import { effectivePlan, monthStart, PLANS, warnLevel } from "../../src/modules/platform/plans.ts";

test("effectivePlan: gói còn hạn dùng hạn mức của gói + hạn mức riêng", () => {
  const p = effectivePlan({ plan: "PRO", planExpiresAt: null, planLimits: { scores: 42, serverApi: false, junk: 1 } });
  assert.equal(p.tier, "PRO");
  assert.equal(p.limits.scores, 42);
  assert.equal(p.limits.serverApi, false);
  assert.equal(p.limits.activePlayers, PLANS.PRO.activePlayers);
});

test("effectivePlan: hết hạn → FREE, bỏ hạn mức riêng", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  const p = effectivePlan({ plan: "BUSINESS", planExpiresAt: "2026-11-30T00:00:00Z", planLimits: { scores: 1 } }, now);
  assert.equal(p.tier, "FREE");
  assert.equal(p.expired, true);
  assert.equal(p.limits.scores, PLANS.FREE.scores);
  assert.equal(p.limits.serverApi, false);
});

test("effectivePlan: null trong hạn mức riêng = không giới hạn; giá trị sai bị bỏ qua", () => {
  const p = effectivePlan({ plan: "FREE", planExpiresAt: null, planLimits: { projects: null, scores: -5, activePlayers: 1.5 } });
  assert.equal(p.limits.projects, null);
  assert.equal(p.limits.scores, PLANS.FREE.scores);
  assert.equal(p.limits.activePlayers, PLANS.FREE.activePlayers);
});

test("warnLevel", () => {
  assert.equal(warnLevel(79, 100), null);
  assert.equal(warnLevel(80, 100), 80);
  assert.equal(warnLevel(100, 100), 100);
  assert.equal(warnLevel(5, 0), 100);
  assert.equal(warnLevel(1_000_000, null), null);
});

test("monthStart", () => {
  assert.equal(monthStart(new Date("2026-11-16T23:59:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
});
