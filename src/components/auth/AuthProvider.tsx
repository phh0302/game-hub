"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { stringToHex } from "viem";

/** Khớp với PublicUser ở server (src/modules/users/dto.ts) */
export type AuthUser = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  isGuest: boolean;
  walletAddress: string | null;
};

const API = "/api/v1";

/** Mã lỗi đăng nhập – dịch trong messages/*.json mục auth.errors */
export type AuthErrorCode =
  | "NO_WALLET"
  | "USER_REJECTED"
  | "REQUEST_PENDING"
  | "NONCE_INVALID"
  | "INVALID_SIGNATURE"
  | "INVALID_MESSAGE"
  | "RATE_LIMITED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_DISABLED"
  | "UNKNOWN";

type AuthStatus = "idle" | "connecting" | "signing";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  error: AuthErrorCode | null;
  login: () => Promise<void>;
  /** allDevices: thu hồi mọi phiên đăng nhập của tài khoản (đăng xuất mọi thiết bị) */
  logout: (opts?: { allDevices?: boolean }) => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const KNOWN_API_ERRORS: AuthErrorCode[] = [
  "NONCE_INVALID",
  "INVALID_SIGNATURE",
  "INVALID_MESSAGE",
  "RATE_LIMITED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_DISABLED",
];

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.code as AuthErrorCode | undefined;
    throw new AuthFlowError(code && KNOWN_API_ERRORS.includes(code) ? code : "UNKNOWN");
  }
  return data as T;
}

class AuthFlowError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code);
  }
}

/** Chuyển lỗi từ MetaMask (EIP-1193) sang mã lỗi của app */
function toErrorCode(err: unknown): AuthErrorCode {
  if (err instanceof AuthFlowError) return err.code;
  const code = (err as { code?: number })?.code;
  if (code === 4001) return "USER_REJECTED"; // user bấm Từ chối
  if (code === -32002) return "REQUEST_PENDING"; // đang có popup MetaMask chờ xử lý
  return "UNKNOWN";
}

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: AuthUser | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<AuthErrorCode | null>(null);

  const logout = useCallback(async (opts?: { allDevices?: boolean }) => {
    const all = opts?.allDevices === true ? "?all=1" : "";
    await fetch(`${API}/auth/logout${all}`, { method: "POST" }).catch(() => undefined);
    setUser(null);
    router.refresh();
  }, [router]);

  const login = useCallback(async () => {
    setError(null);
    const eth = window.ethereum;
    if (!eth) {
      setError("NO_WALLET");
      return;
    }

    try {
      setStatus("connecting");
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new AuthFlowError("UNKNOWN");

      const chainIdHex = (await eth.request({ method: "eth_chainId" })) as string;
      const chainId = Number.parseInt(chainIdHex, 16) || 1;

      // 1. Lấy thông điệp SIWE từ server
      const { message } = await postJson<{ message: string }>(`${API}/auth/nonce`, { address, chainId });

      // 2. Ký thông điệp bằng MetaMask (miễn phí, không tốn gas)
      setStatus("signing");
      const signature = (await eth.request({
        method: "personal_sign",
        params: [stringToHex(message), address],
      })) as string;

      // 3. Server xác minh chữ ký → set cookie phiên
      const { user: loggedIn } = await postJson<{ user: AuthUser }>(`${API}/auth/verify`, { message, signature });
      setUser(loggedIn);
      router.refresh();
    } catch (err) {
      setError(toErrorCode(err));
    } finally {
      setStatus("idle");
    }
  }, [router]);

  // Đổi ví trong MetaMask khi đang đăng nhập → đăng xuất để tránh dùng nhầm tài khoản
  useEffect(() => {
    const eth = window.ethereum;
    const wallet = user?.walletAddress;
    if (!eth || !wallet) return;

    const onAccountsChanged = (accounts: string[]) => {
      if (accounts[0]?.toLowerCase() !== wallet) void logout();
    };
    eth.on("accountsChanged", onAccountsChanged);
    return () => eth.removeListener("accountsChanged", onAccountsChanged);
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, error, login, logout, setUser, clearError: () => setError(null) }),
    [user, status, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong <AuthProvider>");
  return ctx;
}
