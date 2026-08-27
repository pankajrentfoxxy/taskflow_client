# TaskFlow Backend (TMS_BE)

Express + Sequelize + PostgreSQL API for TaskFlow. Mirrors the Next.js API routes under `/api` so the frontend can switch backends with minimal changes.

## Prerequisites

- Node.js 18+
- PostgreSQL

## Setup

### 1. Create the database

```sql
CREATE DATABASE "TMS_DEV";
```

### 2. Configure environment

Copy or edit `.env` in this directory:

```env
NODE_ENV=development
PORT=4000
JWT_SECRET=your_secret_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=TMS_DEV
DB_USER=postgres
DB_PASSWORD=your_password
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
UPLOAD_DIR=uploads
MAX_UPLOAD_BYTES=26214400
CRON_SECRET=
```

### 3. Install dependencies

```bash
npm install
```

### 4. Seed demo data

```bash
npm run seed
```

This creates teams, users, task types, sample tasks, and notifications. Default password for all seeded users: `password123`.

Demo admin login: `admin@rentfoxxy.com` / `password123`

### 5. Run the server

```bash
npm run dev
```

API base URL: `http://localhost:4000/api`

Health check: `GET http://localhost:4000/health`

## API routes

| Path | Description |
|------|-------------|
| `POST /api/auth/login` | Login — returns `{ ok, user, accessToken }` + httpOnly cookie |
| `POST /api/auth/logout` | Clear session cookie |
| `GET /api/me` | Current user + unread notification count |
| `GET/POST/PATCH /api/users` | User management (admin) |
| `GET/POST/PATCH /api/teams` | Teams (admin for writes) |
| `GET/POST/PATCH /api/task-types` | Task type catalogue |
| `GET/POST /api/tasks` | List/create tasks |
| `GET/PATCH /api/tasks/:id` | Task detail and actions |
| `GET/POST /api/tasks/:id/comments` | Comments |
| `POST /api/tasks/:id/comments/:commentId/reactions` | Toggle emoji reaction |
| `POST /api/tasks/:id/escalation` | Escalation explanation/review |
| `GET/POST /api/projects` | Projects |
| `GET/PATCH /api/projects/:id` | Project detail |
| `GET/POST /api/notifications` | Notifications |
| `POST /api/uploads` | Multipart file upload |
| `GET /api/uploads/:id` | Download/stream file |
| `GET/POST/DELETE /api/boards` | Personal boards |
| `GET /api/reports` | Analytics dashboard |
| `GET /api/cron/sla-check` | SLA sweep (optional `CRON_SECRET`) |

## Authentication

Send the JWT via:

- `Authorization: Bearer <accessToken>` header, or
- `accessToken` httpOnly cookie (set on login)

## Project structure

```
TMS_BE/
├── index.js              # Server entry
├── scripts/seed.js       # Database seeder
├── src/
│   ├── app.js            # Express app + DB sync
│   ├── routes.js         # Route aggregator
│   ├── config/           # Config, DB, passport, logging
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   ├── routes/           # Route definitions
│   ├── models/           # Sequelize models
│   ├── middlewares/      # Auth, validation, errors
│   ├── lib/              # SLA, RBAC, notifications, cron
│   └── utils/            # Helpers
└── uploads/              # Uploaded files (disk storage)
```

On startup, the app syncs all models in dependency order and runs the seed script automatically if no users exist.
