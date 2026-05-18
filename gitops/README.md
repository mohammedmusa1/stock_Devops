# StockDevOps Enterprise GitOps Repository

Welcome to the **StockDevOps Enterprise GitOps Control Plane**. This repository represents the declarative state of the entire Kubernetes cluster hosting the StockDevOps platform. By adopting a GitOps operational workflow, manual intervention (`kubectl apply`) is strictly prohibited. The cluster's live state is continuously synchronized with the declarations in this repository.

This setup is optimized for an **AWS EC2 `t3.large` (8GB RAM, 2 vCPUs)** running **k3s**, providing a production-grade infrastructure budget that comfortably runs an App Stack, CI/CD Engine, and full Observability Stack without resource exhaust.

---

## 1. Directory Structure

```text
gitops/
├── README.md                              # Operational runbook & architecture guide
├── .github/
│   └── workflows/
│       └── gitops-pipeline.yaml           # GitHub Actions validation (yamllint, helm, kube-linter)
├── bootstrap/                             # ArgoCD App-of-Apps control plane
│   ├── root-app.yaml                      # Root Application (manages all other apps)
│   ├── app-app.yaml                       # Application: StockDevOps core services
│   ├── ci-cd-app.yaml                     # Application: Jenkins CI/CD engine
│   └── monitoring-app.yaml                # Application: Prometheus, Grafana, Loki stack
├── infrastructure/                        # Cluster-wide shared components
│   ├── namespaces/
│   │   └── namespaces.yaml                # Separated namespaces (devops-prod, ci-cd, monitoring)
│   ├── storage/
│   │   └── storageclass.yaml              # AWS GP3 EBS and Local StorageClasses
│   ├── rbac/
│   │   └── global-rbac.yaml               # ClusterRoles and ServiceAccounts for GitOps/DevOps teams
│   └── ingress/
│       └── ingress-nginx.yaml             # Domain routing rules with cert-manager SSL
└── apps/                                  # Workload definitions
    ├── stockdevops/                       # Core App Stack (Web, API, DB, Cache)
    │   ├── Chart.yaml                     # Helm Chart metadata
    │   ├── values-prod.yaml               # Prod overrides optimized for t3.large
    │   └── templates/                     # Reusable templates (API, Web, DB, Cache, NetPol, HPA)
    ├── ci-cd/                             # CI/CD Infrastructure (Jenkins)
    │   ├── jenkins-deployment.yaml        # Jenkins Engine (JVM-tuned, persistent)
    │   ├── jenkins-service.yaml           # Exposed via NodePort 30080 & JNLP 50000
    │   ├── jenkins-rbac.yaml              # Cluster RBAC allowing Jenkins to spin build agents
    │   ├── jenkins-pvc.yaml               # 15Gi persistent storage for build data
    │   └── secrets-template.yaml          # Blueprint for Docker/GitHub credentials
    └── monitoring/                        # Observability Stack
        ├── prometheus-configmap.yaml      # Scrape rules for nodes, endpoints, and annotations
        ├── prometheus-deployment.yaml     # TSDB engine with 10Gi gp3 persistent storage
        ├── prometheus-service.yaml        # Exposed via NodePort 30090
        ├── loki-deployment.yaml           # Log Aggregator (boltdb-shipper, resource-optimized)
        ├── loki-service.yaml              # Internal logs cluster endpoint
        ├── grafana-pvc.yaml               # Dashboard persistence claim
        ├── grafana-deployment.yaml        # Dashboard engine (pre-loaded with Prometheus & Loki)
        ├── grafana-dashboards-configmap.yaml # Automated JSON panels for cluster tracking
        ├── grafana-service.yaml           # Exposed via NodePort 30030
        └── alerts.yaml                    # Alertmanager SMTP configs & rules
```

---

## 2. Infrastructure Budgeting & t3.large Optimization

Running a full DevOps stack on a single `t3.large` instance (8GB RAM) requires disciplined memory budgeting. This GitOps configuration enforces the following strict requests and limits:

| Pod/Service | Min Memory (Request) | Max Memory (Limit) | Min CPU (Request) | Max CPU (Limit) | Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Jenkins** | `1.0 Gi` | `1.5 Gi` | `100 m` | `1.0 Core` | Recreate (Stateful) |
| **Prometheus** | `512 Mi` | `1.5 Gi` | `100 m` | `1.0 Core` | TSDB retention 15d |
| **Grafana** | `256 Mi` | `512 Mi` | `50 m` | `500 m` | Auto-provisioned DS |
| **Loki** | `256 Mi` | `512 Mi` | `50 m` | `500 m` | Filesystem chunking |
| **PostgreSQL** | `256 Mi` | `512 Mi` | `100 m` | `500 m` | GP3 EBS Persistent |
| **Redis** | `64 Mi` | `128 Mi` | `50 m` | `200 m` | In-memory cache |
| **NestJS API** | `128 Mi` | `256 Mi` | `100 m` | `300 m` | Scaled to 3x pods |
| **NextJS Web** | `128 Mi` | `256 Mi` | `100 m` | `300 m` | Scaled to 2x pods |
| **k3s & OS overhead**| `1.5 Gi` | `2.0 Gi` | `200 m` | `500 m` | - |
| **TOTALS** | **~4.5 Gi** | **~7.2 Gi** | **~0.9 Cores**| **~5.3 Cores** | **Perfect Fit for 8GB RAM** |

