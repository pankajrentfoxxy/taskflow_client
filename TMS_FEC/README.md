# TaskFlow Frontend (TMS_FE)

Next.js 15 UI for TaskFlow. All data comes from **TMS_BE** — there is no embedded database or API in this package.

## Quick start

1. Start the backend (`TMS_BE`) on port 4000 — see [../TMS_BE/README.md](../TMS_BE/README.md).
2. Configure the frontend:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 (or the port Next picks if 3000 is busy).

Ensure `TMS_BE` `CORS_ORIGIN` includes your frontend URL (e.g. `http://localhost:3000,http://localhost:3001`).

### Demo login

`admin@rentfoxxy.com` / `password123` (seeded by TMS_BE)

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | Backend API base URL |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run dev:mobile` | Dev server on `0.0.0.0` (LAN testing) |
| `npm run build` | Production build |
| `npm start` | Run production server |

## Folder map

```
src/app        pages (login, home, tasks, projects, admin, …)
src/components Shell, TaskTable, Composer, CommentsPanel, shadcn/ui
src/lib        util.ts (formatting + api client), utils.ts (cn)
public/        PWA manifest, icons
```
