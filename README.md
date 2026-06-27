# NuestraCuenta

Shared expense tracker for two-person households. Automatically splits costs 57/43, tracks payment methods, and calculates who owes whom at the end of each period.

## What it does

- Register two users and link them to a shared household via invite code
- Log expenses manually with auto-split (57/43) or custom split
- Track payment methods (bank card, cash, etc.) and categories (supermarket, delivery, etc.)
- View settlement: who needs to pay whom and how much
- Dashboard with recent expenses and current balance

## Stack

- **Backend:** FastAPI + SQLAlchemy + Alembic, runs as a Vercel Python serverless function
- **Frontend:** Next.js 16 (App Router) + Tailwind CSS, deployed via Vercel

## Local development

### Prerequisites

- Python 3.11+
- Node.js 20+

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy and fill in env vars
cp ../.env.example .env
# Edit .env: set DATABASE_URL to a local SQLite or Postgres URL

# Run migrations
alembic upgrade head

# Start dev server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Set the API base URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

The app runs at `http://localhost:3000`.

## Environment variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL (prod) or SQLite (local/test) connection string | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Random 32-character string for signing tokens | `changeme-random-32-chars` |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `JWT_EXPIRE_MINUTES` | Token lifetime in minutes (7 days = 10080) | `10080` |
| `NEXT_PUBLIC_API_URL` | Public URL of the backend API | `https://nuestracuenta.vercel.app` |

## Running tests

```bash
cd backend
DATABASE_URL=sqlite:///./test.db pytest tests/ -v
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → New Project → import the GitHub repo.
3. Leave Root Directory as `/` (the `vercel.json` at the root handles routing).
4. Under **Environment Variables**, add all variables from the table above.
   - Provision a Vercel Postgres database (Storage → Create → Postgres) and copy the `DATABASE_URL`.
   - Generate a random `JWT_SECRET` (e.g. `openssl rand -hex 32`).
   - Set `NEXT_PUBLIC_API_URL` to your Vercel deployment URL (e.g. `https://nuestracuenta.vercel.app`).
5. After the first deploy, run the initial migration once from your local machine:

```bash
cd backend
export DATABASE_URL="postgresql://..."   # production DATABASE_URL
alembic upgrade head
```

6. Subsequent pushes to `main` trigger automatic redeploys. Every pull request runs the CI workflow (backend tests + frontend build) before merging.
