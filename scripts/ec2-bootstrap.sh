#!/usr/bin/env bash
# Run ON the Ubuntu 24.04 EC2 instance after SSH login
set -euo pipefail

echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Installing Docker Compose plugin..."
sudo apt-get update -y
sudo apt-get install -y docker-compose-plugin git ufw

echo "==> Firewall (SSH + HTTP + HTTPS only)..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "==> Optional: install k3s (lightweight Kubernetes)..."
read -r -p "Install k3s? [y/N] " INSTALL_K3S
if [[ "${INSTALL_K3S,,}" == "y" ]]; then
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -
  echo "kubectl get nodes"
fi

echo "Done. Log out and back in if docker group was added."
echo "Next: clone repo, copy .env.production, run docker compose -f docker-compose.prod.yml up -d --build"
