# Stock AI — Enterprise Deployment Runbook (55 Steps)

**Role:** Senior DevOps / Production Reliability  
**Target:** Single EC2, AWS free-tier friendly, Docker → Compose → Nginx → k3s → Monitoring → CI/CD  
**Rule:** **Never skip a step.** Validate before advancing. If validation fails → **STOP**, troubleshoot, rollback if needed.

**Quick validate:** `node scripts/validate-step.mjs <N>` (steps 1–5 automated)  
**Status tracker:** [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)

---

## Port map (avoid conflicts)

| Port | Service | Stage |
|------|---------|-------|
| 3000 | Next.js dev / web container | Local & prod |
| 3001 | Grafana (monitoring only) | Step 26+ |
| 4000 | NestJS API | Local & prod |
| 5432 | PostgreSQL | Docker only (do not expose publicly on EC2) |
| 6379 | Redis | Docker only |
| 80 / 443 | Nginx | Production |
| 9090 | Prometheus | localhost only on EC2 |
| 9093 | Alertmanager | localhost only |
| 3100 | Loki | localhost only |
| 6443 | k3s API | optional |

**Risk:** Running `npm run dev` and Docker web both on 3000 → **port conflict**. Use either dev mode OR compose, not both.

---

## Resource budget (single EC2 t3.large ≈ 8 GB RAM)

| Stack | Approx RAM | When |
|-------|------------|------|
| Postgres + Redis | ~700 MB | Always |
| API + Web | ~1.2 GB | Always |
| Nginx | ~50 MB | Prod |
| Monitoring (Prom/Graf/Loki) | ~1 GB | Step 26+ only |
| k3s control plane | ~512 MB | Step 33+ (choose Compose **OR** k3s for app, not both) |

**OOM prevention:** Set memory limits in `docker-compose.prod.yml`. Do not run full monitoring + k3s + Compose duplicates on one small instance.

---

# PHASE A — LOCAL FOUNDATION (Steps 1–7)

---

## STEP 1 — Project structure validation

**Prerequisites:** Git repo cloned, Node 20+, npm 10+

### Execute
```powershell
cd d:\stockdevops
node scripts/validate-step.mjs 1
```

### Verify
| Check | Command | Expected |
|-------|---------|----------|
| Automated | `node scripts/validate-step.mjs 1` | `STEP 1: PASSED` |
| Workspaces | `type package.json` | `apps/api`, `apps/web` |
| Migrations | `dir apps\api\prisma\migrations` | ≥1 migration folder |

### Troubleshoot
| Error | Fix |
|-------|-----|
| Missing Dockerfile | Ensure `apps/api/Dockerfile`, `apps/web/Dockerfile` exist |
| Missing compose | Restore `docker-compose.yml` from repo |

### Rollback
N/A (read-only validation)

**Gate:** ✅ PASSED when validator exits 0

---

## STEP 2 — Environment variable setup

**Prerequisites:** STEP 1 passed

### Execute
```powershell
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.local.example apps\web\.env.local
node scripts\validate-step.mjs 2
```

### Required variables (`apps/api/.env`)

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://stockforge:...@localhost:5432/stockforge_ai` | Host `localhost` for local dev |
| `REDIS_URL` | `redis://localhost:6379` | |
| `JWT_ACCESS_SECRET` | 64-char hex | Never commit real secrets |
| `JWT_REFRESH_SECRET` | 64-char hex | Different from access |
| `CORS_ORIGIN` | `http://localhost:3000` | |
| `FRONTEND_URL` | `http://localhost:3000` | Email links |

### Verify
```powershell
node scripts/validate-step.mjs 2
findstr DATABASE_URL apps\api\.env
```

### Troubleshoot
| Error | Fix |
|-------|-----|
| `CHANGE_ME` in JWT | Run `.\scripts\setup-local.ps1` or generate hex secrets |

### Rollback
```powershell
del apps\api\.env
copy apps\api\.env.example apps\api\.env
```

**Gate:** STEP 2 PASSED

---

## STEP 3 — PostgreSQL local setup

**Prerequisites:** STEP 2, **Docker Desktop running**

### Execute
```powershell
docker compose up -d postgres
node scripts/validate-step.mjs 3
```

### Verify
```powershell
docker compose ps postgres
docker compose exec postgres pg_isready -U stockforge
```
**Expected:** `accepting connections`

### Troubleshoot
| Error | Fix |
|-------|-----|
| `Docker daemon not running` | Start Docker Desktop |
| Port 5432 in use | `netstat -ano \| findstr 5432` — stop conflicting service |
| Container exits | `docker compose logs postgres` |

### Rollback
```powershell
docker compose stop postgres
docker compose rm -f postgres
# Full reset (deletes data): docker compose down -v
```

