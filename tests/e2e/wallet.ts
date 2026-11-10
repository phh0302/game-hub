import type { Page } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

/**
 * Ví giả lập MetaMask cho test. Khóa riêng là khóa MẪU công khai của Hardhat/Anvil –
 * KHÔNG BAO GIỜ dùng cho tiền thật.
 */
export const WALLETS = {
  admin: privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"),
  player: privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"),
};

/** Gắn window.ethereum giả vào trang: trả về địa chỉ ví, ký thông điệp SIWE bằng khóa test */
export async function installWallet(page: Page, wallet: keyof typeof WALLETS) {
  const account = WALLETS[wallet];
  await page.exposeFunction("__e2eSign", (hex: string) => account.signMessage({ message: { raw: hex as Hex } }));
  await page.addInitScript((address: string) => {
    const w = window as unknown as { ethereum: unknown; __e2eSign: (hex: string) => Promise<string> };
    w.ethereum = {
      isMetaMask: true,
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
        if (method === "eth_chainId") return "0x1";
        if (method === "personal_sign") return w.__e2eSign(String(params?.[0]));
        throw Object.assign(new Error(`Unsupported ${method}`), { code: 4200 });
      },
      on: () => undefined,
      removeListener: () => undefined,
    };
  }, account.address);
}

/** Bấm "Kết nối ví" ở thanh trên cùng và chờ đăng nhập xong (nút menu tài khoản xuất hiện) */
export async function login(page: Page, wallet: keyof typeof WALLETS) {
  void wallet; // ví đã gắn bằng installWallet – tham số giữ cho dễ đọc ở test
  const verified = page.waitForResponse((r) => r.url().endsWith("/api/v1/auth/verify") && r.ok());
  await page.locator("header").getByRole("button", { name: "Kết nối ví" }).click();
  await verified;
  await page.locator("header button[aria-expanded]").waitFor();
}
