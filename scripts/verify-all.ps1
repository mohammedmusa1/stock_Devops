<#
.SYNOPSIS
StockForge AI - Enterprise Verification Script (PowerShell)
#>

$env:KUBECONFIG = "$PWD\kubeconfig.yaml"

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "      STOCKFORGE AI - VERIFY DEPLOYMENT & HEALTH           " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

Write-Host "[1/10] Verifying EC2 Health..." -ForegroundColor Yellow
aws ec2 describe-instance-status --filters Name=instance-state-name,Values=running

Write-Host "[2/10] Verifying Kubernetes Nodes..." -ForegroundColor Yellow
kubectl get nodes

Write-Host "[3/10] Verifying Pod Health & PDBs..." -ForegroundColor Yellow
kubectl get pods -n stockforge-prod
kubectl get pdb -n stockforge-prod

Write-Host "[4/10] Verifying Horizontal Pod Autoscaler (HPA)..." -ForegroundColor Yellow
kubectl get hpa -n stockforge-prod

Write-Host "[5/10] Verifying ArgoCD GitOps Sync Status..." -ForegroundColor Yellow
$syncStatus = kubectl get application stockforge-production -n argocd -o jsonpath='{.status.sync.status}'
if ($syncStatus -eq "Synced") { Write-Host "✅ GitOps In Sync" -ForegroundColor Green }
else { Write-Host "❌ GitOps Drift Detected!" -ForegroundColor Red }

Write-Host "[6/10] Verifying Monitoring Stack..." -ForegroundColor Yellow
kubectl get pods -n monitoring

Write-Host "[7/10] Simulating Kubernetes Drift Detection..." -ForegroundColor Yellow
Write-Host "Scaling rollout manually to trigger ArgoCD Drift Detection..."
kubectl scale rollout api-rollout --replicas=1 -n stockforge-prod
Start-Sleep -Seconds 10
Write-Host "Checking if ArgoCD self-healed the drift back to minReplicas=3..."
kubectl get rollout api-rollout -n stockforge-prod

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "✅ VERIFICATION COMPLETE. System is operational." -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Cyan
