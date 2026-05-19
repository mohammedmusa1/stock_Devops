<#
.SYNOPSIS
StockForge AI - Enterprise One-Command Deployment Script (PowerShell)
DO NOT RUN AUTOMATICALLY - meant for manual execution
#>

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "   STOCKFORGE AI - ENTERPRISE GITOPS DEPLOYMENT (PS1)      " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

# 1-5. Validate Environment & Credentials
Write-Host "[1/20] Validating Environment..." -ForegroundColor Yellow
$commands = @("aws", "docker", "kubectl", "terraform")
foreach ($cmd in $commands) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "$cmd is required but not installed. Aborting."
        exit 1
    }
}
try { aws sts get-caller-identity > $null } catch { Write-Error "AWS credentials not valid."; exit 1 }
Write-Host "✅ Environment Validated." -ForegroundColor Green

# 6-7. Provision AWS Infrastructure
Write-Host "[6/20] Provisioning AWS Infrastructure with Terraform..." -ForegroundColor Yellow
Set-Location infrastructure/terraform
terraform init
terraform apply -auto-approve
$CLUSTER_IP = terraform output -raw cluster_ip
terraform output -raw private_key > stockforge-key.pem
icacls.exe stockforge-key.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"
Write-Host "✅ EC2 Created. IP: $CLUSTER_IP" -ForegroundColor Green
Set-Location ../..

# 8-9. Install and Configure Kubernetes (k3s) via SSH
Write-Host "[8/20] Installing k3s Kubernetes on EC2..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i infrastructure/terraform/stockforge-key.pem ubuntu@$CLUSTER_IP "curl -sfL https://get.k3s.io | sh -"
Write-Host "✅ Kubernetes Configured." -ForegroundColor Green

# 10. Fetch Kubeconfig
Write-Host "[10/20] Fetching Kubeconfig..." -ForegroundColor Yellow
ssh -i infrastructure/terraform/stockforge-key.pem ubuntu@$CLUSTER_IP "sudo cat /etc/rancher/k3s/k3s.yaml" | ForEach-Object { $_ -replace '127.0.0.1', $CLUSTER_IP } > kubeconfig.yaml
$env:KUBECONFIG = "$PWD\kubeconfig.yaml"

# 11-17. Deploy Tooling
Write-Host "[11/20] Deploying Monitoring and ArgoCD..." -ForegroundColor Yellow
kubectl create namespace monitoring
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring
kubectl apply -f infrastructure/k8s/monitoring/alerts.yaml

kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

Write-Host "[13/20] Configuring GitOps & Drift Detection..." -ForegroundColor Yellow
kubectl apply -f infrastructure/k8s/argocd/stockforge-gitops.yaml

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "✅ ENTERPRISE DEPLOYMENT INITIATED SUCCESSFULLY" -ForegroundColor Green
Write-Host "ArgoCD is now reconciling the cluster state from Git." -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
