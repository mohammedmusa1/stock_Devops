# CloudCart Pro — Kubernetes Guide

## What Is Kubernetes?

Kubernetes (K8s) orchestrates containers across multiple machines. It handles:

- **Scheduling** — which node runs which pod
- **Self-healing** — restart crashed containers
- **Scaling** — HPA adds pods under load
- **Rolling updates** — zero-downtime deploys
- **Service discovery** — internal DNS for services

---

## Core Objects (Every One Explained)

| Object | Purpose | CloudCart Example |
|--------|---------|-------------------|
| **Pod** | Smallest unit — 1+ containers | `backend-pod` running Express |
| **Deployment** | Manages ReplicaSets, rolling updates | `backend-deployment` replicas: 3 |
| **Service** | Stable network endpoint for pods | `backend-service` ClusterIP :4000 |
| **Ingress** | HTTP routing + TLS termination | Route `/api` → backend, `/` → frontend |
| **ConfigMap** | Non-secret config | `API_PREFIX=/api/v1` |
| **Secret** | Sensitive data (base64) | DB password, JWT secrets |
| **Namespace** | Logical isolation | `cloudcart-pro` |
| **HPA** | Horizontal Pod Autoscaler | Scale 2→10 pods at 70% CPU |
| **PersistentVolumeClaim** | Disk for stateful apps | (RDS preferred over in-cluster DB) |

---

## Probes (Health Checks)

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health
    port: 4000
  initialDelaySeconds: 15
  periodSeconds: 20
# If fails → Kubernetes RESTARTS the pod

readinessProbe:
  httpGet:
    path: /api/v1/health
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 10
# If fails → pod removed from Service (no traffic)
```

---

## Deploy to EKS (Step 6)

```bash
# Configure kubectl
aws eks update-kubeconfig --name cloudcart-pro --region us-east-1

# Apply namespace
kubectl apply -f infrastructure/kubernetes/namespace.yaml

# Apply manifests (added in Step 6)
kubectl apply -f infrastructure/kubernetes/backend/
kubectl apply -f infrastructure/kubernetes/frontend/

# Verify
kubectl get pods -n cloudcart-pro
kubectl logs -f deployment/backend -n cloudcart-pro
```

---

## Helm (Step 7)

Helm = package manager for Kubernetes.

```bash
helm install cloudcart-pro ./infrastructure/helm/cloudcart-pro \
  -n cloudcart-pro \
  -f infrastructure/helm/cloudcart-pro/values-dev.yaml
```

**Why Helm?** Parameterize replicas, image tags, env per environment (dev/staging/prod) without duplicating YAML.

---

## Deployment Strategies

| Strategy | How | Risk |
|----------|-----|------|
| **Rolling** | Replace pods one-by-one | Low — default |
| **Blue-Green** | Two full environments, switch traffic | Instant rollback |
| **Canary** | 5% traffic to new version first | Safest for risky changes |

Argo Rollouts (with ArgoCD) implements blue-green and canary — see [ARGOCD_GUIDE.md](./ARGOCD_GUIDE.md).

---

## HPA Example

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: cloudcart-pro
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Backup Strategy

- **RDS:** automated daily snapshots, 7-day retention (prod: 30 days)
- **Kubernetes:** Velero for cluster resource backup
- **S3:** versioning enabled on asset buckets

Disaster recovery: restore RDS snapshot → redeploy Helm chart → verify health endpoints.
