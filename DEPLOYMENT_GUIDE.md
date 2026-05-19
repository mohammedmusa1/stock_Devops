# Stock AI — Deployment Guide (Legacy Quick Reference)

> **PRIMARY RUNBOOK (55 steps, validation gates):** [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)  
> **AWS free tier:** [AWS_FREE_TIER_DEPLOYMENT.md](./AWS_FREE_TIER_DEPLOYMENT.md)  
> **Status:** [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)

Complete step-by-step deployment from local machine to production.

---

## STEP 1: Local Development ✅ (Current)

### What you are running

| Component | How | Port |
|-----------|-----|------|
| PostgreSQL | Docker container | 5432 |
| Redis | Docker container | 6379 |
| Backend | Node.js (`tsx watch`) | 4000 |
| Frontend | Next.js dev server | 3000 |

### Commands

```powershell
cd d:\stockdevops
.\scripts\setup-local.ps1   # first time only
npm run dev                  # starts backend + frontend
```

### Verify

```powershell
curl http://localhost:4000/api/v1/health
# Expect: "database":"ok", "redis":"ok"
```

---

## STEP 2: Docker — Backend Image

### Why Docker?

Packages your app + Node runtime so it runs identically on any machine (EC2, EKS, laptop).

### Build & run

```powershell
cd d:\stockdevops\apps\backend

# Build image
docker build -t cloudcart-backend:local .

# Run (needs Postgres + Redis from compose)
docker run -p 4000:4000 --env-file .env cloudcart-backend:local
```

### What the Dockerfile does

1. **Builder stage:** installs deps, compiles TypeScript, runs `prisma generate`
2. **Runner stage:** copies only production files, runs as non-root user `cloudcart`
3. **HEALTHCHECK:** hits `/api/v1/health` every 30s

---

## STEP 3: Docker Compose — Full Stack

Uncomment the `backend` service in root `docker-compose.yml`, add frontend service, then:

```powershell
docker compose up -d --build
```

All services share a Docker network — backend connects to `postgres:5432` not `localhost:5432`.

**Important:** Update `DATABASE_URL` host from `localhost` to `postgres` when running inside Docker.

---

## STEP 4: Single EC2 Deployment

### AWS Console steps (summary)

1. **EC2 → Launch Instance**
   - AMI: Ubuntu 22.04 LTS
   - Type: `t3.small` (2 vCPU, 2GB RAM) for learning; `t3.medium` for demo traffic
   - Key pair: create/download `.pem`
   - Security Group:
     - Port 22 (SSH) — your IP only
     - Port 80 (HTTP) — 0.0.0.0/0
     - Port 443 (HTTPS) — 0.0.0.0/0
     - Port 4000 — optional, prefer reverse proxy on 80/443

2. **SSH into instance**

```bash
ssh -i cloudcart-key.pem ubuntu@<EC2_PUBLIC_IP>
```

3. **Install Docker on EC2**

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu
```

4. **Clone repo, copy `.env`, run compose**

5. **Nginx reverse proxy** — proxy `yourdomain.com` → `localhost:3000` and `/api` → `localhost:4000`

6. **SSL with Certbot** — free Let's Encrypt certificates

Full AWS click-by-click: [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md)

---

## STEP 5–13

See dedicated guides:

- Terraform: [TERRAFORM_GUIDE.md](./TERRAFORM_GUIDE.md)
- Kubernetes: [KUBERNETES_GUIDE.md](./KUBERNETES_GUIDE.md)
- Jenkins: [JENKINS_GUIDE.md](./JENKINS_GUIDE.md)
- ArgoCD: [ARGOCD_GUIDE.md](./ARGOCD_GUIDE.md)
- Monitoring: [MONITORING_GUIDE.md](./MONITORING_GUIDE.md)
- HTTPS/DNS: [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md)

---

## Port Reference

| Port | Protocol | Service | Exposure |
|------|----------|---------|----------|
| 22 | TCP | SSH | Admin IP only |
| 80 | TCP | HTTP | Public (redirect to 443) |
| 443 | TCP | HTTPS | Public |
| 3000 | TCP | Next.js | Internal / via proxy |
| 4000 | TCP | Express API | Internal / via proxy |
| 5432 | TCP | PostgreSQL | **Never public** — VPC only |
| 6379 | TCP | Redis | **Never public** — VPC only |

---

## Blue-Green / Canary (EKS — Step 13)

- **Rolling:** default Kubernetes Deployment strategy
- **Blue-Green:** two Deployments + Service switch via Argo Rollouts
- **Canary:** gradual traffic shift 10% → 50% → 100%
- **Auto-rollback:** ArgoCD sync policy + failed readiness probes

Details in [KUBERNETES_GUIDE.md](./KUBERNETES_GUIDE.md) and [ARGOCD_GUIDE.md](./ARGOCD_GUIDE.md).
