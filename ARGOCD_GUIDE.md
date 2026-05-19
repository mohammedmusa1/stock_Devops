# CloudCart Pro — ArgoCD GitOps Guide

> File name note: listed as `ARGODOC_GUIDE.md` in requirements — this guide is `ARGOCD_GUIDE.md` (correct product spelling).

## What Is GitOps?

**Git is the single source of truth** for infrastructure and application state.

- You commit Kubernetes manifests / Helm values to Git
- ArgoCD watches the repo
- When Git changes, ArgoCD applies changes to the cluster
- Drift (manual kubectl edits) is detected and optionally auto-healed

---

## What Is ArgoCD?

A Kubernetes-native continuous delivery tool. UI shows:

- App health (Healthy / Degraded / Missing)
- Sync status (Synced / OutOfSync)
- Diff between Git and cluster

---

## Architecture

```
Developer → Git push → Jenkins (build image, update tag in Git)
                              ↓
                         Git repo (manifests)
                              ↓
                         ArgoCD (watches)
                              ↓
                         EKS cluster
```

---

## Install ArgoCD on EKS (Step 9)

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

---

## Application Manifest

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cloudcart-pro
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/YOUR_USER/cloudcart-pro.git
    targetRevision: main
    path: infrastructure/helm/cloudcart-pro
    helm:
      valueFiles:
        - values-prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: cloudcart-pro
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

## Blue-Green with Argo Rollouts

Replace standard Deployment with Rollout resource:

```yaml
strategy:
  blueGreen:
    activeService: backend-active
    previewService: backend-preview
    autoPromotionEnabled: false
```

Promote preview after smoke tests pass.

---

## Canary Deployment

```yaml
strategy:
  canary:
    steps:
      - setWeight: 10
      - pause: { duration: 5m }
      - setWeight: 50
      - pause: { duration: 5m }
      - setWeight: 100
```

---

## Auto Rollback

```yaml
syncPolicy:
  automated:
    selfHeal: true
```

Combined with readiness probes — if new pods fail health checks, rollout aborts and previous revision stays active.

---

## Drift Detection

ArgoCD UI → App → **Diff** shows manual cluster changes vs Git.

Enable `selfHeal: true` to revert unauthorized changes automatically.

---

## Interview Talking Points

- GitOps = auditable deploys (who changed what, when)
- Separates build (Jenkins) from deploy (ArgoCD)
- Faster rollback = revert Git commit + sync
- Works with Helm, Kustomize, plain YAML
