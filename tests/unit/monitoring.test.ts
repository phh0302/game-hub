import { test } from "node:test";
import assert from "node:assert/strict";
import { reportError } from "../../src/lib/monitoring.ts";

test("gửi lỗi lên Sentry đúng endpoint, ẩn trường nhạy cảm, bỏ query string", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  const realError = console.error;
  process.env.SENTRY_DSN = "https://abc123@o1.ingest.sentry.io/42";
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("{}");
  }) as typeof fetch;
  console.error = () => {};
  try {
    await reportError(new Error("boom"), {
      tags: { area: "api" },
      request: { method: "GET", url: "/api/v1/x?token=secret" },
      extra: { cookie: "gh_session=1", gameId: "g1" },
    });
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    delete process.env.SENTRY_DSN;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://o1.ingest.sentry.io/api/42/envelope/");
  assert.match(String((calls[0].init.headers as Record<string, string>)["X-Sentry-Auth"]), /sentry_key=abc123/);
  const [, item, payload] = String(calls[0].init.body).split("\n");
  assert.equal(JSON.parse(item).type, "event");
  const event = JSON.parse(payload);
  assert.equal(event.exception.values[0].value, "boom");
  assert.equal(event.request.url, "/api/v1/x");
  assert.equal(event.extra.cookie, "[đã ẩn]");
  assert.equal(event.extra.gameId, "g1");
  assert.ok(event.exception.values[0].stacktrace.frames.length > 0);
});

test("không có SENTRY_DSN → không gọi mạng", async () => {
  let called = false;
  const realFetch = globalThis.fetch;
  const realError = console.error;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}");
  }) as typeof fetch;
  console.error = () => {};
  try {
    await reportError("lỗi chuỗi");
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
  assert.equal(called, false);
});
