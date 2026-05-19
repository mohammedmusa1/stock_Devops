# StockForge AI - Enterprise DevOps & GitOps Architecture

This document explains the comprehensive implementation of the Tier-1 Enterprise DevOps setup for the StockForge AI platform. The system enforces strict GitOps workflows, automated drift reconciliation, advanced self-healing deployments, and zero-trust Kubernetes networking.

---

## 1. Complete CI/CD & GitOps Flow

### **The Pipeline (Jenkins + GitHub + ArgoCD)**
The standard workflow strictly forbids manual `kubectl apply` commands in production:

1. **GitHub Push**: A developer merges code into the `main` branch.
2. **Jenkins CI Build**:
   - Checks out the repository.
   - Runs `trivy fs` to scan the filesystem for critical vulnerabilities.
   - Builds the optimized multi-stage Docker images for both `api` and `web`.
   - Runs `trivy image` to scan the built artifacts before publishing.
   - Pushes the images to the secure registry with a unique commit hash/build tag.
3. **Jenkins CD Trigger**:
   - Jenkins clones the `stockforge-gitops` configuration repository.
   - A `sed` command automatically replaces the old image tag with the new one inside `infrastructure/k8s/app/production.yaml`.
   - Jenkins commits and pushes this change back to GitHub.
4. **ArgoCD Sync & Reconciliation**:
   - ArgoCD polling detects a new commit in the GitOps repo.
   - It validates the YAML and dynamically generates a diff against the live Kubernetes cluster.
   - It patches the live cluster with the new image tags.
5. **Advanced Deployment (Argo Rollouts)**:
   - Instead of immediately destroying the old pods, Argo Rollouts initiates a **Canary Deployment**.
   - It routes 20% of live traffic to the new pods.
   - It waits 5 minutes. If no `5xx` errors spike and the Prometheus health checks succeed, it bumps traffic to 50%, then 100%.

---

## 2. Infrastructure & Kubernetes Drift Detection

Drift occurs when the live infrastructure state deviates from the declarative code in source control (e.g., an engineer manually scaling a deployment during an incident).

### Kubernetes Drift (ArgoCD)
In `infrastructure/k8s/argocd/stockforge-gitops.yaml`, the `Application` manifest is configured with:
```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
```
*   **Detection**: ArgoCD continually diffs the live cluster against Git.
*   **Reporting**: If a drift is found, the application state changes to `OutOfSync`. Prometheus detects this via `argocd_app_info{sync_status="OutOfSync"}` and fires the **GitOpsDriftDetected** alert.
*   **Auto-Correction**: Because `selfHeal: true` is enabled, ArgoCD instantly overwrites the manual change, forcefully reconciling the cluster back to the Git state.

### Terraform Drift
While Kubernetes is managed by ArgoCD, AWS infrastructure (EC2, SGs, VPC) is managed by Terraform. The provided `deploy-all.sh` runs `terraform apply`, but in a true enterprise pipeline, a cronjob runs `terraform plan -detailed-exitcode` daily to alert if manual AWS console changes were made outside of code.

---

## 3. Advanced Kubernetes Implementations

Located in `infrastructure/k8s/app/production.yaml`:

*   **Canary Deployments (`Rollout`)**: Provides safe, staggered releases that automatically rollback if healthchecks fail during the pause window.
*   **Autoscaling (`HorizontalPodAutoscaler`)**: Monitors CPU utilization. If traffic spikes above 75%, it automatically scales the backend API from 3 pods up to 10.
*   **Pod Self-Healing & Disruption (`PodDisruptionBudget`)**: Guarantees that at least 2 replicas are *always* available, even if a cluster node goes down or a cluster administrator attempts to drain a node.
*   **Node Affinity / Anti-Affinity**: Forces the Kubernetes scheduler to place API pods on *different* physical nodes (`topologyKey: kubernetes.io/hostname`) to prevent a single EC2 failure from taking down the app.

---

## 4. Security & Zero-Trust Policies

*   **Network Policies**: The `api-network-policy` strictly dictates that *only* pods with the label `app: web` (the Next.js frontend) can communicate with the backend API on port 4000. All other internal cluster traffic to the API is blocked by default.
*   **RBAC (Role-Based Access Control)**: 
    *   ArgoCD uses a strict `ConfigMap` policy where the `devops-team-group` has isolated sync permissions strictly scoped to the `stockforge-prod-project`.
    *   Kubernetes pods run under a dedicated, unprivileged ServiceAccount (`stockforge-app-sa`) rather than the `default` admin account.

---

## 5. Monitoring & Email Alerting Architecture

Located in `infrastructure/k8s/monitoring/alerts.yaml`.

We utilize the `kube-prometheus-stack` to scrape metrics. The `AlertmanagerConfig` acts as the traffic cop for these metrics and routes them to your team via **Resend SMTP**.

**Configured Alerts:**
1.  **PodCrashLooping**: Triggers if any container restarts repeatedly over a 2-minute window.
2.  **DeploymentFailed**: Triggers if a deployment rollout gets stuck (replicas mismatch) for 5 minutes.
3.  **GitOpsDriftDetected**: Triggers immediately if ArgoCD detects a manual `kubectl` change.
4.  **ClusterNodeUnhealthy**: Triggers if the underlying EC2 instance becomes unresponsive.

*Note: Alertmanager is configured with `sendResolved: true`, meaning it will automatically send a follow-up "Recovery/Success" email once a crash is fixed or a drift is successfully corrected by ArgoCD.*

---

## 6. One-Command Scripts

You have been provided with `.sh` and `.ps1` scripts for both execution and validation.

**Do not run `deploy-all` automatically in CI.** It is meant for the initial bootstrapping of the environment:
1.  Validates CLI dependencies and AWS auth.
2.  Applies Terraform to provision the EC2 infrastructure.
3.  Remotely SSHs into the machine to bootstrap k3s.
4.  Deploys Helm charts (Prometheus) and standard manifests (ArgoCD).
5.  Applies the base GitOps `Application`, which begins pulling your actual workloads.

**`verify-all` scripts** automatically poll the cluster APIs, checking HPA scaling boundaries, querying ArgoCD for Sync Status, and even manually introducing drift (`kubectl scale`) to prove that ArgoCD immediately heals it.
