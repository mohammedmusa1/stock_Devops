#!/bin/bash
# ==============================================================================
# StockForge AI - Master Kubernetes & GitOps Automated Bootstrapper
# Optimized for AWS EC2 (t3.micro / t3.small / t3.medium / t3.large)
# ==============================================================================

set -e

# ANSI Color Codes for Premium Console output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}   STOCKFORGE AI - MASTER KUBERNETES & GITOPS BOOTSTRAP SYSTEM       ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# --- Step 1: System and Privileges Checks ---
echo -e "\n${YELLOW}[1/9] Checking Host Privileges...${NC}"
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}ERROR: Please run this script with sudo privileges! (sudo ./bootstrap-kubernetes.sh)${NC}"
  exit 1
fi
echo -e "✅ Running with elevated privileges."

# --- Step 2: Swap Space Allocation (RAM Rescue) ---
echo -e "\n${YELLOW}[2/9] Configuring Host Swap Memory (Preventing OOM Crashes)...${NC}"
EXISTING_SWAP=$(swapon -s | wc -l)

if [ "$EXISTING_SWAP" -le 1 ]; then
  echo -e "${CYAN}No active swap space detected. Creating 8 GB Swap space...${NC}"
  dd if=/dev/zero of=/swapfile bs=1M count=8192
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  sysctl -p
  echo -e "✅ 8 GB Swap space allocated and optimized."
else
  echo -e "✅ Swap space is already configured on this host."
fi
free -h

# --- Step 3: Install Host Prerequisites ---
echo -e "\n${YELLOW}[3/9] Installing Package Dependencies...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl software-properties-common git jq unzip wget build-essential

# Install Docker Engine
if ! command -v docker &> /dev/null; then
  echo -e "${CYAN}Installing Docker...${NC}"
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
  add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" -y
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io
  systemctl enable docker
  systemctl start docker
  usermod -aG docker ubuntu
fi
echo -e "✅ Docker Engine is ready."

# Install Helm
if ! command -v helm &> /dev/null; then
  echo -e "${CYAN}Installing Helm...${NC}"
  curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
  chmod 700 get_helm.sh
  ./get_helm.sh
  rm get_helm.sh
fi
echo -e "✅ Helm is ready."

# --- Step 4: Install Lightweight Kubernetes (k3s) ---
echo -e "\n${YELLOW}[4/9] Installing Lightweight Kubernetes (k3s)...${NC}"
if [ ! -f /etc/rancher/k3s/k3s.yaml ]; then
  # Disable Traefik & Metrics-Server to save massive memory resources (using custom monitoring instead)
  curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644 --disable traefik --disable metrics-server
else
  echo -e "✅ K3s is already installed."
fi

mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown -R ubuntu:ubuntu /home/ubuntu/.kube
echo 'export KUBECONFIG=~/.kube/config' >> /home/ubuntu/.bashrc
export KUBECONFIG=/home/ubuntu/.kube/config
echo -e "✅ K3s Cluster active."
kubectl get nodes

# --- Step 5: Namespace Pre-creation ---
echo -e "\n${YELLOW}[5/9] Initializing Target Namespaces...${NC}"
kubectl create namespace argocd || true
kubectl create namespace ci-cd || true
kubectl create namespace monitoring || true
kubectl create namespace devops-prod || true
echo -e "✅ Namespaces initialized."

# --- Step 6: Deploy & Optimize ArgoCD ---
echo -e "\n${YELLOW}[6/9] Deploying ArgoCD Core Engine...${NC}"
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Patch ArgoCD controllers to run under memory limits (critical for small tiers)
echo -e "${CYAN}Applying memory budget patches to ArgoCD controllers...${NC}"
kubectl patch deployment argocd-dex-server -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "128Mi"}, "requests": {"memory": "32Mi"}}}]' || true
kubectl patch deployment argocd-redis -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "64Mi"}, "requests": {"memory": "16Mi"}}}]' || true
kubectl patch deployment argocd-repo-server -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "128Mi"}, "requests": {"memory": "64Mi"}}}]' || true
kubectl patch deployment argocd-server -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "128Mi"}, "requests": {"memory": "64Mi"}}}]' || true
kubectl patch statefulset argocd-application-controller -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "256Mi"}, "requests": {"memory": "128Mi"}}}]' || true
kubectl patch deployment argocd-notifications-controller -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "64Mi"}, "requests": {"memory": "16Mi"}}}]' || true

# Expose ArgoCD dashboard via NodePort 30090
echo -e "${CYAN}Exposing ArgoCD server via NodePort 30090...${NC}"
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort", "ports": [{"port": 80, "targetPort": 8080, "nodePort": 30090}, {"port": 443, "targetPort": 8080, "nodePort": 30091}]}}'

