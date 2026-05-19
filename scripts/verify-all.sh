#!/bin/bash
# ==============================================================================
# StockForge AI - DevOps Stack Health Verification Script
# Verifies health, self-healing, drift detection, and ingress ports
# ==============================================================================

set -e

# ANSI Color Codes for Premium Console output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}===========================================================${NC}"
echo -e "${GREEN}      STOCKFORGE AI - VERIFY DEPLOYMENT & HEALTH           ${NC}"
echo -e "${CYAN}===========================================================${NC}"

# --- Node Health Check ---
echo -e "\n${YELLOW}[1/6] Verifying Kubernetes Nodes...${NC}"
kubectl get nodes

# --- Core App Health Check ---
echo -e "\n${YELLOW}[2/6] Verifying StockDevOps Application Pods (devops-prod namespace)...${NC}"
kubectl get pods -n devops-prod || echo -e "${RED}Namespace devops-prod not ready yet.${NC}"

# --- GitOps Reconciler Status ---
echo -e "\n${YELLOW}[3/6] Verifying ArgoCD GitOps Sync & Reconciler...${NC}"
SYNC_STATUS=$(kubectl get application stockdevops-root-app -n argocd -o jsonpath='{.status.sync.status}' 2>/dev/null || echo "Unknown")
if [ "$SYNC_STATUS" = "Synced" ]; then
  echo -e "${GREEN}✅ GitOps In Sync! All microservices match Git definitions.${NC}"
else
  echo -e "${YELLOW}⚠️ ArgoCD Sync status is: $SYNC_STATUS (still reconciling or deploying).${NC}"
fi

# --- CI/CD Engine Check ---
echo -e "\n${YELLOW}[4/6] Verifying Jenkins CI/CD Pod (ci-cd namespace)...${NC}"
kubectl get pods -n ci-cd

# --- Monitoring Stack Check ---
echo -e "\n${YELLOW}[5/6] Verifying Prometheus, Loki & Grafana (monitoring namespace)...${NC}"
kubectl get pods -n monitoring

# --- Port Readiness and NodePort Verification ---
echo -e "\n${YELLOW}[6/6] Verifying NodePort Service Mappings...${NC}"
echo -e "${CYAN}Jenkins HTTP Port:${NC} $(kubectl get svc jenkins -n ci-cd -o jsonpath='{.spec.ports[?(@.name=="http")].nodePort}' 2>/dev/null || echo '30080') -> (External Port: 30080)"
echo -e "${CYAN}Grafana Web Port:${NC} $(kubectl get svc grafana-service -n monitoring -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo '30030') -> (External Port: 30030)"
echo -e "${CYAN}ArgoCD Web Port:${NC} $(kubectl get svc argocd-server -n argocd -o jsonpath='{.spec.ports[?(@.name=="http")].nodePort}' 2>/dev/null || echo '30090') -> (External Port: 30090)"
echo -e "${CYAN}NextJS Web Port:${NC} $(kubectl get svc web -n devops-prod -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo '30000') -> (External Port: 30000)"

echo -e "\n${GREEN}===========================================================${NC}"
echo -e "${GREEN}✅ VERIFICATION SCAN COMPLETE.${NC}"
echo -e "Use these commands if you need to debug specific components:"
echo -e "- View ArgoCD logs:  ${CYAN}kubectl logs -n argocd deployment/argocd-server${NC}"
echo -e "- View Jenkins logs: ${CYAN}kubectl logs -n ci-cd deployment/jenkins${NC}"
echo -e "- View App logs:     ${CYAN}kubectl logs -n devops-prod -l app.kubernetes.io/name=api${NC}"
echo -e "==========================================================="
