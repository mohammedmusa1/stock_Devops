#!/bin/bash
set -e

# Logging all outputs to userdata.log
exec > >(tee /var/log/userdata.log|logger -t userdata -s 2>/dev/console) 2>&1

echo "Starting bootstrapping for StockDevOps (Lightweight Free Tier)..."

# 1. Create Swap File (4GB) to avoid OOM on 1GB RAM t3.micro
echo "Creating swap file..."
dd if=/dev/zero of=/swapfile bs=1M count=4096
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

# Update and install dependencies
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y apt-transport-https ca-certificates curl software-properties-common git jq unzip wget

# Install Docker
echo "Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" -y
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# Install Docker Compose
echo "Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install k3s (Lightweight Kubernetes, optimized with disabled Traefik & Metrics Server)
echo "Installing k3s..."
curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644 --disable traefik --disable metrics-server
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown -R ubuntu:ubuntu /home/ubuntu/.kube
echo 'export KUBECONFIG=~/.kube/config' >> /home/ubuntu/.bashrc

# Wait for k3s to be ready
echo "Waiting for k3s to be ready..."
sleep 15

# Install Helm
echo "Installing Helm..."
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

# Install ArgoCD (GitOps)
echo "Installing ArgoCD..."
kubectl create namespace argocd || true
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD deployments to be created
echo "Waiting for ArgoCD components..."
sleep 15

# Optimize ArgoCD for low-memory environments (t3.micro)
echo "Optimizing ArgoCD deployments..."
kubectl patch deployment argocd-dex-server -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "128Mi"}, "requests": {"memory": "32Mi"}}}]' || true
kubectl patch deployment argocd-redis -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "64Mi"}, "requests": {"memory": "16Mi"}}}]' || true
kubectl patch deployment argocd-repo-server -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "128Mi"}, "requests": {"memory": "64Mi"}}}]' || true
kubectl patch deployment argocd-server -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "128Mi"}, "requests": {"memory": "64Mi"}}}]' || true
kubectl patch statefulset argocd-application-controller -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "256Mi"}, "requests": {"memory": "128Mi"}}}]' || true
kubectl patch deployment argocd-notifications-controller -n argocd --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources", "value": {"limits": {"memory": "64Mi"}, "requests": {"memory": "16Mi"}}}]' || true

# Install ArgoCD CLI
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64

# Install Jenkins (via Docker) - Pre-configured with Low-Memory limits
echo "Installing lightweight Jenkins..."
mkdir -p /home/ubuntu/jenkins_home
chown -R 1000:1000 /home/ubuntu/jenkins_home
docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v /home/ubuntu/jenkins_home:/var/jenkins_home \
  -e JAVA_OPTS="-Xms128m -Xmx256m -XX:MaxRAMPercentage=50.0" \
  --restart always \
  jenkins/jenkins:lts

# Install AWS CLI
echo "Installing AWS CLI..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

echo "Bootstrapping complete!"
