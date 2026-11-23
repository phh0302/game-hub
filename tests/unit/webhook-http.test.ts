import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { postWebhook, PrivateAddressError, safeLookup } from "../../src/modules/platform/webhook-http.ts";

function lookupWith(addresses: { address: string; family: number }[], options: object = {}) {
  const fn = safeLookup((_h, cb) => cb(null, addresses));
  return new Promise<{ err: Error | null; address: unknown; family?: number }>((resolve) =>
    fn("hook.example.com", options as never, (err, address, family) => resolve({ err, address, family })),
  );
}

test("safeLookup chặn mọi địa chỉ nội bộ (kể cả khi lẫn với IP công khai)", async () => {
  for (const list of [
    [{ address: "127.0.0.1", family: 4 }],
    [{ address: "10.0.0.5", family: 4 }],
    [{ address: "169.254.169.254", family: 4 }],
    [{ address: "::1", family: 6 }],
    [{ address: "93.184.216.34", family: 4 }, { address: "192.168.1.1", family: 4 }],
  ]) {
    const r = await lookupWith(list);
    assert.ok(r.err instanceof PrivateAddressError, JSON.stringify(list));
  }
});

test("safeLookup trả địa chỉ công khai (1 địa chỉ hoặc all)", async () => {
  const one = await lookupWith([{ address: "93.184.216.34", family: 4 }]);
  assert.equal(one.err, null);
  assert.equal(one.address, "93.184.216.34");
  assert.equal(one.family, 4);
  const all = await lookupWith([{ address: "93.184.216.34", family: 4 }], { all: true });
  assert.deepEqual(all.address, [{ address: "93.184.216.34", family: 4 }]);
});

test("postWebhook: IP nội bộ viết thẳng / tên miền trỏ vào nội bộ → từ chối; cho phép khi allowPrivate", async () => {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    req.resume();
    res.writeHead(204).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  try {
    await assert.rejects(postWebhook(new URL(`http://127.0.0.1:${port}/hook`), {}, "{}", { timeoutMs: 2000 }), PrivateAddressError);
    // DNS rebinding: tên miền "công khai" nhưng phân giải ra 127.0.0.1 lúc kết nối
    await assert.rejects(
      postWebhook(new URL(`http://rebind.example.com:${port}/hook`), {}, "{}", {
        timeoutMs: 2000,
        resolver: (_h, cb) => cb(null, [{ address: "127.0.0.1", family: 4 }]),
      }),
      PrivateAddressError,
    );
    assert.equal(hits, 0);
    const ok = await postWebhook(new URL(`http://127.0.0.1:${port}/hook`), { "content-type": "application/json" }, "{}", {
      timeoutMs: 2000,
      allowPrivate: true,
    });
    assert.equal(ok.status, 204);
    assert.equal(hits, 1);
  } finally {
    server.close();
  }
});

test("postWebhook: chỉ http/https", async () => {
  await assert.rejects(postWebhook(new URL("ftp://example.com/x"), {}, "{}", { timeoutMs: 1000 }));
});
