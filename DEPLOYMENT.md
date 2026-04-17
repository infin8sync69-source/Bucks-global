# Bucks Global — End-to-End Deployment Guide

This document walks you through connecting all four services:
**GitHub → Vercel (frontend) + Railway (backend) + Supabase (database)**

---

## Prerequisites

| Tool | Install |
|------|---------|
| Node 20 | `nvm install 20` |
| Python 3.12 | system or `pyenv install 3.12` |
| Supabase CLI | `npm i -g supabase` |
| Railway CLI | `npm i -g @railway/cli` |
| Vercel CLI | `npm i -g vercel` |
| gh CLI | `brew install gh` |

---

## 1 · GitHub

### 1a. Push the repo

```bash
git remote add origin https://github.com/YOUR_ORG/bucks-global.git
git push -u origin main
```

### 1b. Add repository secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Where to find it |
|--------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project → Settings → API → anon public key |

The CI workflow (`.github/workflows/ci.yml`) runs on every push to `main` and `feat/**` branches:
- **frontend job** — TypeScript check + Next.js build
- **backend job** — pip install + `import main` + `init_db()` SQLite smoke-test

---

## 2 · Supabase

### 2a. Create project

1. Go to [app.supabase.com](https://app.supabase.com) → **New project**
2. Note your **project ref** (in the project URL: `https://app.supabase.com/project/<ref>`)
3. Note your **database password** (set it during creation; can't be retrieved later)

### 2b. Run migrations

```bash
# Link the CLI to your Supabase project
supabase link --project-ref rianaojvckrbboeneots

# Push all migrations in supabase/migrations/
supabase db push
```

This creates all required tables:
- `users` (+ `uuid7` column)
- `connections`, `following`
- `notifications`
- `discovered_peers`

### 2c. Get connection strings

In Supabase → **Settings → Database → Connection string**:

| Mode | Port | Use for |
|------|------|---------|
| Transaction Pooler | **6543** | Railway (serverless) |
| Session Pooler | 5432 | Long-lived connections |
| Direct | 5432 | Local development |

**Transaction Pooler URL** (for Railway):
```
postgresql://postgres.rianaojvckrbboeneots:[DB-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

> Replace `[DB-PASSWORD]` with the password you set when creating the project.
> Replace `us-east-1` with your project's region if different.

---

## 3 · Railway (Backend)

### 3a. Create service

```bash
railway login
railway init          # creates a new project
railway link          # or link an existing project
```

Or via the Railway dashboard:
1. **New Project → Deploy from GitHub repo**
2. Select your repository
3. Railway will auto-detect the `backend/` service via `railway.toml`

### 3b. Set service root directory

In Railway dashboard → your service → **Settings → Source**:
- **Root Directory**: `backend`

This ensures Railway uses `backend/railway.toml`, `backend/Procfile`, and `backend/nixpacks.toml`.

### 3c. Set environment variables

In Railway dashboard → your service → **Variables**, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Transaction Pooler URL from Supabase (port 6543) |
| `ALLOWED_ORIGINS` | `https://bucks.global,https://www.bucks.global,https://bucks-global.vercel.app` |
| `PORT` | `8000` (Railway also injects `$PORT` automatically) |

> `DATABASE_URL` is the only required secret. All others have safe defaults.

### 3d. Deploy

```bash
# From the backend/ directory
railway up
```

Or push to `main` — Railway auto-deploys on push if GitHub integration is connected.

### 3e. Note your Railway URL

After deploy, Railway shows your public URL:
```
https://<service>-production.up.railway.app
```

Copy this — you need it for the Vercel environment variables.

### 3f. Verify backend is live

```bash
curl https://<service>-production.up.railway.app/health
# → {"status": "ok"}
```

---

## 4 · Vercel (Frontend)

### 4a. Import project

```bash
cd frontend
vercel link          # link to existing project or create new
```

Or via Vercel dashboard:
1. **Add New → Project → Import Git Repository**
2. Select your GitHub repo
3. **Root Directory**: set to `frontend`
4. Framework: **Next.js** (auto-detected)

### 4b. Set environment variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://<service>-production.up.railway.app` | Production |
| `NEXT_PUBLIC_API_URL` | `https://<service>-production.up.railway.app` | Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rianaojvckrbboeneots.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key | All |
| `NEXT_PUBLIC_APP_URL` | `https://bucks.global` | Production |
| `NEXT_PUBLIC_APP_URL` | `https://bucks-global.vercel.app` | Preview |

> **Important**: `NEXT_PUBLIC_API_URL` is baked into the Next.js proxy rewrite at
> **build time**. If you change your Railway URL, update this variable in Vercel
> and trigger a new deployment.

### 4c. Deploy

```bash
vercel --prod
```

Or push to `main` — Vercel auto-deploys on push if GitHub integration is connected.

### 4d. Verify frontend proxy

After deploy, verify the proxy is working:
```bash
curl https://bucks-global.vercel.app/api/proxy/health
# → {"status": "ok"}
```

---

## 5 · Custom Domain (optional)

### Frontend (Vercel)
Vercel → Project → **Settings → Domains** → Add `bucks.global`

Update DNS at your registrar:
```
A     @     76.76.21.21
CNAME www   cname.vercel-dns.com
```

### Backend (Railway)
Railway → Service → **Settings → Networking → Custom Domain** → Add `api.bucks.global`

Update DNS:
```
CNAME api   <generated>.railway.app
```

After adding custom domain, update in Vercel env vars:
```
NEXT_PUBLIC_API_URL=https://api.bucks.global
```

And in Railway env vars:
```
ALLOWED_ORIGINS=https://bucks.global,https://www.bucks.global,https://bucks-global.vercel.app
```

---

## 6 · Local Development

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env          # fill in DATABASE_URL
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

The frontend dev server proxies `/api/proxy/*` → `http://localhost:8000/api/*` via
`next.config.ts`, so no CORS issues locally either.

---

## 7 · Environment Summary

### backend/.env (production values in Railway Variables)

```env
DATABASE_URL=postgresql://postgres.rianaojvckrbboeneots:[DB-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
ALLOWED_ORIGINS=https://bucks.global,https://www.bucks.global,https://bucks-global.vercel.app
PORT=8000
```

### frontend/.env.local (production values in Vercel Variables)

```env
NEXT_PUBLIC_API_URL=https://<service>-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://rianaojvckrbboeneots.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_APP_URL=https://bucks.global
```

---

## 8 · Deployment Checklist

- [ ] Supabase project created and database password saved
- [ ] `supabase db push` run — all 5 tables present
- [ ] Railway service root set to `backend/`
- [ ] Railway `DATABASE_URL` set (Transaction Pooler, port 6543)
- [ ] Railway `ALLOWED_ORIGINS` includes Vercel domain
- [ ] Railway deploy successful — `/health` returns 200
- [ ] Vercel root directory set to `frontend/`
- [ ] Vercel `NEXT_PUBLIC_API_URL` set to Railway URL
- [ ] Vercel `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` set
- [ ] Vercel deploy successful — proxy `/api/proxy/health` returns 200
- [ ] GitHub repo secrets `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` set (for CI)
- [ ] GitHub Actions CI passing on `main`

---

## 9 · Troubleshooting

### "Server unreachable" on Search page
- Verify `NEXT_PUBLIC_API_URL` in Vercel matches the Railway URL exactly (no trailing slash)
- Check Railway service is running: `railway logs`
- Check `ALLOWED_ORIGINS` includes the Vercel domain

### Users not appearing in search
- Run `supabase db push` to ensure all migrations applied
- The app auto-registers users on every login — ask user to log in again once backend is live

### Next.js build fails in CI
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set as GitHub repo secrets
- The build uses a placeholder `NEXT_PUBLIC_API_URL` — this is expected

### Railway deploy fails
- Confirm root directory is `backend/` in Railway service settings
- Check `backend/requirements.txt` is committed and up to date
- Check `backend/Procfile` contains: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`

### Supabase connection errors on Railway
- Use Transaction Pooler URL (port **6543**), not direct connection (port 5432)
- Railway's serverless instances can't hold persistent DB connections
