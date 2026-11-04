import { SignJWT, jwtVerify } from "jose";

// File này dùng được cả ở middleware (edge) lẫn API route, nên không import env.ts

export const SESSION_COOKIE = "gh_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

export type SessionPayload = {
  sub: string; // userId
  wallet: string;
  role: "USER" | "ADMIN";
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET chưa được cấu hình (tối thiểu 32 ký tự)");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ wallet: payload.wallet, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.wallet !== "string") return null;
    const role = payload.role === "ADMIN" ? "ADMIN" : "USER";
    return { sub: payload.sub, wallet: payload.wallet, role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
