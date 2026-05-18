# StockForge AI — Project Progress

> **Last updated:** 2026-05-16  
> Read this file first when resuming work.

## Current Phase

**STEP 1: Local Development** — Foundation complete, ready to run

## Completed

- [x] AWS free-tier deployment guide + Terraform (single EC2)
- [x] `docker-compose.prod.yml` (Postgres, Redis, API, Web, Nginx)
- [x] k3s manifests with low memory limits
- [x] Nginx reverse proxy + SSL scripts

## Completed (app)

- [x] **Production auth:** sign-up, sign-in, email verification, forgot/reset password, change password
- [x] **Notifications:** API + `/notifications` page + header bell + real-time via Socket.IO
- [x] **Light/dark mode:** `next-themes` toggle on auth pages, landing, platform header
- [x] Auth routes: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`
- [x] Settings page with change password
- [x] Monorepo `stockforge-ai` (workspaces: `apps/api`, `apps/web`)
- [x] Docker Compose: PostgreSQL `stockforge_ai` + Redis
- [x] NestJS API: auth, stocks, wallet, trading, portfolio, watchlist, admin users
- [x] Prisma schema: users, wallet, ledger, stocks, holdings, orders, watchlist, alerts, notifications
- [x] Socket.IO gateway + market price simulator (3s ticks)
- [x] Next.js web: dark glassmorphism UI, live ticker, markets, trade, portfolio, wallet, dashboard, watchlist
- [x] Seed: 10 NSE stocks, admin + trader users
- [x] Infrastructure stubs: terraform, k3s namespace, helm chart, nginx
- [x] Documentation: README, ARCHITECTURE, DEPLOYMENT, AWS, DEVOPS, K8s, Terraform, Jenkins, ArgoCD, Monitoring, Security, Commands, Troubleshooting, Services

## Pending

- [ ] OAuth / Cognito / MFA / SSO
- [ ] Stripe + Razorpay + UPI webhooks
- [ ] TradingView chart widget integration
- [ ] AI stock insights module
- [ ] Price alerts CRUD + notifications
- [ ] Admin fraud monitoring dashboard
- [ ] Step 2–13: Docker prod, EC2 t3.large, Terraform, k3s, Jenkins, ArgoCD, monitoring, SSL

## Architecture Decisions

| Topic | Choice |
|-------|--------|
| Backend framework | NestJS (modules, DI, guards, WebSockets) |
| Real-time | Socket.IO (simulated prices; production: market data feed) |
| DB | PostgreSQL + Prisma |
| Cache | Redis (sessions/rate limits later) |
| Auth | JWT + HTTP-only cookies |
| K8s target | k3s on EC2 → scale to EKS |

## Environment Variables

| Variable | File | Example |
|----------|------|---------|
| DATABASE_URL | apps/api/.env | postgresql://stockforge:stockforge_dev_password@localhost:5432/stockforge_ai |
| JWT_ACCESS_SECRET | apps/api/.env | 64-char hex |
| NEXT_PUBLIC_API_URL | apps/web/.env.local | http://localhost:4000/api/v1 |
| NEXT_PUBLIC_WS_URL | apps/web/.env.local | http://localhost:4000 |

## Commands to Run

```powershell
cd d:\stockdevops
docker compose up -d
# copy .env files if needed
cd apps\api
npx prisma migrate dev --name init
npm run db:seed
cd ..\..
npm run dev
```

## AWS Resources

None yet — Step 4 targets **EC2 t3.large, Ubuntu 24.04**

## Blockers

- Docker Desktop must be running
- Old CloudCart containers may conflict on port 5432 — stop with `docker compose down` in old project or change ports

## Next Steps

1. Run setup and verify live ticker on homepage
2. Login → Dashboard → Buy RELIANCE on Trade page → check Portfolio
3. Step 2: Production Dockerfile + full compose stack
4. Step 4: Deploy to EC2 per DEPLOYMENT_GUIDE.md
