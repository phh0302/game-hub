#!/usr/bin/env bash
# "Ignored Build Step" của Vercel cho project game-hub (khai báo trong vercel.json).
# exit 0 = BỎ QUA build · exit 1 = build
#
# 1. Không build bản Preview: Preview dùng chung database/Redis với bản chính nên build sẽ chạy
#    migrate + seed lên database thật, và đăng nhập ví cũng không chạy trên link Preview.
#    Kiểm tra từng pull request đã có GitHub CI (build, test, Playwright, migration).
# 2. Bản chính: bỏ qua nếu commit chỉ sửa sites/ (landing page, trang docs – project Vercel riêng).

if [ "$VERCEL_ENV" != "production" ]; then
  echo "Bỏ qua build Preview (VERCEL_ENV=$VERCEL_ENV) – pull request được kiểm tra bằng GitHub CI"
  exit 0
fi

if git rev-parse --verify --quiet HEAD^ >/dev/null && git diff --quiet HEAD^ HEAD -- . ':(exclude)sites'; then
  echo "Commit chỉ sửa sites/ – Game Hub không cần build lại"
  exit 0
fi

echo "Build Game Hub (production)"
exit 1
