# StockDevOps Platform Deployment Guide

This repository contains the complete Infrastructure-as-Code (IaC), GitOps, CI/CD, and monitoring configuration for the **StockDevOps** platform. 

It is designed for a **single-node Kubernetes cluster (k3s)** running on a manually created AWS EC2 instance (e.g. `t3.large` or `c7i-flex.large` with 2 vCPUs and 4GB RAM) running Ubuntu 22.04 LTS.

---

## 🏗️ Architectural Overview

The deployment uses a lightweight, highly optimized, production-ready single-node Kubernetes architecture:

```
                  +-------------------------------------------------+
                  |                 AWS EC2 Instance                |
                  |             (2 vCPU, 4GB RAM, Ubuntu)           |
                  +-------------------------------------------------+
                                           |
                                    [ k3s Container ]
                                           |
    +------------------+-----------+-------+-------+--------------------+
    |                  |           |               |                    |
[ Jenkins ]       [ ArgoCD ]  [ Traefik ]    [ Prometheus ]        [ Grafana ]
(Port 30080)     (Port 30085) (Port 80/443)  (Port 30090)         (Port 30030)
```

### Key Technical Specs & Resource Limits
- **k3s Kubernetes**: Lightweight orchestration engine with built-in Traefik Ingress.
- **Jenkins (CI/CD)**: Bounded JVM (`-Xmx512m`), limited to **768MB RAM**, host-level Docker socket integration for zero-overhead container builds.
- **ArgoCD (GitOps)**: Self-healing, pruning, auto-sync active, dex disabled, limited to **500MB RAM**.
- **Prometheus**: Single replica, **1-day data retention**, limited to **512MB RAM**.
- **Grafana**: Preloaded Kubernetes and Jenkins dashboards, NodePort service exposed, limited to **256MB RAM**.

---

## 📂 Project Structure

```
stockdevops/
├── terraform/                       <-- Terraform Configuration
│   ├── main.tf                      <-- Provisioning null_resource block
│   ├── variables.tf                 <-- Input parameters
│   ├── outputs.tf                   <-- Outputs access URLs
│   ├── providers.tf                 <-- Configures providers
│   ├── versions.tf                  <-- Minimum version requirements
│   └── terraform.tfvars.example     <-- Pre-filled template values
├── kubernetes/                      <-- Core Manifests
│   ├── namespaces.yaml              <-- Namespaces configuration
│   ├── rbac.yaml                    <-- ClusterRoleBindings & SAs
│   └── ingress.yaml                 <-- Traefik Ingress definitions
├── helm/                            <-- Helm Values Configuration
│   ├── jenkins-values.yaml          <-- Optimized Jenkins values
│   ├── argocd-values.yaml           <-- Bounded memory ArgoCD values
│   └── prometheus-values.yaml       <-- Lightweight Prometheus values
├── argocd/                          <-- ArgoCD Bootstrappers
│   ├── root-app.yaml                <-- Main GitOps entrypoint
│   ├── ci-cd-app.yaml               <-- CI/CD (Jenkins) bootstrapper
│   ├── monitoring-app.yaml          <-- Monitoring bootstrapper
│   └── app-app.yaml                 <-- Core Application bootstrapper
├── monitoring/                      <-- Custom Alert Rules
│   └── alerts.yaml                  <-- CrashLoop, Drift, & Node Alerts
├── scripts/                         <-- Automation Scripts
│   ├── setup.sh                     <-- Main remote provisioning script
│   ├── deploy-all.sh                <-- Local manual deploy tool
│   ├── health-check.sh              <-- Endpoint & status validation tool
│   └── verify.sh                    <-- Extracts credentials & debug commands
├── github-actions/                  <-- CI Workflows
│   └── ci-cd-workflow.yaml          <-- GitHub Actions automated build
├── Jenkinsfile                      <-- Root Jenkins Pipeline
└── README.md                        <-- This documentation
```

---

## 🚀 Execution & Deployment Guide

Follow this precise order to provision and configure the entire cluster:

### Step 1: Manually Create the EC2 Instance
1. Launch an AWS EC2 Instance using **Ubuntu 22.04 LTS**.
2. Select instance type: **t3.large** or **c7i-flex.large** (at least 2 vCPUs, 4GB RAM).
3. Associate a public IP address and configure security groups to allow:
   - SSH (Port `22`)
   - HTTP/HTTPS (Ports `80`, `443`)
   - NodePort range for tools: Ports `30000 - 32767` (specifically `30030`, `30080`, `30085`, `30090`)
4. Download your SSH private key `.pem` file to your local computer.

### Step 2: Initialize Terraform Configurations
Navigate to the `terraform/` directory:
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars` with your exact values:
```hcl
ec2_public_ip        = "54.210.12.34" # IP of your created EC2
ssh_private_key_path = "C:/Users/Shaikh Musa/.ssh/stockdevops-default-key.pem"
github_repo          = "https://github.com/your-username/stock_Devops.git"
github_branch        = "main"
dockerhub_username   = "your-dockerhub-username"
dockerhub_token      = "your-dockerhub-token"
```

### Step 3: Run Terraform Apply
Initialize and execute the Terraform configuration to connect to your EC2 instance and bootstrap the components:
```bash
terraform init
terraform apply -auto-approve
```

Terraform will connect to the EC2 server, copy all files, install Docker/k3s/Helm, configure secrets, deploy the apps, and display endpoints.

---

## 🎯 Verification and Health Checks

### Step 4: Extract Credentials
After Terraform apply finishes, SSH into your EC2 instance and run `verify.sh`:
```bash
ssh -i <your-key-path> ubuntu@<ec2-public-ip>
sudo /home/ubuntu/scripts/verify.sh
```
This outputs the exact admin passwords:
- **Jenkins UI (admin)**: Auto-generated random string
- **ArgoCD Dashboard (admin)**: Auto-generated random string
- **Grafana Console (admin)**: `admin123`

### Step 5: Check System Health
Run `health-check.sh` on the EC2 instance to verify all services are active:
```bash
sudo /home/ubuntu/scripts/health-check.sh
```

---

## 🛠️ Access Endpoints
- **Jenkins UI**: `http://<ec2-public-ip>:30080`
- **ArgoCD UI**: `https://<ec2-public-ip>:30085` (Uses self-signed TLS)
- **Grafana Console**: `http://<ec2-public-ip>:30030`
- **Prometheus Console**: `http://<ec2-public-ip>:30090`

---

## 🛑 Troubleshooting Guide
1. **Pod fails to start (CrashLoopBackOff)**:
   View logs of the specific container:
   ```bash
   kubectl logs -n <namespace> -l app=<app-label> --tail=100
   ```
2. **Kubernetes API not responding**:
   Verify that k3s is active:
   ```bash
   sudo systemctl status k3s
   ```
3. **Docker permission issues in Jenkins**:
   Ensure `/var/run/docker.sock` has `666` permissions:
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```
