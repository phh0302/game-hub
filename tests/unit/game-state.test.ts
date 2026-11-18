import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
};
const { handleStateMessage, STATE_MAX_BYTES } = await import("../../src/lib/game-state.ts");

test("lưu rồi đọc tiến trình theo từng game", () => {
  assert.deepEqual(handleStateMessage("STATE_LOAD", { requestId: "a" }, "snake"), { requestId: "a", data: null });
  assert.deepEqual(handleStateMessage("STATE_SAVE", { requestId: "b", data: '{"level":3}' }, "snake"), {
    requestId: "b",
    saved: true,
    code: null,
  });
  assert.deepEqual(handleStateMessage("STATE_LOAD", { requestId: "c" }, "snake"), { requestId: "c", data: '{"level":3}' });
  // Game khác không đọc được
  assert.equal(handleStateMessage("STATE_LOAD", { requestId: "d" }, "2048")?.data, null);
});

test("từ chối dữ liệu sai kiểu / quá lớn; bỏ qua tin không liên quan", () => {
  assert.equal(handleStateMessage("STATE_SAVE", { requestId: "e", data: { x: 1 } }, "g")?.code, "STATE_INVALID");
  assert.equal(handleStateMessage("STATE_SAVE", { requestId: "f", data: "x".repeat(STATE_MAX_BYTES + 1) }, "g")?.code, "STATE_TOO_LARGE");
  assert.equal(handleStateMessage("GAME_OVER", {}, "g"), null);
});

test("localStorage của hub lỗi → báo STORAGE_UNAVAILABLE, đọc trả null", () => {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    },
  };
  assert.equal(handleStateMessage("STATE_SAVE", { requestId: "h", data: "1" }, "g")?.code, "STORAGE_UNAVAILABLE");
  assert.equal(handleStateMessage("STATE_LOAD", { requestId: "i" }, "g")?.data, null);
});
