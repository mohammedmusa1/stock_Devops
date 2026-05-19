#!/bin/bash
# ==============================================================================
# Deploy All Components Script
# Can be run manually on the cluster to force deploy or check status.
# ==============================================================================

set -e

# ANSI Color Codes for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}   STOCKDEVOPS - FORCE DEPLOY & SYNC ALL SERVICES                    ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Check Kubernetes connectivity
if ! kubectl cluster-info &> /dev/null; then
  echo -e "${RED}ERROR: Cannot connect to Kubernetes cluster! Check config.${NC}"
  exit 1
fi

echo -e "\n${YELLOW}[1/4] Applying Namespaces and RBAC...${NC}"
kubectl apply -f /home/ubuntu/kubernetes/namespaces.yaml
kubectl apply -f /home/ubuntu/kubernetes/rbac.yaml
kubectl apply -f /home/ubuntu/kubernetes/ingress.yaml

echo -e "\n${YELLOW}[2/4] Triggering ArgoCD Sync...${NC}"
# Apply root application if not exists
kubectl apply -f /home/ubuntu/argocd/root-app.yaml

# Try to sync applications via ArgoCD CLI if installed, otherwise output info
if command -v argocd &> /dev/null; then
  echo -e "ArgoCD CLI detected. Logging in and syncing..."
  ARGOCD_ADMIN_PASS=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 --decode)
  argocd login localhost:30085 --username admin --password "$ARGOCD_ADMIN_PASS" --insecure
  argocd app sync stockdevops-root-app || true
  argocd app sync stockdevops-ci-cd || true
  argocd app sync stockdevops-monitoring || true
  argocd app sync stockdevops-core-app || true
else
  echo -e "ArgoCD CLI not installed. Applying app manifests directly to ensure sync..."
  kubectl apply -f /home/ubuntu/argocd/ci-cd-app.yaml
  kubectl apply -f /home/ubuntu/argocd/monitoring-app.yaml
  kubectl apply -f /home/ubuntu/argocd/app-app.yaml
fi

echo -e "\n${YELLOW}[3/4] Verifying Pod Deployment Status...${NC}"
kubectl get pods -A

echo -e "\n${YELLOW}[4/4] Ingress Routes Configuration...${NC}"
kubectl get ingress -A

echo -e "\n${GREEN}✅ Deploy and sync trigger completed.${NC}"
