# NuestraCuenta

Shared expense tracker for two-person households. Automatically splits costs 57/43, tracks payment methods, and calculates who owes whom at the end of each period.

## Live URLs

| Service | URL |
|---|---|
| Frontend | https://ouraccount.vercel.app |
| Backend API | https://ouraccount-api.vercel.app |
| GitHub | https://github.com/tafuenzalidag/ouraccount |

## What it does

- Register two users and link them to a shared household via invite code
- Log expenses manually with auto-split (57/43) or custom split
- Track payment methods (bank card, cash, etc.) and categories (supermarket, delivery, etc.)
- View settlement: who needs to pay whom and how much
- Dashboard with recent expenses and current balance

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS + shadcn/ui v4 |
| Backend | FastAPI (Python 3.12) + SQLAlchemy 2.x + Alembic |
| Database | Neon Postgres (via Vercel integration) |
| Auth | bcrypt + JWT (python-jose, HS256) |
| Hosting | Vercel — two separate projects (frontend + backend) |
| CI | GitHub Actions (pytest + next build on every push/PR) |

## Vercel project structure

The frontend and backend are deployed as two separate Vercel projects:

- `ouraccount` — Next.js frontend, linked to this repo
- `ouraccount-api` — FastAPI backend, linked to `backend/` subdirectory

`NEXT_PUBLIC_API_URL` in the frontend project points to the backend URL.

## Local development

### Prerequisites

- Python 3.12+
- Node.js 20+

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set env vars
export DATABASE_URL="sqlite:///./dev.db"
export JWT_SECRET="dev-secret-change-me"

# Run migrations
alembic upgrade head

# Start dev server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Point at local backend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

The app runs at `http://localhost:3000`.

## Environment variables

### Backend (`ouraccount-api` Vercel project)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (set automatically by Neon integration) |
| `JWT_SECRET` | Random 32-char secret for signing JWT tokens |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://ouraccount.vercel.app,http://localhost:3000`) |
| `JWT_ALGORITHM` | JWT signing algorithm — defaults to `HS256` |
| `JWT_EXPIRE_MINUTES` | Token lifetime in minutes — defaults to `10080` (7 days) |

### Frontend (`ouraccount` Vercel project)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Public URL of the backend API (e.g. `https://ouraccount-api.vercel.app`) |

## Running tests

```bash
cd backend
DATABASE_URL=sqlite:///./test.db pytest tests/ -v
```

## Deploying a new version

Both projects deploy automatically via `vercel --prod` from the CLI (GitHub auto-deploy is not yet connected — the GitHub app needs permission on the repo).

```bash
# Backend
cd backend && vercel --prod

# Frontend
cd .. && vercel --prod
```

## Running migrations against production

```bash
cd backend
export $(grep -v '^#' ../.env.local | xargs)
alembic upgrade head
```

The `.env.local` file is populated by `vercel env pull .env.local --yes` from the `ouraccount` project root.

## Roadmap

| Phase | Status | Contents |
|---|---|---|
| Fase 0 | ✅ Done | Monorepo setup, FastAPI skeleton, Next.js, SQLAlchemy/Alembic |
| Fase 1 — MVP | ✅ Done | Auth, Household, Payment methods, Manual transaction entry, Split engine, Settlement, Dashboard |
| Fase 2 — Ingesta | 🔜 Next | PDF parser (Santander cartola), import preview, auto-categorisation, installment plans |
| Fase 3 — Análisis | ⏳ Pending | Monthly trends, installment projection, CSV support |
| Fase 4 — Conveniencia | ⏳ Pending | Bank sync, budgets, recurring expenses, export |
