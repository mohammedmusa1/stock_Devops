#!/bin/bash
# ==============================================================================
# Health Check Verification Script
# Validates cluster status, pod status, resource limits, and service endpoints.
# ==============================================================================

# ANSI Color Codes for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}   STOCKDEVOPS - PLATFORM SYSTEM HEALTH CHECK                         ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Check Docker status
echo -e "\n${YELLOW}[1/5] Checking Docker Service...${NC}"
if systemctl is-active --quiet docker; then
  echo -e "${GREEN}✅ Docker service is active and running.${NC}"
else
  echo -e "${RED}❌ Docker service is NOT running!${NC}"
fi

# Check K3s status
echo -e "\n${YELLOW}[2/5] Checking k3s Kubernetes Service...${NC}"
if systemctl is-active --quiet k3s; then
  echo -e "${GREEN}✅ k3s Kubernetes service is active and running.${NC}"
else
  echo -e "${RED}❌ k3s Kubernetes service is NOT running!${NC}"
fi

# Check Node Resources
echo -e "\n${YELLOW}[3/5] Node Resource Usage Summary...${NC}"
free -h
df -h / | awk 'NR==1 || NR==2'
echo -e "CPU Load Average:" $(uptime | awk -F'load average:' '{ print $2 }')

# Check Kubernetes Pods and Resources
echo -e "\n${YELLOW}[4/5] Checking Pod Status & Resource Consumption...${NC}"
if kubectl cluster-info &> /dev/null; then
  echo -e "${GREEN}Kubectl connection successful.${NC}"
  echo -e "\nFailed/Restarting Pods (if any):"
  kubectl get pods -A | grep -v -E "Running|Completed" || echo "✅ All pods are healthy/running."
  
  echo -e "\nTop RAM Consuming Pods:"
  kubectl top pod -A --sort-by=memory | head -n 10 || echo "Metrics Server initializing..."
else
  echo -e "${RED}❌ Cannot access Kubernetes cluster via kubectl!${NC}"
fi

# Check Service Endpoint Responsiveness
echo -e "\n${YELLOW}[5/5] Checking Service HTTP Endpoint Responsiveness...${NC}"
EC2_IP=$(curl -s ifconfig.me || echo "localhost")

check_endpoint() {
  local name=$1
  local url=$2
  local expected=$3
  local insecure=$4
  
  echo -ne "Checking $name ($url)... "
  
  local curl_opts="-s -o /dev/null -w %{http_code} --connect-timeout 5"
  if [ "$insecure" == "true" ]; then
    curl_opts="$curl_opts -k"
  fi
  
  local status=$(curl $curl_opts "$url" || echo "000")
  
  if [[ "$status" =~ ^($expected)$ ]]; then
    echo -e "${GREEN}✅ UP (HTTP $status)${NC}"
  else
    echo -e "${RED}❌ DOWN (HTTP $status)${NC}"
  fi
}

check_endpoint "Jenkins Dashboard" "http://localhost:30080/login" "200" "false"
check_endpoint "ArgoCD Web Console" "https://localhost:30085" "200" "true"
check_endpoint "Grafana Dashboards" "http://localhost:30030/api/health" "200" "false"
check_endpoint "Prometheus UI" "http://localhost:30090/-/healthy" "200" "false"

echo -e "\n${CYAN}======================================================================${NC}"
echo -e "${GREEN}   Health Check Run Finished.                                         ${NC}"
echo -e "${CYAN}======================================================================${NC}"