# Install ArgoCD CLI
if ! command -v argocd &> /dev/null; then
  curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
  install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
  rm argocd-linux-amd64
fi
echo -e "✅ ArgoCD successfully configured."

# --- Step 7: Clone GitOps Repository ---
echo -e "\n${YELLOW}[7/9] Cloning GitOps Repository...${NC}"
if [ -d "/home/ubuntu/stock_Devops" ]; then
  rm -rf /home/ubuntu/stock_Devops
fi
git clone https://github.com/mohammedmusa1/stock_Devops.git /home/ubuntu/stock_Devops
chown -R ubuntu:ubuntu /home/ubuntu/stock_Devops
echo -e "✅ GitOps Repository cloned locally."

# --- Step 8: Bootstrap GitOps App-of-Apps Pattern ---
echo -e "\n${YELLOW}[8/9] Bootstrapping GitOps Core & Microservices...${NC}"
# Wait for Application CRD to establish
kubectl wait --for=condition=established --timeout=120s crd/applications.argoproj.io

# Apply root-app which automatically triggers sync of Jenkins, Monitoring, and StockDevOps app
kubectl apply -f /home/ubuntu/stock_Devops/gitops/bootstrap/root-app.yaml
echo -e "✅ Root App-of-Apps applied. Reconciling cluster state..."

# --- Step 9: Post-Deploy Credential Extraction & Verification ---
echo -e "\n${YELLOW}[9/9] Waiting for Secrets Generation and Service Inits...${NC}"
sleep 15

# Fetch EC2 Public IP
EC2_IP=$(curl -s ifconfig.me)

# Retrieve ArgoCD initial Admin password
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

# Retrieve Jenkins Initial Admin Password (since it's a pod in ci-cd, wait for it)
echo "Waiting for Jenkins pod to spin up to extract password..."
sleep 10
JENKINS_POD=""
for i in {1..30}; do
  JENKINS_POD=$(kubectl get pods -n ci-cd -l app=jenkins -o jsonpath="{.items[0].metadata.name}" 2>/dev/null || true)
  if [ -n "$JENKINS_POD" ]; then
    break
  fi
  sleep 5
done

JENKINS_PASSWORD="[Still Initializing - check console later or run: kubectl logs -n ci-cd deployment/jenkins]"
if [ -n "$JENKINS_POD" ]; then
  for i in {1..30}; do
    JENKINS_STATUS=$(kubectl get pod -n ci-cd "$JENKINS_POD" -o jsonpath="{.status.phase}")
    if [ "$JENKINS_STATUS" = "Running" ]; then
      JENKINS_PASSWORD=$(kubectl exec -n ci-cd "$JENKINS_POD" -- cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null || true)
      if [ -n "$JENKINS_PASSWORD" ]; then
        break
      fi
    fi
    sleep 5
  done
fi

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}             🚀 CLUSTER BOOTSTRAP INITIATED SUCCESSFULLY!            ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "\n${CYAN}You can access your consoles at the following URLs:${NC}"
echo -e "${YELLOW}1. ArgoCD GitOps Dashboard:${NC} http://${EC2_IP}:30090"
echo -e "   - Username: admin"
echo -e "   - Password: ${GREEN}${ARGOCD_PASSWORD}${NC}"
echo -e "\n${YELLOW}2. Jenkins CI/CD Console:${NC} http://${EC2_IP}:30080"
echo -e "   - Username: admin"
echo -e "   - Password: ${GREEN}${JENKINS_PASSWORD}${NC}"
echo -e "\n${YELLOW}3. Grafana Monitoring Metrics:${NC} http://${EC2_IP}:30030"
echo -e "   - Username: admin"
echo -e "   - Password: ${GREEN}admin123${NC} (Change on first login)"
echo -e "\n${YELLOW}4. Production Next.js App Web Interface:${NC} http://${EC2_IP}:30000"
echo -e "\n${CYAN}======================================================================${NC}"
echo -e "${GREEN}⭐ HOW TO CONNECT GITHUB WITH JENKINS & ARGOCD:${NC}"
echo -e "1. Visit your GitHub Repository on a browser."
echo -e "2. Go to 'Settings' -> 'Webhooks' -> 'Add webhook'."
echo -e "3. Set the 'Payload URL' to: ${YELLOW}http://${EC2_IP}:30080/github-webhook/${NC}"
echo -e "4. Set 'Content type' to 'application/json' and select 'Just the push event'."
echo -e "5. Click 'Add webhook'. Now pushing to GitHub will instantly trigger builds!"
echo -e "6. Go to ArgoCD and note how the 'selfHeal: true' automatically redeploys pods."
echo -e "${CYAN}======================================================================${NC}"
