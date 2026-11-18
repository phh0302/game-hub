#!/bin/sh
# Chưa gắn chứng chỉ Cloudflare Origin (deploy/certs/origin.pem + origin.key) → tạo chứng chỉ tự ký
# để nginx vẫn chạy được (máy local / CI). Production: tạo Origin Certificate trên Cloudflare (xem docs/SELF_HOST.md).
set -e
CERT_DIR=/etc/nginx/certs
if [ ! -f "$CERT_DIR/origin.pem" ] || [ ! -f "$CERT_DIR/origin.key" ]; then
  echo "[nginx] Không thấy chứng chỉ origin → tạo chứng chỉ tự ký (chỉ dùng thử)"
  mkdir -p /tmp/certs
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 -subj "/CN=localhost" \
    -keyout /tmp/certs/origin.key -out /tmp/certs/origin.pem >/dev/null 2>&1
  sed -i "s#$CERT_DIR/origin#/tmp/certs/origin#g" /etc/nginx/conf.d/*.conf
fi
