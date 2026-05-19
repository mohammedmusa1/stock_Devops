#!/bin/bash
# ==============================================================================
# Platform Verification and Access Helper Script
# Extracts credentials and lists useful diagnostic commands.
# ==============================================================================

# ANSI Color Codes for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}   STOCKDEVOPS - PLATFORM VERIFICATION & ACCESS CREDENTIALS           ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Check Kubernetes connectivity
if ! kubectl cluster-info &> /dev/null; then
  echo -e "${RED}ERROR: Cannot connect to Kubernetes cluster! Check config.${NC}"
  exit 1
fi

EC2_IP=$(curl -s ifconfig.me || echo "<ec2-public-ip>")

# Extract admin passwords
echo -e "\n${YELLOW}Extracting Credentials...${NC}"
ARGOCD_ADMIN_PASS=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 --decode 2>/dev/null || echo "Secret not generated yet")
JENKINS_ADMIN_PASS=$(kubectl -n ci-cd get secret jenkins -o jsonpath="{.data.jenkins-admin-password}" | base64 --decode 2>/dev/null || echo "Secret not generated yet")

echo -e "\n${CYAN}Access URLs:${NC}"
echo -e "   - Jenkins Dashboard:      http://${EC2_IP}:30080"
echo -e "   - ArgoCD UI:              https://${EC2_IP}:30085"
echo -e "   - Grafana Dashboards:     http://${EC2_IP}:30030"
echo -e "   - Prometheus Console:     http://${EC2_IP}:30090"

echo -e "\n${CYAN}Usernames & Passwords:${NC}"
echo -e "   - Jenkins Username:       admin"
echo -e "   - Jenkins Password:       ${GREEN}${JENKINS_ADMIN_PASS}${NC}"
echo -e "   - ArgoCD Username:        admin"
echo -e "   - ArgoCD Password:        ${GREEN}${ARGOCD_ADMIN_PASS}${NC}"
echo -e "   - Grafana Username:       admin"
echo -e "   - Grafana Password:       ${GREEN}admin123${NC}"

echo -e "\n${YELLOW}Useful Troubleshooting Commands:${NC}"
echo -e "   - View all pods status:   ${CYAN}kubectl get pods -A${NC}"
echo -e "   - View Jenkins logs:      ${CYAN}kubectl logs -n ci-cd -l app.kubernetes.io/name=jenkins -c jenkins --tail=100 -f${NC}"
echo -e "   - View ArgoCD logs:       ${CYAN}kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server --tail=100 -f${NC}"
echo -e "   - View Ingress routing:   ${CYAN}kubectl get ingress -n devops-prod${NC}"
echo -e "   - Check node memory:      ${CYAN}free -h${NC}"
echo -e "   - Check pod RAM metrics:  ${CYAN}kubectl top pod -A${NC}"

echo -e "\n${CYAN}======================================================================${NC}"
