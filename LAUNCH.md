# Bucks Global – Easy Hybrid Launch (IPFS + Supabase)

This repo already supports:
- IPFS for content (CIDs)
- FastAPI backend for indexing + social features
- Next.js frontend
- Optional Supabase/Postgres for production persistence (instead of local SQLite)

## 1) Local dev (fastest)

### A) Ensure IPFS is running
```bash
ipfs id
```
If that fails, start it:
```bash
ipfs daemon
```

### B) Backend (FastAPI)
```bash
cd Bucks-global/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### C) Frontend (Next.js)
```bash
cd Bucks-global/frontend
npm install
npm run dev
```
Open: `http://localhost:3000`

## 2) Supabase (Hybrid mode)

### A) Link your Supabase project
```bash
supabase login
supabase init
supabase link --project-ref rianaojvckrbboeneots
```

### B) Push DB schema (tables)
This repo includes a starter migration:
`supabase/migrations/20260415000000_init.sql`

Apply it:
```bash
supabase db push
```

### C) Point the backend at Supabase Postgres
Set `DATABASE_URL` (preferred) or `SUPABASE_DB_URL`:
```bash
export DATABASE_URL='postgresql://postgres:<YOUR-PASSWORD>@db.rianaojvckrbboeneots.supabase.co:5432/postgres'
```
Then start the backend as usual (Step 1B). It will use Postgres instead of `backend/database.db`.

## 3) Production with your domain (`bucks.global`)

### Recommended DNS layout
- `bucks.global` → Frontend
- `api.bucks.global` → Backend
- `ipfs.bucks.global` → IPFS Gateway (optional)

### Option A (easiest): Frontend on Vercel + Backend on a VPS/Render/Fly
1. Deploy `Bucks-global/frontend` (Vercel).
2. Deploy `Bucks-global/backend` (VPS/Render/Fly) and set env:
   - `DATABASE_URL` (Supabase connection string)
   - `IPFS_BIN=ipfs` (optional)
   - `IPFS_CLUSTER_CTL=ipfs-cluster-ctl` (optional)
   - `IPFS_RPC_HOST` / `IPFS_RPC_PORT` (optional)
3. Set frontend env (Vercel):
   - `NEXT_PUBLIC_API_URL=https://api.bucks.global`
   - `NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.bucks.global` (or any gateway you run)

#### Quick backend on a VPS with Docker
From `Bucks-global/backend`:
```bash
export DATABASE_URL='postgresql://postgres:<YOUR-PASSWORD>@db.rianaojvckrbboeneots.supabase.co:5432/postgres'
docker compose up -d --build
```
This brings up:
- FastAPI on `:8000`
- IPFS gateway on `:8080`

### Option B: Single VPS (Caddy reverse proxy)
Run 3 services on one server:
- Next.js (`:3000`)
- FastAPI (`:8000`)
- IPFS gateway (`:8080`)

Then configure Caddy/Nginx to route:
- `bucks.global` → `:3000`
- `api.bucks.global` → `:8000`
- `ipfs.bucks.global` → `:8080`

## Notes
- The frontend now supports `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_IPFS_GATEWAY`.
- The backend now supports Postgres when `DATABASE_URL`/`SUPABASE_DB_URL` is set.
