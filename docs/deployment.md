# Deployment Guide

This project serves both:

- the public image invocation frontend at `/`
- the private admin config frontend at `/?admin=1`

The backend and frontend are served by the same Fastify process after `npm run build`.

## 1. Environment Variables

Required for a normal multi-upstream deployment:

```bash
HOST=0.0.0.0
PORT=3000
UPSTREAM_CONFIG_PATH=config/upstreams.json
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-your-password
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
```

Optional:

```bash
ADMIN_API_TOKEN=replace-with-a-long-random-token
LOG_LEVEL=info
UPSTREAM_REQUEST_TIMEOUT_MS=1800000
```

`UPSTREAM_REQUEST_TIMEOUT_MS` should be long enough for slow image-to-image or edit calls. The deployment templates default to 30 minutes.

Notes:

- `ADMIN_PASSWORD` enables cookie-based admin login for `/?admin=1`.
- `ADMIN_SESSION_SECRET` must be set when using admin login in deployment.
- `ADMIN_API_TOKEN` is optional. If set, private config routes also accept:
  - `Authorization: Bearer <token>`
  - `x-admin-token: <token>`
- `OPENAI_API_KEY` is only required in legacy single-upstream mode when `UPSTREAM_CONFIG_PATH` is not set.
- Ready-to-edit templates are available in:

```text
deploy/
```

## 2. Build And Start

Install dependencies and build:

```bash
npm install
npm run build
```

Start the production server:

```bash
HOST=0.0.0.0 \
PORT=3000 \
UPSTREAM_CONFIG_PATH=config/upstreams.json \
ADMIN_USERNAME=admin \
ADMIN_PASSWORD='your-password' \
ADMIN_SESSION_SECRET='your-long-random-secret' \
npm start
```

Public URL:

```text
http://your-host:3000/
```

Admin URL:

```text
http://your-host:3000/?admin=1
```

## 3. Runtime Behavior

When `UPSTREAM_CONFIG_PATH` is set:

- `GET /v1/public/catalog` is public
- `POST /v1/invocation/run` is public
- `GET /v1/config/upstreams` is admin-only
- `POST /v1/config/upstreams` is admin-only
- `POST /v1/config/upstreams/test-image` is admin-only
- saving config writes to `UPSTREAM_CONFIG_PATH`
- the backend switches to the new config immediately without restart

This means:

- public users can use the gateway frontend and invoke image generation
- public users cannot access upstream secrets or private config routes
- admin users can sign in through `/?admin=1`

## 4. Reverse Proxy

The simplest deployment model is:

- run this app on an internal port such as `3000`
- expose only the reverse proxy publicly
- keep direct backend access restricted at the firewall or host level

### Nginx Example

```nginx
server {
    listen 80;
    server_name image-gateway.example.com;

    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_send_timeout 1800s;
        proxy_read_timeout 1800s;
        send_timeout 1800s;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Caddy Example

```caddy
image-gateway.example.com {
    request_body {
        max_size 30MB
    }

    reverse_proxy 127.0.0.1:3000
}
```

## 5. systemd Example

Example unit file:

```ini
[Unit]
Description=Image Gateway
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/image-gateway
Environment=HOST=0.0.0.0
Environment=PORT=3000
Environment=UPSTREAM_CONFIG_PATH=config/upstreams.json
Environment=ADMIN_USERNAME=admin
Environment=ADMIN_PASSWORD=replace-with-your-password
Environment=ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable image-gateway
sudo systemctl start image-gateway
sudo systemctl status image-gateway
```

Ready-to-edit templates:

```text
deploy/image-gateway.service
deploy/nginx.image-gateway.conf
deploy/env.production.example
deploy/start.sh
```

## 6. Deployment Checklist

- Set `UPSTREAM_CONFIG_PATH`
- Set `ADMIN_PASSWORD`
- Set `ADMIN_SESSION_SECRET`
- Put the upstream JSON file at the configured path
- Run `npm run build`
- Start with `npm start`
- Put Nginx or Caddy in front
- Expose only the reverse proxy publicly
- Use `/?admin=1` for admin access

## 7. Local Verification

After startup, verify public and admin behavior separately.

Public:

```bash
curl http://127.0.0.1:3000/v1/public/catalog
```

Admin with token:

```bash
curl http://127.0.0.1:3000/v1/config/upstreams \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

If you are using cookie login instead, open:

```text
http://127.0.0.1:3000/?admin=1
```

## 8. Important Constraints

- This app uses one backend port. Public frontend and private admin frontend are separated by route behavior and auth, not by separate backend processes.
- The public invocation UI is shareable.
- The admin config UI is only protected if you set admin auth env vars.
- Without `UPSTREAM_CONFIG_PATH`, runtime config loading and saving are unavailable.

## 9. Slow Image Calls And 504s

Image-to-image and edit calls can run for several minutes. Configure every layer in the request path with a timeout longer than the expected upstream generation time:

- `UPSTREAM_REQUEST_TIMEOUT_MS` for OpenAI-compatible SDK calls.
- Vite dev proxy timeout when using `npm run dev:ui`.
- Nginx or Caddy reverse proxy read/send timeout in deployment.

The included Vite config and Nginx template use 30-minute defaults. If the browser shows a plain non-JSON `Request failed with status 504`, the failure likely came from a proxy layer. If the backend receives the request, logs should include `upstream_image_request_started` and either `upstream_image_request_succeeded` or `upstream_image_generation_failed`.
