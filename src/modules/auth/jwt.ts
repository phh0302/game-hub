import { SignJWT, jwtVerify } from "jose";

// File này dùng được cả ở middleware (edge) lẫn server, nên không import Prisma / env.ts

export const SESSION_COOKIE = "gh_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

export type SessionPayload = {
  sub: string; // userId
  role: "USER" | "ADMIN";
  /** Id phiên trong bảng AuthSession (claim jti) – server kiểm tra phiên còn hiệu lực */
  sid?: string;
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET chưa được cấu hình (tối thiểu 32 ký tự)");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  const jwt = new SignJWT({ role: payload.role }).setProtectedHeader({ alg: "HS256" }).setSubject(payload.sub);
  if (payload.sid) jwt.setJti(payload.sid);
  return jwt
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    // Token người chơi của Client API (có audience) KHÔNG dùng được làm phiên đăng nhập hub
    if (payload.aud !== undefined) return null;
    return {
      sub: payload.sub,
      role: payload.role === "ADMIN" ? "ADMIN" : "USER",
      sid: typeof payload.jti === "string" ? payload.jti : undefined,
    };
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

// ───────────── Token người chơi của Client API (/api/p1) ─────────────

/** Audience riêng → token này không bao giờ được chấp nhận làm cookie phiên của hub và ngược lại */
export const PLAYER_TOKEN_AUDIENCE = "gamehub-p1";
export const PLAYER_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

export type PlayerTokenPayload = {
  sub: string; // userId
  sid: string; // id AuthSession
  gid: string; // id game (project) – token chỉ dùng được cho đúng game này
};

export async function signPlayerToken(payload: PlayerTokenPayload) {
  return new SignJWT({ gid: payload.gid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(payload.sid)
    .setAudience(PLAYER_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${PLAYER_TOKEN_MAX_AGE}s`)
    .sign(secret());
}

export async function verifyPlayerToken(token: string | undefined | null): Promise<PlayerTokenPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], audience: PLAYER_TOKEN_AUDIENCE });
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string" || typeof payload.gid !== "string") return null;
    return { sub: payload.sub, sid: payload.jti, gid: payload.gid };
  } catch {
    return null;
  }
}
