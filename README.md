# Peakly V3

Next.js fullstack fitness platform (App Router + TypeScript) with Prisma/PostgreSQL and Auth.js credentials login.

Created and developed by **Christoph Seiler / Flaming Battenberg**.

## Deployment (recommended): Unraid stack with app + postgres

Use `docker-compose.unraid.yml` to deploy the full stack in one go (no separate manual DB container setup needed).

### What this stack does

- Starts `db` (Postgres 16) and `app` (Next.js production image)
- Applies Prisma migrations on app startup
- Bootstraps exactly one initial admin account from environment variables
- Exposes app on a configurable host port (`APP_HOST_PORT`)

`DATABASE_URL` is generated inside the stack using the internal `db` service hostname, so you do not need to set it manually in Unraid UI.

### Unraid setup (GitHub -> Stack)

1. Push this repository to GitHub.
2. In Unraid, create a new stack using this repository.
3. Use `docker-compose.unraid.yml` as compose file.
4. Add environment values from `.env.unraid.example`.
5. Choose a free host port via `APP_HOST_PORT` (example: `3210`).
6. Start stack.
7. Configure Nginx reverse proxy:
   - domain: `fitness.flamingbattenberg.de`
   - upstream: `http://<UNRAID_IP>:<APP_HOST_PORT>`
   - TLS certificate enabled

### Required environment variables for Unraid stack

See `.env.unraid.example`.

Most important:

- `NEXT_PUBLIC_APP_URL=https://fitness.flamingbattenberg.de`
- `APP_HOST_PORT=3210` (or any free port on your server)
- `POSTGRES_PASSWORD=<strong password>`
- `AUTH_SECRET=<long random secret>`
- `INITIAL_ADMIN_EMAIL=<your admin email>`
- `INITIAL_ADMIN_PASSWORD=<strong admin password, min 12 chars>`

### Admin bootstrap behavior

- On startup, `scripts/bootstrap-initial-admin.mjs` ensures one admin user exists.
- No test user is auto-created.
- Existing admin email is updated with the provided display name/password.

## Local development

Use the existing development compose file:

```bash
docker compose up -d db
npm install
npm run db:generate
npx prisma migrate dev
npm run db:seed
npm run dev -- --hostname 0.0.0.0 --port 3005
```

`.env.example` contains local development defaults.

## Health and core routes

- Health: `GET /api/health`
- Admin API auth check: `GET /api/admin/ping`
- Login: `/login`
- Dashboard: `/dashboard`
- Admin page: `/admin`

## Backup / Restore

See `backup_restore_runbook.md` for PostgreSQL dump/restore instructions and verification steps.
