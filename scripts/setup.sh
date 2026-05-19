#!/bin/bash
# ==============================================================================
# StockDevOps Platform Bootstrap Script
# Automatically configures Docker, k3s Kubernetes, Helm, Jenkins, ArgoCD, and
# Prometheus/Grafana Stack on a single-node host.
# ==============================================================================

set -e

# ANSI Color Codes for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}   STOCKDEVOPS - KUBERNETES & DEVOPS PLATFORM BOOTSTRAPPER            ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}ERROR: Please run this script with sudo privileges! (sudo -E ./setup.sh)${NC}"
  exit 1
fi

# --- 1. SWAP MEMORY CONFIGURATION ---
echo -e "\n${YELLOW}[1/10] Configuring Swap Space (4GB for stability)...${NC}"
EXISTING_SWAP=$(swapon -s | wc -l)
if [ "$EXISTING_SWAP" -le 1 ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo -e "${GREEN}✅ Swap space created and configured successfully.${NC}"
else
  echo -e "${GREEN}✅ Swap space already exists.${NC}"
fi
free -h

# --- 2. INSTALL DOCKER ENGINE ---
echo -e "\n${YELLOW}[2/10] Installing Docker Engine...${NC}"
if ! command -v docker &> /dev/null; then
  apt-get update -y
  apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io
  echo -e "${GREEN}✅ Docker Engine installed.${NC}"
else
  echo -e "${GREEN}✅ Docker Engine already installed.${NC}"
fi

# Configure Docker permissions for default ubuntu user
usermod -aG docker ubuntu || true
chmod 666 /var/run/docker.sock || true
echo -e "${GREEN}✅ Docker socket permissions configured.${NC}"

# --- 3. INSTALL K3S KUBERNETES ---
echo -e "\n${YELLOW}[3/10] Installing k3s Kubernetes Cluster...${NC}"
if [ ! -f /usr/local/bin/k3s ]; then
  # Install k3s, keeping the built-in Traefik ingress controller active
  curl -sfL https://get.k3s.io | sh -
  echo -e "${GREEN}✅ k3s Kubernetes installed successfully.${NC}"
else
  echo -e "${GREEN}✅ k3s Kubernetes is already running.${NC}"
fi

# Configure kubectl for ubuntu user
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown -R ubuntu:ubuntu /home/ubuntu/.kube
chmod 600 /home/ubuntu/.kube/config
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
echo -e "${GREEN}✅ Kubeconfig configured for user 'ubuntu'.${NC}"

# --- 4. INSTALL HELM ---
echo -e "\n${YELLOW}[4/10] Installing Helm...${NC}"
if ! command -v helm &> /dev/null; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  echo -e "${GREEN}✅ Helm installed successfully.${NC}"
else
  echo -e "${GREEN}✅ Helm already installed.${NC}"
fi

# --- 5. INITIALIZE NAMESPACES AND SECRETS ---
echo -e "\n${YELLOW}[5/10] Creating Kubernetes Namespaces & Secrets...${NC}"
kubectl apply -f /home/ubuntu/kubernetes/namespaces.yaml
kubectl apply -f /home/ubuntu/kubernetes/rbac.yaml

# Create Docker Hub credentials secret in ci-cd and devops-prod namespaces
kubectl create secret generic docker-hub-credentials -n ci-cd \
  --from-literal=username="$DOCKERHUB_USERNAME" \
  --from-literal=password="$DOCKERHUB_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret docker-registry dockerhub-registry -n devops-prod \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username="$DOCKERHUB_USERNAME" \
  --docker-password="$DOCKERHUB_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

# Create GitHub credentials secret for Jenkins
kubectl create secret generic github-pat-credentials -n ci-cd \
  --from-literal=username="git" \
  --from-literal=password="$DOCKERHUB_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✅ Namespaces and credentials secrets established.${NC}"

# --- 6. DEPLOY ARGOCD VIA HELM ---
echo -e "\n${YELLOW}[6/10] Deploying ArgoCD (Lightweight, single-replica)...${NC}"
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm upgrade --install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  -f /home/ubuntu/helm/argocd-values.yaml
echo -e "${GREEN}✅ ArgoCD deployed.${NC}"

# --- 7. DEPLOY KUBE-PROMETHEUS-STACK ---
echo -e "\n${YELLOW}[7/10] Deploying Prometheus & Grafana (kube-prometheus-stack)...${NC}"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  -f /home/ubuntu/helm/prometheus-values.yaml
echo -e "${GREEN}✅ Prometheus & Grafana deployed.${NC}"

# --- 8. DEPLOY JENKINS VIA HELM ---
echo -e "\n${YELLOW}[8/10] Deploying Jenkins (Lightweight, persistence enabled)...${NC}"
helm repo add jenkins https://charts.jenkins.io
helm repo update
helm upgrade --install jenkins jenkins/jenkins \
  --namespace ci-cd \
  --create-namespace \
  -f /home/ubuntu/helm/jenkins-values.yaml
echo -e "${GREEN}✅ Jenkins deployed.${NC}"

# --- 9. CONFIGURE GITOPS REPO TARGETS ---
echo -e "\n${YELLOW}[9/10] Parameterizing ArgoCD Bootstrappers with Target Repository...${NC}"
# Update target repo and branch in all gitops/bootstrap files
find /home/ubuntu/gitops/bootstrap/ -type f -name "*.yaml" -exec sed -i "s|https://github.com/mohammedmusa1/stock_Devops.git|${GITHUB_REPO}|g" {} +
find /home/ubuntu/gitops/bootstrap/ -type f -name "*.yaml" -exec sed -i "s|targetRevision: HEAD|targetRevision: ${GITHUB_BRANCH}|g" {} +
find /home/ubuntu/gitops/bootstrap/ -type f -name "*.yaml" -exec sed -i "s|targetRevision: main|targetRevision: ${GITHUB_BRANCH}|g" {} +

# Update target repo and branch in argocd directory files
find /home/ubuntu/argocd/ -type f -name "*.yaml" -exec sed -i "s|https://github.com/mohammedmusa1/stock_Devops.git|${GITHUB_REPO}|g" {} +
find /home/ubuntu/argocd/ -type f -name "*.yaml" -exec sed -i "s|targetRevision: HEAD|targetRevision: ${GITHUB_BRANCH}|g" {} +
find /home/ubuntu/argocd/ -type f -name "*.yaml" -exec sed -i "s|targetRevision: main|targetRevision: ${GITHUB_BRANCH}|g" {} +

# Re-copy bootstrap files to /home/ubuntu/gitops/bootstrap to make sure everything matches
cp /home/ubuntu/argocd/*.yaml /home/ubuntu/gitops/bootstrap/ || true

echo -e "${GREEN}✅ GitOps configuration parameterized dynamically to repo: ${GITHUB_REPO} [${GITHUB_BRANCH}]${NC}"

# --- 10. BOOTSTRAP GITOPS LOOP ---
echo -e "\n${YELLOW}[10/10] Applying ArgoCD Root Application (Bootstrap GitOps)...${NC}"
kubectl apply -f /home/ubuntu/argocd/root-app.yaml
echo -e "${GREEN}✅ Root application applied. ArgoCD GitOps synchronizing...${NC}"

# Wait for Jenkins & ArgoCD pods to initialize to display credentials
echo -e "\n${YELLOW}Waiting for pods to warm up... (30 seconds)${NC}"
sleep 30

# Retrieve admin passwords
ARGOCD_ADMIN_PASS=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 --decode)
JENKINS_ADMIN_PASS=$(kubectl -n ci-cd get secret jenkins -o jsonpath="{.data.jenkins-admin-password}" | base64 --decode)

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}             🎉 PLATFORM BOOTSTRAP COMPLETION SUCCESSFUL!              ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "\n${YELLOW}Access Endpoints:${NC}"
echo -e "   - Jenkins Dashboard:      http://${EC2_PUBLIC_IP}:30080"
echo -e "   - ArgoCD UI:              https://${EC2_PUBLIC_IP}:30085"
echo -e "   - Grafana Dashboards:     http://${EC2_PUBLIC_IP}:30030"
echo -e "   - Prometheus Console:     http://${EC2_PUBLIC_IP}:30090"
echo -e "\n${YELLOW}Credentials:${NC}"
echo -e "   - Jenkins Username:       admin"
echo -e "   - Jenkins Password:       ${GREEN}${JENKINS_ADMIN_PASS}${NC}"
echo -e "   - ArgoCD Username:        admin"
echo -e "   - ArgoCD Password:        ${GREEN}${ARGOCD_ADMIN_PASS}${NC}"
echo -e "   - Grafana Username:       admin"
echo -e "   - Grafana Password:       ${GREEN}admin123${NC}"
echo -e "\n${CYAN}======================================================================${NC}"
