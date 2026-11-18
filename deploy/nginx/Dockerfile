# nginx đứng trước app: HTTPS, giới hạn request theo IP, gzip, phục vụ monlabs.fun + docs (file tĩnh)
# Build từ thư mục gốc repo: docker build -f deploy/nginx/Dockerfile .

FROM node:22-bookworm-slim AS docs
WORKDIR /docs
COPY sites/docs/package.json ./
RUN npm install --no-audit --no-fund
COPY sites/docs ./
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/nginx/conf.d/ /etc/nginx/conf.d/
COPY deploy/nginx/templates/ /etc/nginx/templates/
COPY deploy/nginx/self-signed.sh /docker-entrypoint.d/30-self-signed.sh
COPY sites/monlabs /srv/landing
COPY --from=docs /docs/.vitepress/dist /srv/docs
RUN chmod +x /docker-entrypoint.d/30-self-signed.sh && rm -f /etc/nginx/conf.d/default.conf
# Chỉ thay biến của mình (không đụng $host, $remote_addr… của nginx)
ENV NGINX_ENVSUBST_FILTER="^(HUB_HOST|STATS_HOST|LANDING_HOST|DOCS_HOST)$" \
    HUB_HOST=play.monlabs.fun \
    STATS_HOST=stats.monlabs.fun \
    LANDING_HOST=monlabs.fun \
    DOCS_HOST=docs.monlabs.fun
