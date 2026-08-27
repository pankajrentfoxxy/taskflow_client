# TaskFlow — Monorepo

Internal task tracker split into a frontend (Next.js) and backend (Express + PostgreSQL).

```
taskflow/
├── TMS_FE/   Next.js UI (calls TMS_BE API)
├── TMS_BE/   Express API + PostgreSQL
└── README.md
```

## Quick start

### 1. Backend (TMS_BE)

Requirements: **Node.js 18+**, **PostgreSQL**. Create database `TMS_DEV`, copy `.env`, then:

```bash
cd TMS_BE
npm install
npm run dev
```

API: http://localhost:4000 — see [TMS_BE/README.md](TMS_BE/README.md).

### 2. Frontend (TMS_FE)

```bash
cd TMS_FE
cp .env.example .env.local
npm install
npm run dev
```

UI: http://localhost:3000

Set `NEXT_PUBLIC_API_URL=http://localhost:4000/api` in `.env.local` if needed. Match `CORS_ORIGIN` in TMS_BE to your frontend origin.

Demo login: `admin@rentfoxxy.com` / `password123`

## Development

Run **both** services in separate terminals. The frontend has no SQLite or `/api` routes — all requests go to TMS_BE.