**Gate:** Port 5432 open, `pg_isready` OK

---

## STEP 4 — Redis local setup

**Prerequisites:** STEP 3 passed

### Execute
```powershell
docker compose up -d redis
node scripts/validate-step.mjs 4
```

### Verify
```powershell
docker compose exec redis redis-cli ping
```
**Expected:** `PONG`

### Rollback
```powershell
docker compose stop redis
```

**Gate:** Port 6379 open, `PONG`

---

## STEP 5 — Backend local verification

**Prerequisites:** STEPS 3–4 passed

### Execute
```powershell
npm run dev:api
# separate terminal:
node scripts/validate-step.mjs 5
```

### Verify
```powershell
curl http://localhost:4000/api/v1/health
```
**Expected JSON:**
```json
{ "status": "ok", "database": "ok", "redis": "ok" }
```

### Troubleshoot
| Error | Fix |
|-------|-----|
| `ECONNREFUSED 5432/6379` | Complete STEPS 3–4 |
| `Prisma P1001` | `docker compose up -d` + migrate (STEP 7) |
| Port 4000 in use | `netstat -ano \| findstr 4000` |

### Rollback
Stop API: `Ctrl+C` in dev terminal

---

## STEP 6 — Frontend local verification

**Prerequisites:** STEP 5 passed

### Execute
```powershell
npm run dev:web
```

### Verify
| URL | Expected |
|-----|----------|
| http://localhost:3000 | Home page "Stock AI" |
| http://localhost:3000/services | All services grid |
| http://localhost:3000/sign-in | Login form |

```powershell
curl -I http://localhost:3000
```
**Expected:** `HTTP/1.1 200`

### Troubleshoot
| Error | Fix |
|-------|-----|
| Port 3000 busy | Kill old Node/Next process |
| API errors in UI | Confirm STEP 5 health OK |

### Rollback
`Ctrl+C` web dev server

---

## STEP 7 — Prisma migrations and DB verification

**Prerequisites:** STEP 3 (Postgres up)

### Execute
```powershell
cd apps\api
npx prisma generate
npx prisma migrate deploy
npm run db:seed
cd ..\..
```

### Verify
```powershell
cd apps\api
npx prisma migrate status
```
**Expected:** `Database schema is up to date`

```powershell
docker compose exec postgres psql -U stockforge -d stockforge_ai -c "\dt"
```
**Expected:** tables `User`, `Stock`, `Wallet`, etc.

### Troubleshoot
| Error | Fix |
|-------|-----|
| Migration failed | `docker compose logs postgres` |
| Seed duplicate | Normal if re-run; ignore unique errors |

### Rollback
```powershell
npx prisma migrate reset
# WARNING: deletes all data
```

**Gate:** Migrations applied, seed users exist

---

# PHASE B — DOCKER LOCAL (Steps 8–13)

---

## STEP 8 — Docker backend image

```powershell
docker build -t stockai-api:local ./apps/api
docker images stockai-api:local
```
**Expected:** image listed, ~300–500MB

**Rollback:** `docker rmi stockai-api:local`

---

## STEP 9 — Docker frontend image

```powershell
docker build -t stockai-web:local --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 --build-arg NEXT_PUBLIC_WS_URL=http://localhost:4000 ./apps/web
```

**Rollback:** `docker rmi stockai-web:local`

---

## STEP 10 — Docker Compose full stack

**Prerequisites:** STEPS 8–9 optional; uses compose build

```powershell
copy .env.production.example .env.production
# Edit for local test: FRONTEND_URL=http://localhost, point API URLs to host

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps
```

**Expected:** `api`, `web`, `postgres`, `redis`, `nginx` running

