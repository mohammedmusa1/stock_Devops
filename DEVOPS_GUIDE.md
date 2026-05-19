# StockForge AI — DevOps Guide

## Toolchain

| Tool | Role in StockForge |
|------|-------------------|
| **Docker** | Package API + web as immutable images |
| **Docker Compose** | Local Postgres, Redis, optional app containers |
| **k3s** | Lightweight Kubernetes on EC2 (production entry) |
| **Terraform** | VPC, EC2, RDS, IAM as code |
| **Ansible** | Configure Ubuntu 24.04 (Docker, k3s, Nginx) |
| **Jenkins** | CI: test → build → push image |
| **ArgoCD** | GitOps CD to k3s |
| **Prometheus/Grafana** | Metrics & dashboards |
| **Loki** | Centralized logs |
| **Nginx** | Reverse proxy + SSL termination on EC2 |

## CI/CD Flow

```
Git push → Jenkins (build/test) → ECR or Docker Hub → Update Helm values in Git → ArgoCD sync → k3s pods
```

## EC2 Bootstrap (t3.large)

1. Ubuntu 24.04 LTS AMI
2. Security group: 22 (your IP), 80, 443, 6443 (k3s API optional)
3. Ansible playbook installs Docker, k3s, Nginx
4. `kubectl apply -f infrastructure/k3s/`

**Primary AWS guide (free tier + low cost):** [AWS_FREE_TIER_DEPLOYMENT.md](./AWS_FREE_TIER_DEPLOYMENT.md)

See also [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for local Docker steps.
