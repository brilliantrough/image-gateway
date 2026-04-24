# Deploy Artifacts

This folder contains editable deployment templates for a typical Linux server setup.

Files:

- `env.production.example`: production environment variable template
- `local-3100.env.example`: local one-port deployment environment template
- `local-3100.sh`: local build/start/restart/log helper for port 3100
- `start.sh`: non-interactive production startup script
- `image-gateway.service`: `systemd` unit template
- `nginx.image-gateway.conf`: reverse proxy template for Nginx

## Typical Setup

1. Copy the project to a deployment path, for example:

```bash
/srv/image-gateway
```

2. Build the project:

```bash
npm install
npm run build
```

3. Copy and edit the env file:

```bash
cp deploy/env.production.example .env.production
```

4. Update:

- absolute project path
- public domain
- admin password
- admin session secret
- optional admin API token
- upstream config path

5. Start manually for verification:

```bash
bash deploy/start.sh
```

6. If that works, install the `systemd` service and Nginx config.

## Local One-Port Setup

For local validation without running a separate Vite dev server:

```bash
npm install
cp config/upstreams.example.json config/upstreams.json
mkdir -p .local
cp deploy/local-3100.env.example .local/image-gateway-3100.env
bash deploy/local-3100.sh restart
```

Then open:

```text
http://127.0.0.1:3100/
http://127.0.0.1:3100/?admin=1
```

Operational commands:

```bash
bash deploy/local-3100.sh status
bash deploy/local-3100.sh logs
bash deploy/local-3100.sh restart
bash deploy/local-3100.sh stop
```

## Important

- `start.sh` expects a project-local `.env.production`.
- The server process serves both the public frontend and the admin frontend.
- Public usage is at `/`.
- Admin usage is at `/?admin=1`.
