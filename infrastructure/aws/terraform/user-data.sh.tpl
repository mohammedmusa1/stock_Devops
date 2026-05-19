#!/bin/bash
set -eux
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y ca-certificates curl git ufw

# Basic firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

# Docker Compose plugin
apt-get install -y docker-compose-plugin

# k3s (lightweight Kubernetes) — optional; disable if using Docker Compose only
# curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -

echo "${project_name} bootstrap complete" > /var/log/namestock-bootstrap.log
