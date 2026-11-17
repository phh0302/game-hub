"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { TrafficDashboard } from "./TrafficDashboard";

/** Trang stats chỉ dành cho admin: chưa đăng nhập → nút kết nối ví ngay trên trang; không phải admin → báo không có quyền */
export function StatsGate() {
  const t = useTranslations("trafficStats");
  const { user, status, login } = useAuth();

  if (user?.role === "ADMIN") return <TrafficDashboard />;

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-line bg-surface px-6 py-8 text-center" data-testid="stats-gate">
      <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted">{user ? t("gate.forbidden") : t("gate.login")}</p>
      {!user && (
        <button
          onClick={() => void login()}
          disabled={status !== "idle"}
          className="mt-5 rounded-xl bg-neon px-5 py-2.5 text-sm font-bold text-bg disabled:opacity-60"
        >
          {t("gate.connect")}
        </button>
      )}
    </section>
  );
}
