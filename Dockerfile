# Game Hub – image chạy production (Next.js standalone). Xem docs/SELF_HOST.md
# Targets:
#   runner  (mặc định) – server Next.js, cổng 3000
#   migrate – chạy 1 lần mỗi lần cập nhật: prisma migrate deploy + seed

# ── 1. Cài thư viện ──────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Giống CI/Vercel: npm install (lock tạo trên Windows đôi khi lệch vài gói phụ với Linux)
RUN npm install --no-audit --no-fund

# ── 2. Build ─────────────────────────────────────────────────
FROM deps AS build
COPY . .
# Biến NEXT_PUBLIC_* được gắn cứng vào JS phía trình duyệt lúc build → truyền qua build args
ARG NEXT_PUBLIC_APP_URL=https://play.monlabs.fun
ARG NEXT_PUBLIC_ASSET_BASE_URL=
ARG NEXT_PUBLIC_GAME_BASE_URL=
ARG NEXT_PUBLIC_UPLOAD_BASE_URL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_ASSET_BASE_URL=$NEXT_PUBLIC_ASSET_BASE_URL \
    NEXT_PUBLIC_GAME_BASE_URL=$NEXT_PUBLIC_GAME_BASE_URL \
    NEXT_PUBLIC_UPLOAD_BASE_URL=$NEXT_PUBLIC_UPLOAD_BASE_URL \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    # Giá trị giả chỉ để build (không kết nối database lúc build) – không có trong image chạy
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    JWT_SECRET=build-only-secret-0123456789abcdef0123456789
RUN npx prisma generate && npm run build

# ── 3. Migrate (chạy 1 lần rồi thoát) ────────────────────────
FROM deps AS migrate
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ── 4. Runner ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/* \
  && groupadd -r app && useradd -r -g app -d /app app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Thư mục file developer upload khi dùng STORAGE_DRIVER=local (gắn volume, nginx phục vụ trực tiếp)
RUN mkdir -p /app/public/uploads/u && chown -R app:app /app/public/uploads/u
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null || exit 1
CMD ["node", "server.js"]
