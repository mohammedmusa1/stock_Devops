# Name Stock AI — AWS Free Tier & Low-Cost Deployment Guide

**Goal:** Deploy a production-looking trading platform on **one Ubuntu 24.04 EC2 instance** using **Docker**, **Docker Compose**, optional **k3s**, **PostgreSQL + Redis containers**, **Nginx**, and **Let's Encrypt** — without EKS, NAT Gateway, RDS, or ElastiCache.

---

## 1. Architecture (single server)

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  EC2 Ubuntu 24.04 (t3.large or t3.micro free tier)      │
│  Security Group: 22 (your IP), 80, 443 only              │
│                                                          │
│  ┌──────────────┐                                        │
│  │ Nginx :80/443│  ← Let's Encrypt SSL                   │
│  └──────┬───────┘                                        │
│         │                                                │
│    ┌────┴────┐                                           │
│    ▼         ▼                                           │
│  web:3000  api:4000                                      │
│    │         │                                           │
│    │    ┌────┴────┐                                      │
│    │    ▼         ▼                                      │
│    │ postgres  redis  (Docker containers, NOT RDS)       │
│    │                                                     │
│  Optional: k3s (same host) replaces Compose orchestration│
└─────────────────────────────────────────────────────────┘
```

| Component | Where it runs | Why |
|-----------|---------------|-----|
| Next.js web | Docker | No Amplify/CloudFront required initially |
| NestJS API | Docker | One process, easy logs |
| PostgreSQL | Docker | Avoids RDS cost (~$15+/mo) |
| Redis | Docker | Avoids ElastiCache (~$12+/mo) |
| Nginx | Docker | One reverse proxy, no ALB ($16+/mo) |
| Kubernetes | **k3s** on same EC2 | Not EKS ($72+/mo control plane) |

---

## 2. AWS services: free-tier safe vs expensive

### Free-tier friendly (use these)

| Service | Free tier (typical) | Use for |
|---------|---------------------|---------|
| **EC2 t2/t3.micro** | 750 hrs/month (12 mo) | App server |
| **EBS gp3** | 30 GB-month (12 mo) | Root disk |
| **Elastic IP** | Free **while attached** to running instance | Stable DNS |
| **S3** | 5 GB (12 mo) | Backups, static assets (optional) |
| **Route 53** | Not free ($0.50/zone/mo) | DNS — or use free Cloudflare |
| **CloudWatch basic** | Limited free metrics | CPU alarms |

### Low cost (OK with credits, watch usage)

| Service | Rough cost | Notes |
|---------|------------|-------|
| **EC2 t3.large** | ~$0.0832/hr ≈ **$60/mo** 24/7 | Good for demo + k3s; **stop instance when not using** |
| **EBS > 30 GB** | ~$0.08/GB-mo | Keep disk at 30 GB |
| **Data transfer out** | First 100 GB/mo often cheap | Images/API responses add up |

### Expensive — **do NOT use initially**

| Service | Why avoid | Typical cost |
|---------|-----------|--------------|
| **EKS** | Managed control plane | ~$72/mo + nodes |
| **NAT Gateway** | Per-AZ hourly + data | ~$32+/mo **each** |
| **Application Load Balancer** | Hourly + LCU | ~$16+/mo |
| **RDS** | Managed DB | ~$15–50+/mo smallest |
| **ElastiCache** | Managed Redis | ~$12+/mo |
| **Multiple EC2** | 2× everything | 2× compute |

### Temporary-use only (create → use → destroy)

- Extra EC2 for experiments  
- Snapshots you forget  
- Unattached Elastic IPs (~$3.65/mo)  
- Old EBS volumes  

---

## 3. Expected monthly cost (realistic)

| Setup | 24/7 cost (approx.) | Student strategy |
|-------|---------------------|------------------|
| t3.micro + 30 GB (free tier year 1) | **$0–3** | Stay in 750 h/mo |
| t3.large + 30 GB | **~$60–70** | Stop nights/weekends → ~$20–30 |
| + NAT + ALB + RDS | **$120+** | Don't do this yet |
| Credits | Covers bills | Still set **billing alarms** |

**Cheaper alternative to 24/7 EC2:** Run locally for dev; start EC2 only for demos, then `terraform destroy` or **Stop instance** (compute stops; EBS still billed).

---

## 4. Avoid hidden AWS charges

1. **Billing → Budgets** — create budget $5 / $10 with email alert at 80% and 100%.  
2. **Billing → Free Tier** — check usage dashboard weekly.  
3. **EC2 → Instances** — **Stop** (not just logout) when done for the day.  
4. **Elastic IPs** — release if you delete the instance.  
5. **EBS volumes** — delete unattached volumes (EC2 → Volumes).  
6. **Snapshots** — delete old AMIs/snapshots.  
7. **Never open SSH (22) to 0.0.0.0/0** — bots + risk; use your IP `/32` only.  
8. **Data transfer** — serving large files globally costs money; use Cloudflare free CDN later.  
9. **IMDSv2** — enabled in our Terraform (security best practice).  

---

## 5. Deploy with Terraform (single EC2)

### Prerequisites

- AWS account + AWS CLI configured  
- Terraform ≥ 1.5  
- EC2 key pair created in AWS Console  
- Your public IP: https://ifconfig.me  

### Steps

```bash
cd infrastructure/aws/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit: key_name, ssh_cidr = "YOUR_IP/32", instance_type

