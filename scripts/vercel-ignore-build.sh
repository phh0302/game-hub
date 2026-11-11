#!/usr/bin/env bash
# "Ignored Build Step" của Vercel (khai báo trong vercel.json ở gốc repo).
# Dùng chung cho mọi project Vercel nối repo này: game-hub (thư mục gốc),
# monlabs (sites/monlabs), monlabs-docs (sites/docs). Vercel chạy lệnh trong Root Directory của project.
# exit 0 = BỎ QUA build · exit 1 = build
#
# 1. Không build bản Preview: Preview của Game Hub dùng chung database/Redis với bản chính
#    (build sẽ chạy migrate + seed lên database thật) và đăng nhập ví không chạy trên link Preview.
#    Pull request đã được GitHub CI kiểm tra (build, test, Playwright, migration, docs).
# 2. Bản chính chỉ build khi commit có sửa phần thuộc project đó.

if [ "$VERCEL_ENV" != "production" ]; then
  echo "Bỏ qua build Preview (VERCEL_ENV=$VERCEL_ENV) – pull request được kiểm tra bằng GitHub CI"
  exit 0
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$ROOT" ] || ! git rev-parse --verify --quiet HEAD^ >/dev/null; then
  echo "Không so được với commit trước – build"
  exit 1
fi

if [ "$PWD" = "$ROOT" ]; then
  # Game Hub: bỏ qua nếu commit chỉ sửa sites/ (landing page, trang docs)
  if git diff --quiet HEAD^ HEAD -- . ':(exclude)sites'; then
    echo "Commit chỉ sửa sites/ – Game Hub không cần build lại"
    exit 0
  fi
else
  # Trang trong sites/<tên>: chỉ build khi thư mục đó thay đổi
  if git diff --quiet HEAD^ HEAD -- .; then
    echo "Commit không sửa ${PWD#"$ROOT"/} – bỏ qua build"
    exit 0
  fi
fi

echo "Build (production)"
exit 1