---

## 3. Step-by-Step Bootstrapping Runbook

Follow these steps to deploy this entire GitOps repository onto your AWS EC2 k3s cluster from scratch.

### Step 3.1: Connect to AWS EC2 and Install k3s
SSHs into your Ubuntu 24.04 `t3.large` instance and run the k3s bootstrapper:
```bash
curl -sfL https://get.k3s.io | sh -s - \
  --write-kubeconfig-mode 644 \
  --disable traefik # Disabling built-in Traefik to allow customized Ingress-Nginx
```
Verify the cluster status:
```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

### Step 3.2: Install ArgoCD
Deploy the official ArgoCD engine onto your cluster:
```bash
# Create argocd namespace
kubectl create namespace argocd

# Apply standard manifest
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```
Verify all pods boot up successfully:
```bash
kubectl get pods -n argocd
```

### Step 3.3: Expose ArgoCD Web UI (NodePort)
Patch the ArgoCD Server service to use a NodePort for simple access:
```bash
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort", "ports": [{"port": 80, "targetPort": 8080, "nodePort": 30007}, {"port": 443, "targetPort": 8080, "nodePort": 30443}]}}'
```
Fetch the default `admin` password to log in:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 --decode; echo
```
You can now access the ArgoCD portal via `http://<YOUR-EC2-PUBLIC-IP>:30007` (or HTTPS via port `30443`).

### Step 3.4: Bootstrap the App-of-Apps Control Plane
Apply the root application configuration:
```bash
kubectl apply -f gitops/bootstrap/root-app.yaml
```
This single command triggers ArgoCD to read `gitops/bootstrap/`, provisioning:
1.  All target namespaces (`devops-prod`, `ci-cd`, `monitoring`).
2.  Cluster storage classes (`gp3`) and RBAC.
3.  The Jenkins server and persistent volumes.
4.  Prometheus, Grafana (with dashboards), and Loki.
5.  The core StockDevOps application stack (NextJS, NestJS, Postgres, Redis).

---

## 4. Verification & Operational Guidelines

Once bootstrapped, your cluster endpoints are immediately accessible via standard NodePorts.

### Port Allocation Reference

| Service | Protocol | Access Endpoint | Namespace | Default Credentials |
| :--- | :--- | :--- | :--- | :--- |
| **NextJS Web** | HTTP | `http://<EC2-IP>:30000` | `devops-prod` | Standard UI |
| **Jenkins** | HTTP | `http://<EC2-IP>:30080` | `ci-cd` | `admin` / `admin_password_12345` |
| **Prometheus**| HTTP | `http://<EC2-IP>:30090` | `monitoring` | - |
| **Grafana** | HTTP | `http://<EC2-IP>:30030` | `monitoring` | `admin` / `admin123` |
| **ArgoCD** | HTTP/S | `http://<EC2-IP>:30007` | `argocd` | `admin` / *(fetched in Step 3.3)* |

### How to Verify ArgoCD Self-Healing (Drift Correction)
To prove that our configuration is fully auto-healing and drift-compatible:
1.  Attempt to manually scale our API backend via CLI, bypassing Git control:
    ```bash
    kubectl scale deployment stockdevops-api --replicas=8 -n devops-prod
    ```
2.  Log into your ArgoCD web portal. You will see the application status briefly drift to `OutOfSync`.
3.  Because `selfHeal: true` is active, ArgoCD will instantly detect that the live count of `8` doesn't match the `3` in `values-prod.yaml`. It will immediately issue a rollback command, scaling the pods back down to `3` automatically!
4.  At the same time, Prometheus will record the drift, and Alertmanager will fire an email alert showing `GitOpsDriftDetected`!

### Continuous Delivery Workflow (Jenkins Integration)
When a developer pushes changes to the application repository:
1.  Jenkins pulls the code, compiles it, and builds a new Docker image tagged with the unique commit SHA (e.g., `mohammedmusa1/stockdevops-api:7af2bc3`).
2.  Jenkins updates the `values-prod.yaml` file in this GitOps repository by changing the API tag:
    ```bash
    sed -i 's/tag: .*/tag: 7af2bc3/' gitops/apps/stockdevops/values-prod.yaml
    ```
3.  Jenkins commits and pushes this updated tag to GitHub.
4.  ArgoCD detects the change in this GitOps repository, matches the new image SHA, and executes a zero-downtime rolling update, deploying the new container version seamlessly.
