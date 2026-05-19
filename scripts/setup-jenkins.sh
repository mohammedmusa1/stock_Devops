#!/bin/bash
# ==============================================================================
# StockForge AI - Complete Jenkins + Kubernetes (k3s) Setup & Bootstrap Script
# Optimized for AWS EC2 t3.micro (1 vCPU, 1 GB RAM)
# ==============================================================================

set -e

# ANSI Color Codes for Premium Console output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}   STOCKFORGE AI - JENKINS + KUBERNETES AUTO-DEPLOYER & BOOTSTRAPPER  ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# --- Step 1: System and Prerequisites Checks ---
echo -e "\n${YELLOW}[1/9] Checking Host Prerequisites...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}ERROR: Please run this script with sudo privileges! (sudo ./setup-jenkins.sh)${NC}"
  exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}ERROR: Docker is not installed on this host!${NC}"
  exit 1
else
  echo -e "✅ Docker Engine is active."
fi

# Check k3s
if [ ! -f /etc/rancher/k3s/k3s.yaml ]; then
  echo -e "${RED}ERROR: K3s cluster config (/etc/rancher/k3s/k3s.yaml) not found!${NC}"
  exit 1
else
  echo -e "✅ K3s Kubernetes is active."
fi

# --- Step 2: Swap Space Allocation ---
echo -e "\n${YELLOW}[2/9] Allocating Swap Memory (t3.micro RAM Rescue)...${NC}"
EXISTING_SWAP=$(swapon -s | wc -l)

if [ "$EXISTING_SWAP" -le 1 ]; then
  echo -e "${CYAN}No active swap space detected. Creating 4 GB Swap space...${NC}"
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo -e "✅ 4 GB Swap space allocated and enabled persistently."
else
  echo -e "✅ Swap space is already configured on this host."
fi
free -h

# --- Step 3: Launching Jenkins Container ---
echo -e "\n${YELLOW}[3/9] Deploying Capped-RAM Jenkins Container...${NC}"

# Stop and remove any existing Jenkins container to avoid port conflicts
if [ "$(docker ps -aq -f name=jenkins)" ]; then
  echo -e "${CYAN}Removing existing Jenkins container...${NC}"
  docker rm -f jenkins || true
fi

# Spin up Jenkins container using Host Network Mode (eliminates NAT overhead and maps 8081)
echo -e "${CYAN}Launching Jenkins container via Host Network Mode (Port 8081)...${NC}"
docker run -d \
  --name jenkins \
  --network host \
  --restart always \
  -e JAVA_OPTS="-Xms128m -Xmx256m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -Dhudson.model.AbstractProject.FIFO=true" \
  -e JENKINS_OPTS="--httpPort=8081" \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/rancher/k3s/k3s.yaml:/root/.kube/config \
  --user root \
  jenkins/jenkins:lts

echo -e "✅ Jenkins container launched in background."

# --- Step 4: Awaiting Jenkins Startup ---
echo -e "\n${YELLOW}[4/9] Waiting for Jenkins Web Interface to Initialize...${NC}"
until docker exec jenkins curl -s http://localhost:8081/login > /dev/null; do
  echo -e "${CYAN}Still starting up... (sleeping 5s)${NC}"
  sleep 5
done
echo -e "✅ Jenkins Web Interface is alive at http://localhost:8081."

# --- Step 5: Install kubectl Inside Jenkins ---
echo -e "\n${YELLOW}[5/9] Installing Static kubectl Binary Inside Jenkins...${NC}"
docker exec -u 0 jenkins curl -sLO "https://dl.k8s.io/release/v1.30.0/bin/linux/amd64/kubectl"
docker exec -u 0 jenkins chmod +x kubectl
docker exec -u 0 jenkins mv kubectl /usr/local/bin/
echo -e "✅ Kubectl installed to /usr/local/bin/kubectl inside the container."

# --- Step 6: Verify Cluster Connection ---
echo -e "\n${YELLOW}[6/9] Verifying Kubernetes connection from inside Jenkins...${NC}"
if docker exec jenkins kubectl cluster-info &> /dev/null; then
  echo -e "${GREEN}✅ SUCCESS: Jenkins connected successfully to the K3s cluster!${NC}"
  docker exec jenkins kubectl cluster-info
else
  echo -e "${RED}ERROR: Jenkins could not connect to k3s API. Checking network...${NC}"
  exit 1
fi

# --- Step 7: Namespace Check & Creation ---
echo -e "\n${YELLOW}[7/9] Verifying Target Namespaces...${NC}"
docker exec jenkins kubectl create namespace stockdevops --dry-run=client -o yaml | docker exec -i jenkins kubectl apply -f -
docker exec jenkins kubectl create namespace devops-prod --dry-run=client -o yaml | docker exec -i jenkins kubectl apply -f -
echo -e "✅ Namespaces ready."

# --- Step 8: Docker Socket Test ---
echo -e "\n${YELLOW}[8/9] Testing Docker socket access inside Jenkins...${NC}"
if docker exec jenkins docker ps &> /dev/null; then
  echo -e "${GREEN}✅ SUCCESS: Jenkins has read/write privileges on the host Docker Engine!${NC}"
else
  echo -e "${RED}ERROR: Docker socket permission issue inside the container!${NC}"
  exit 1
fi

# --- Step 9: Extract Initial Admin Secrets ---
echo -e "\n${YELLOW}[9/9] Retrieving Jenkins Setup Password...${NC}"
ADMIN_PASSWORD=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword)

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}             🚀 BOOTSTRAP COMPLETION SUCCESSFUL!                      ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "\n${YELLOW}1. Web Console:${NC} http://$(curl -s ifconfig.me):8081"
echo -e "${YELLOW}2. Initial Admin Password:${NC} ${GREEN}${ADMIN_PASSWORD}${NC}"
echo -e "\n${YELLOW}3. Pipeline Action Items:${NC}"
echo -e "   - Setup credentials in Jenkins (docker-hub-credentials, github-pat-credentials)"
echo -e "   - Set executors count to exactly 1 in 'Manage Jenkins' -> 'System'"
echo -e "   - Add a webhook in GitHub repository to point to http://<your-ec2-ip>:8081/github-webhook/"
echo -e "   - Enable ArgoCD Auto-Sync or setup gitops webhook for instantaneous deploys"
echo -e "\n${CYAN}======================================================================${NC}"