terraform init
terraform plan
terraform apply
```

Outputs: `public_ip`, `ssh_command`.

### SSH

```bash
ssh -i your-key.pem ubuntu@<public_ip>
```

### Bootstrap server

```bash
git clone <your-repo> name-stock-ai
cd name-stock-ai
chmod +x scripts/*.sh
./scripts/ec2-bootstrap.sh
# Log out and back in for docker group
```

---

## 6. Deploy with Docker Compose (recommended first)

On EC2:

```bash
cp .env.production.example .env.production
nano .env.production   # set passwords, domain, JWT secrets

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Run DB migrations (one time)
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec api npm run db:seed   # optional
```

Point domain **A record** → EC2 public IP.

### SSL (Let's Encrypt)

```bash
# Ensure port 80 reachable, domain DNS propagated
sudo ./scripts/ssl-init.sh yourdomain.com you@email.com
# Then enable SSL nginx config and reload:
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 7. Deploy with k3s (optional step 2)

**When:** You want Kubernetes experience without EKS cost. k3s uses ~512 MB RAM.

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -
kubectl apply -f infrastructure/k3s/namespace.yaml
# Create secret from .env.production keys
kubectl create secret generic namestock-secrets -n name-stock-ai --from-env-file=.env.production
kubectl apply -f infrastructure/k3s/
```

k3s **Traefik** Ingress replaces a second load balancer. Do **not** also pay for an AWS ALB unless you need it.

Resource limits are set low in YAML (`256Mi–512Mi`) for t3.large.

---

## 8. Monitor CPU & RAM on EC2

```bash
# Live view
htop          # sudo apt install htop
free -h
df -h

# Docker per container
docker stats

# k3s
kubectl top nodes
kubectl top pods -n name-stock-ai
```

### Reduce RAM usage

| Action | Savings |
|--------|---------|
| Use `t3.micro` for learning | Less RAM, may need swap |
| `redis --maxmemory 128mb` | Already in compose |
| API `NODE_OPTIONS=--max-old-space-size=384` | Caps Node heap |
| 1 replica only | No HA yet |
| Disable k3s if using Compose only | ~512 MB |

### Add swap (only if micro instance OOMs)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 9. Clean Docker disk space

```bash
./scripts/docker-cleanup.sh
```

Manual:

```bash
docker system df
docker system prune -af      # removes unused images
docker volume prune        # CARE: only if you don't need old DB volumes
```

---

## 10. Kubernetes resource optimization

Edit `infrastructure/k3s/*.yaml`:

- `resources.requests` — scheduling minimum  
- `resources.limits` — hard cap (prevents one pod killing the node)  
- `replicas: 1` — no autoscaling until you need it  

```bash
kubectl describe pod -n name-stock-ai
kubectl get events -n name-stock-ai --sort-by='.lastTimestamp'
```

---

## 11. Nginx reverse proxy

Config: `infrastructure/nginx/namestock.conf`

- `/` → Next.js  
- `/api/` → NestJS (`api/v1` prefix)  
- `/socket.io/` → WebSocket upgrade  

Only **one** public entry (ports 80/443). Do not expose 3000/4000 publicly.

---

## 12. Stop / destroy resources

### Pause (keep data, stop compute bill)

```bash
# AWS Console → EC2 → Instance state → Stop
# Or CLI:
aws ec2 stop-instances --instance-ids i-xxxxxxxx
```

### Destroy everything (no more EC2 charges)

```bash
cd infrastructure/aws/terraform
terraform destroy
```

Also check: Elastic IPs, EBS volumes, snapshots.

---

## 13. Enterprise feel on a student budget

| Enterprise pattern | Low-cost implementation |
|--------------------|-------------------------|
| Load balancer | Nginx on same host |
| Managed DB | Postgres container + nightly `pg_dump` to S3 |
| Managed cache | Redis container |
| Kubernetes | k3s single node |
| SSL | Let's Encrypt |
| CI/CD | GitHub Actions → SSH deploy or Docker build on EC2 |
| Monitoring | CloudWatch alarm on CPU + `docker stats` |
| Logs | `docker compose logs -f` → later Loki |

---

## 14. File reference

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Full production stack |
| `.env.production.example` | Secrets template |
| `infrastructure/aws/terraform/` | Single EC2 Terraform |
| `infrastructure/nginx/namestock.conf` | Reverse proxy |
| `infrastructure/k3s/` | Lightweight K8s manifests |
| `scripts/ec2-bootstrap.sh` | Server setup |
| `scripts/ssl-init.sh` | Let's Encrypt |
| `scripts/docker-cleanup.sh` | Disk cleanup |

---

## 15. Quick checklist

- [ ] Billing budget + alert created  
- [ ] EC2: only ports 22 (your IP), 80, 443  
- [ ] `.env.production` secrets set (strong passwords)  
- [ ] DNS A record → Elastic IP  
- [ ] `prisma migrate deploy` run  
- [ ] SSL certificate issued  
- [ ] Instance **stopped** when not demoing  
- [ ] `terraform destroy` when project ends  

---

## 16. Local vs production commands

| Task | Local | EC2 production |
|------|-------|----------------|
| Start DB | `npm run docker:up` | included in `docker-compose.prod.yml` |
| Start apps | `npm run dev` | Docker images |
| Migrate | `npm run db:migrate` | `docker compose exec api npx prisma migrate deploy` |

For questions on ArgoCD/GitOps later, see `ARGODOC_GUIDE.md` — optional after k3s is stable.
