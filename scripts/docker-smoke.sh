#!/usr/bin/env bash
# Kiểm tra nhanh cả cụm Docker (app + nginx + redis + cron + postgres) sau khi `docker compose up`.
# Dùng trong CI và trên VPS: bash scripts/docker-smoke.sh   (BASE_IP=ip-của-VPS nếu chạy từ máy khác)
# Không dùng pipefail: grep -q thoát sớm làm curl nhận SIGPIPE với trang lớn → báo lỗi giả
set -u
IP="${BASE_IP:-127.0.0.1}"
HUB="${HUB_HOST:-play.monlabs.fun}"; STATS="${STATS_HOST:-stats.monlabs.fun}"
LANDING="${LANDING_HOST:-monlabs.fun}"; DOCS="${DOCS_HOST:-docs.monlabs.fun}"
fail=0
c() { curl -sk --max-time 15 --resolve "$1:443:$IP" --resolve "$1:80:$IP" "${@:2}"; }
check() { # tên, điều kiện (lệnh trả 0 = đạt)
  if eval "$2"; then echo "✓ $1"; else echo "✗ $1"; fail=1; fi
}

echo "Chờ hub sẵn sàng…"
for i in $(seq 1 60); do
  c "$HUB" "https://$HUB/api/v1/health" | grep -q '"status":"ok"' && break
  sleep 3
done

health=$(c "$HUB" "https://$HUB/api/v1/health")
echo "health: $health"
check "Hub /api/v1/health: database ok" '[[ "$health" == *"\"db\":\"ok\""* ]]'
check "Rate limit dùng Redis (srh)" '[[ "$health" == *"\"rateLimit\":\"redis\""* ]]'
check "Trang chủ hub 200" '[[ $(c "$HUB" -o /dev/null -w "%{http_code}" "https://$HUB/") == 200 ]]'
check "Danh sách game có 2048 (seed đã chạy)" 'c "$HUB" "https://$HUB/api/v1/games" | grep -q "\"slug\":\"2048\""'
check "Game chính thức chạy trong sandbox" 'c "$HUB" -D - -o /dev/null "https://$HUB/uploads/games/2048/1.0.0/index.html" | grep -qi "content-security-policy: sandbox"'
check "_next/static cache lâu (immutable)" '
  js=$(c "$HUB" "https://$HUB/" | grep -o "/_next/static/[^\"]*\.js" | head -1);
  [[ -n "$js" ]] && c "$HUB" -D - -o /dev/null "https://$HUB$js" | grep -qi "immutable"'
check "Nén gzip" 'c "$HUB" -H "Accept-Encoding: gzip" -D - -o /dev/null "https://$HUB/" | grep -qi "content-encoding: gzip"'
check "stats.* → trang theo dõi (chỉ admin)" 'c "$STATS" "https://$STATS/" | grep -q "stats-gate"'
check "monlabs.fun (trang tĩnh)" 'c "$LANDING" "https://$LANDING/" | grep -qi "monlabs"'
check "Trang status" '[[ $(c "$LANDING" -o /dev/null -w "%{http_code}" "https://$LANDING/status/") == 200 ]]'
check "docs (VitePress, URL gọn /sdk)" '[[ $(c "$DOCS" -o /dev/null -w "%{http_code}" "https://$DOCS/sdk") == 200 ]]'
check "HTTP → HTTPS 301" '[[ $(c "$HUB" -o /dev/null -w "%{http_code}" "http://$HUB/") == 301 ]]'
check "Tên miền lạ bị đóng kết nối" '! curl -sk --max-time 5 --resolve "evil.example:443:$IP" "https://evil.example/" >/dev/null'
check "Body > 1MB bị nginx chặn (413)" '[[ $(head -c 1200000 /dev/zero | c "$HUB" -o /dev/null -w "%{http_code}" -X POST --data-binary @- "https://$HUB/api/v1/auth/nonce") == 413 ]]'

# Cuối cùng (IP máy test sẽ bị chặn tạm): dồn 300 request → nginx/app trả 429
codes=$(seq 1 300 | xargs -P 60 -I{} curl -sk --max-time 10 --resolve "$HUB:443:$IP" -o /dev/null -w "%{http_code}\n" "https://$HUB/api/v1/health" | sort | uniq -c)
echo "$codes"
check "Dồn request → có 429" '[[ "$codes" == *" 429"* ]]'

[[ $fail == 0 ]] && echo "TẤT CẢ ĐẠT" || echo "CÓ MỤC LỖI"
exit $fail
