import { test } from "node:test";
import assert from "node:assert/strict";
import { RETENTION, retentionCutoffs } from "../../src/modules/maintenance/retention.ts";

test("retentionCutoffs: các mốc tính lùi từ hôm nay", () => {
  const now = new Date("2026-11-16T03:17:00Z");
  const c = retentionCutoffs(now);
  const days = (d: Date) => Math.round((now.getTime() - d.getTime()) / 86_400_000);
  assert.equal(days(c.guests), RETENTION.guestInactiveDays);
  assert.equal(days(c.events), RETENTION.eventsDays);
  assert.equal(days(c.reports), RETENTION.resolvedReportsDays);
  assert.equal(days(c.webhookDeliveries), RETENTION.webhookDeliveriesDays);
  assert.equal(days(c.rooms), RETENTION.finishedRoomsDays);
});

test("retentionCutoffs: giữ đủ 13 tháng người chơi theo tháng (tính cả tháng hiện tại)", () => {
  assert.equal(retentionCutoffs(new Date("2026-11-16T00:00:00Z")).monthlyPlayers.toISOString(), "2025-11-01T00:00:00.000Z");
  assert.equal(retentionCutoffs(new Date("2026-01-31T23:00:00Z")).monthlyPlayers.toISOString(), "2025-01-01T00:00:00.000Z");
});
