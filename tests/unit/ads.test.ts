import { test } from "node:test";
import assert from "node:assert/strict";
import { adEventName, adStatusOf, adsTxtLine, outcomeFromStatus, parseAdsConfig } from "../../src/lib/ads/config.ts";
import { normalizeEvents } from "../../src/lib/game-events.ts";

test("parseAdsConfig: chỉ bật khi mã AdSense đúng định dạng", () => {
  assert.equal(parseAdsConfig({}), null);
  assert.equal(parseAdsConfig({ client: "pub-1234567890123456" }), null);
  assert.equal(parseAdsConfig({ client: "ca-pub-12<script>" }), null);
  assert.deepEqual(parseAdsConfig({ client: " ca-pub-1234567890123456 " }), {
    client: "ca-pub-1234567890123456",
    test: false,
    frequency: "120s",
  });
  assert.equal(parseAdsConfig({ client: "ca-pub-1234567890123456", test: "1" })?.test, true);
  assert.equal(parseAdsConfig({ client: "ca-pub-1234567890123456", frequency: "60s" })?.frequency, "60s");
  assert.equal(parseAdsConfig({ client: "ca-pub-1234567890123456", frequency: "abc" })?.frequency, "120s");
});

test("ads.txt dùng pub-… (bỏ ca-)", () => {
  assert.equal(adsTxtLine("ca-pub-1234567890123456"), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0");
});

test("outcomeFromStatus: chỉ thưởng khi xem hết quảng cáo thưởng", () => {
  assert.deepEqual(outcomeFromStatus("rewarded", "viewed", true), { shown: true, rewarded: true });
  assert.deepEqual(outcomeFromStatus("rewarded", "viewed", false), { shown: true, rewarded: false });
  assert.deepEqual(outcomeFromStatus("interstitial", "viewed", true), { shown: true, rewarded: false });
  assert.equal(outcomeFromStatus("rewarded", "dismissed", false).reason, "SKIPPED");
  assert.equal(outcomeFromStatus("rewarded", "dismissed", false).rewarded, false);
  assert.equal(outcomeFromStatus("interstitial", "frequencyCapped", false).reason, "FREQUENCY_CAPPED");
  assert.equal(outcomeFromStatus("rewarded", "noAdPreloaded", false).reason, "NO_FILL");
  assert.equal(outcomeFromStatus("rewarded", "timeout", false).reason, "TIMEOUT");
  assert.equal(outcomeFromStatus("rewarded", undefined, false).shown, false);
});

test("đếm lượt quảng cáo theo trạng thái", () => {
  assert.equal(adStatusOf({ shown: true, rewarded: true }), "viewed");
  assert.equal(adStatusOf({ shown: true, rewarded: false, reason: "SKIPPED" }), "dismissed");
  assert.equal(adStatusOf({ shown: false, rewarded: false, reason: "NO_FILL" }), "nofill");
  assert.equal(adStatusOf({ shown: false, rewarded: false, reason: "BLOCKED" }), "error");
  assert.equal(adEventName("rewarded", "viewed"), "hub.ad.rewarded.viewed");
});

test("game không tự gửi được sự kiện tiền tố hub.", () => {
  const out = normalizeEvents([{ name: "hub.ad.rewarded.viewed" }, { name: "HUB.x" }, { name: "ad_rewarded" }]);
  assert.deepEqual(out.map((e) => e.name), ["ad_rewarded"]);
});
