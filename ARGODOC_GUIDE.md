# StockForge AI — ArgoCD GitOps Guide

(See also naming: `ARGOCD_GUIDE.md` — same content)

## GitOps for Trading Platform

Git repository holds:
- `infrastructure/k3s/` — deployments, services, ingress
- `infrastructure/helm/stockforge-ai/` — chart + values per env

ArgoCD watches `main` branch and applies to k3s cluster on EC2.

## Install on k3s

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

## Application manifest

Point `repoURL` to your StockForge Git repo and `path` to Helm chart.

Enable `automated.selfHeal` for drift detection after manual `kubectl` edits.

## Deployment strategies

- **Rolling** — default for API deployments
- **Blue-green** — Argo Rollouts for zero-downtime API upgrades
- **Canary** — route 10% traffic to new chart version before full promotion

Critical for trading: always run readiness probes against `/api/v1/health` before receiving traffic.
