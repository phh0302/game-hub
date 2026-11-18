#!/bin/sh
# Tải lại danh sách IP Cloudflare → conf.d/cloudflare-ips.inc, rồi build lại image nginx.
set -e
OUT="$(dirname "$0")/conf.d/cloudflare-ips.inc"
{
  echo "# Dải IP của Cloudflare (https://www.cloudflare.com/ips/) – cập nhật: deploy/nginx/update-cloudflare-ips.sh"
  for f in ips-v4 ips-v6; do
    curl -fsS "https://www.cloudflare.com/$f" | sed '/^$/d; s/.*/set_real_ip_from &;/'
  done
} > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
echo "Đã cập nhật $OUT"