```powershell
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

**Rollback:**
```powershell
docker compose -f docker-compose.prod.yml down
```

---

## STEP 11 — Docker networking validation

```powershell
docker compose -f docker-compose.prod.yml exec api wget -qO- http://postgres:5432
docker compose -f docker-compose.prod.yml exec api wget -qO- http://redis:6379
docker network inspect stockdevops_default
```

API must reach `postgres:5432` and `redis:6379` by **service name**, not `localhost`.

**Rollback:** STEP 10 down

---

## STEP 12 — Nginx reverse proxy local

Uses `infrastructure/nginx/namestock.conf`. Verify routes:

```powershell
curl http://localhost/api/v1/health
curl -I http://localhost/
```

**Expected:** API JSON health; web HTML 200

---

## STEP 13 — HTTPS local/staging validation

**Risk:** Certbot needs real DNS for production. For local, HTTP only is OK.

**Staging:** Use real domain → EC2 IP before STEP 25.

**Rollback:** Revert to HTTP-only nginx config

---

# PHASE C — AWS EC2 PRODUCTION (Steps 14–25)

> Full AWS guide: [AWS_FREE_TIER_DEPLOYMENT.md](./AWS_FREE_TIER_DEPLOYMENT.md)

## STEP 14 — AWS EC2 creation

```bash
cd infrastructure/aws/terraform
terraform init && terraform apply
```

**Verify:** `terraform output public_ip`  
**Rollback:** `terraform destroy`

---

## STEP 15 — Security groups validation

Only: **22** (your IP/32), **80**, **443**.  
**Never:** 5432, 6379, 4000, 3000 on 0.0.0.0/0

```bash
aws ec2 describe-security-groups --group-ids <sg-id>
```

---

## STEPS 16–18 — SSH, firewall, Docker on EC2

```bash
ssh -i key.pem ubuntu@<IP>
./scripts/ec2-bootstrap.sh
docker compose -f docker-compose.prod.yml up -d --build
```

---

## STEPS 19–22 — Production env + DB/API/Web verify

Same health checks as STEPS 5–7, using production `.env.production` and domain URLs.

---

## STEPS 23–25 — Domain, Nginx prod, SSL

DNS A record → Elastic IP → `certbot` → reload nginx.

**Rollback:** Remove cert, revert nginx to HTTP

---

# PHASE D — MONITORING (Steps 26–32)

**Warning:** Do not deploy until STEPS 18–22 stable. Adds ~1GB RAM.

```bash
docker compose -f docker-compose.prod.yml -f infrastructure/monitoring/docker-compose.monitoring.yml up -d
```

| Step | Verify |
|------|--------|
| 27 Prometheus | `curl localhost:9090/-/healthy` |
| 28 Grafana | `http://<EC2>:3001` (SSH tunnel only) |
| 29 Loki | `curl localhost:3100/ready` |
| 30 Alertmanager | `curl localhost:9093/-/healthy` |
| 31 SMTP | Set `SMTP_*` in `.env.production` |
| 32 Email test | Trigger test alert |

**Email alerts (STEP 32):** Pod crash, pod recreated, service down, healthy heartbeat every 12h — configure in `infrastructure/monitoring/alertmanager.yml` + Prometheus rules.

**Rollback:**
```bash
docker compose -f infrastructure/monitoring/docker-compose.monitoring.yml down
```

---

# PHASE E — K3S (Steps 33–45)

**Critical:** Choose **either** Docker Compose **or** k3s for app workloads on one EC2 — not both.

```bash
curl -sfL https://get.k3s.io | sh -
kubectl apply -f infrastructure/k3s/
```

| Step | Action |
|------|--------|
| 35 | `kubectl create secret generic namestock-secrets --from-env-file=.env.production` |
| 42–43 | Liveness/readiness probes in YAML |
| 45 HPA | Only if CPU consistently >70%; needs metrics-server |

**Rollback:** `sudo /usr/local/bin/k3s-uninstall.sh`

---

# PHASE F — CI/CD & ADVANCED (Steps 46–55)

| Steps | Topic | Notes |
|-------|-------|-------|
| 46–47 | Jenkins | Run on same EC2 only if RAM allows; prefer GitHub Actions |
| 48–49 | ArgoCD | After k3s stable |
| 50–52 | Blue/green, canary, rollback | Require 2+ replicas — skip on single node initially |
| 53 | Performance | `ab` or k6 — low RPS on t3.large |
| 54 | Security | SSH keys, UFW, secrets in env not git |
| 55 | Final validation | Full checklist below |

---

# Final production validation (STEP 55)

```bash
curl -f https://yourdomain.com/api/v1/health
curl -fI https://yourdomain.com/
docker compose ps
free -h
df -h
```

| Check | Pass criteria |
|-------|---------------|
| Health | `database: ok`, `redis: ok` |
| SSL | Valid cert, HTTPS redirect |
| RAM | <85% used under normal load |
| Disk | <80% used |
| Billing | AWS budget alert configured |

---

# Emergency rollback (full stack)

```bash
docker compose -f docker-compose.prod.yml down
# EC2:
sudo terraform destroy   # removes instance
```

---

# Command cheat sheet

```powershell
node scripts/validate-step.mjs 1    # structure
node scripts/validate-step.mjs 3    # postgres
npm run deps:up                     # postgres + redis
npm run deps:check                  # ports 5432 + 6379
npm run dev                         # local dev (needs deps)
npm run docker:prod                 # full prod compose
./scripts/docker-cleanup.sh         # disk cleanup on EC2
```

---

**Next action for you:** Run **STEP 2** then **STEPS 3–4** (start Docker Desktop first).
