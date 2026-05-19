# StockForge AI - Enterprise Deployment Guide

This guide details the complete productionization of StockForge AI into an AWS Free-Tier / low-cost environment using modern DevOps practices. 

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: AWS EC2 Setup & Terraform](#2-phase-1-aws-ec2-setup--terraform)
3. [Phase 2: Docker & Docker Compose Local/Remote Deployment](#3-phase-2-docker--docker-compose-deployment)
4. [Phase 3: Domain Setup & Let's Encrypt (HTTPS)](#4-phase-3-domain-setup--https)
5. [Phase 4: k3s Kubernetes Migration](#5-phase-4-k3s-kubernetes-migration)
6. [Phase 5: GitOps with ArgoCD & Jenkins](#6-phase-5-gitops-with-argocd--jenkins)
7. [Phase 6: Monitoring & Logging (Prometheus, Grafana, Loki, Alertmanager)](#7-phase-6-monitoring--logging)

---

## 1. Architecture Overview
**StockForge AI** uses a microservices-style monolithic architecture deployed initially via Docker Compose, and later migrated to Kubernetes (k3s for low cost/resource usage). 
- **Frontend (Next.js)**: Runs on port `3000`. Optimized with `standalone` builds.
- **Backend (NestJS + Prisma)**: Runs on port `4000`. Connected to Postgres and Redis.
- **Nginx Reverse Proxy**: Entry point on port `80`/`443`. Routes `/api` to Backend and `/` to Frontend.
- **Postgres (16)**: Persistent relational data.
- **Redis (7)**: Cache and WebSocket Pub/Sub state.

---

## 2. Phase 1: AWS EC2 Setup & Terraform

We will use Terraform to predictably provision our AWS Free Tier (t2.micro / t3.micro) EC2 instance and Security Groups.

### `main.tf`
Create a `terraform/main.tf` file locally:

```hcl
provider "aws" {
  region = "us-east-1"
}

# 1. Generate SSH Key Pair
resource "tls_private_key" "stockforge_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}
resource "aws_key_pair" "stockforge_aws_key" {
  key_name   = "stockforge-prod-key"
  public_key = tls_private_key.stockforge_key.public_key_openssh
}

# 2. Security Group for Web and SSH
resource "aws_security_group" "stockforge_sg" {
  name        = "stockforge-sg"
  description = "Allow SSH, HTTP, and HTTPS"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # In production, restrict to your IP
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 3. Provision the Free-Tier EC2 Instance (Ubuntu 22.04 LTS)
resource "aws_instance" "stockforge_app" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS in us-east-1
  instance_type = "t3.micro" # Free tier eligible
  key_name      = aws_key_pair.stockforge_aws_key.key_name
  security_groups = [aws_security_group.stockforge_sg.name]
  
  root_block_device {
    volume_size = 30 # Max free tier EBS storage
    volume_type = "gp3"
  }

  tags = {
    Name = "StockForge-Prod"
  }
}

output "public_ip" {
  value = aws_instance.stockforge_app.public_ip
}
output "private_key" {
  value = tls_private_key.stockforge_key.private_key_pem
  sensitive = true
}
```

### Terraform Deployment Steps:
1. `terraform init` - Initializes the AWS provider plugin.
2. `terraform apply` - Provisions the EC2 instance and security group.
3. `terraform output -raw private_key > stockforge-prod-key.pem` - Saves the generated SSH key.
4. `chmod 400 stockforge-prod-key.pem` - Secures the key.
5. `ssh -i stockforge-prod-key.pem ubuntu@$(terraform output -raw public_ip)` - Connects to the server.

---

## 3. Phase 2: Docker & Docker Compose Deployment

Once SSH'd into the EC2 instance, install Docker and run the stack.

### Docker Install Commands:
```bash
# Update OS and install prerequisites
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repo
echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable non-root docker usage for ubuntu user
sudo usermod -aG docker ubuntu
```

### Deploying the Application:
```bash
# 1. Clone repository (Assuming Github SSH keys are set up)
git clone https://github.com/your-org/stockforge.git
cd stockforge

# 2. Setup Production Environment variables
cp .env.production.example .env.production
nano .env.production # Configure DB passwords, JWT secrets, Resend API key

# 3. Spin up Production Stack
# This uses our newly generated Multi-stage Dockerfiles and Nginx setup.
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## 4. Phase 3: Domain Setup & HTTPS

We will use **Certbot** for Let's Encrypt SSL certificates.

1. **DNS**: Point your domain `A Record` to the EC2 Public IP.
2. **Install Certbot**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```
3. **Temporarily Stop Docker Nginx to bind port 80**:
   ```bash
   docker compose stop nginx
   ```
4. **Generate Certificate**:
   ```bash
   sudo certbot certonly --standalone -d stockforge.yourdomain.com
   ```
5. **Update Nginx config to mount SSL**:
   Modify `docker-compose.prod.yml` to mount certificates:
   ```yaml
     nginx:
       volumes:
         - ./infrastructure/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
         - /etc/letsencrypt/live/stockforge.yourdomain.com/fullchain.pem:/etc/ssl/certs/fullchain.pem:ro
         - /etc/letsencrypt/live/stockforge.yourdomain.com/privkey.pem:/etc/ssl/certs/privkey.pem:ro
   ```
   Add port `443` listen directives in `nginx.conf` and restart.

---

## 5. Phase 4: k3s Kubernetes Migration

For Enterprise scalability (Self-healing, Auto-scaling), we migrate from Docker Compose to **k3s**.

### Install k3s (Lightweight Kubernetes)
```bash
curl -sfL https://get.k3s.io | sh -
# Wait for node to be ready
sudo k3s kubectl get nodes
```

### Infrastructure Code (`kubernetes/stockforge.yml`):
```yaml
# 1. Secrets Management
apiVersion: v1
kind: Secret
metadata:
  name: stockforge-secrets
type: Opaque
stringData:
  POSTGRES_PASSWORD: "strong-prod-password"
  JWT_ACCESS_SECRET: "your-jwt-secret"
  RESEND_API_KEY: "re_your_api_key"

---
# 2. Persistent Storage for Postgres
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi

---
# 3. Backend Deployment (NestJS)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deployment
spec:
  replicas: 2 # Scale up
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: stockforge/api:latest
          ports:
            - containerPort: 4000
          envFrom:
            - secretRef:
                name: stockforge-secrets
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 4000
            initialDelaySeconds: 15
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 4000
            initialDelaySeconds: 30
            periodSeconds: 15

---
# 4. Frontend Deployment (Next.js)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deployment
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: stockforge/web:latest
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 10

---
# 5. Services & Ingress Route (Traefik - Built into k3s)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: stockforge-ingress
spec:
  rules:
  - host: stockforge.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 4000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 3000
```
**Apply the configuration:** `kubectl apply -f kubernetes/stockforge.yml`

---

## 6. Phase 5: GitOps with ArgoCD & Jenkins

### Jenkins (CI)
- Configured to poll the GitHub repository.
- **Jenkinsfile Pipeline Steps:**
  1. `npm run test` (Unit/Integration testing)
  2. `docker build -t yourregistry/stockforge-api:$BUILD_NUMBER`
  3. `docker push yourregistry/stockforge-api:$BUILD_NUMBER`
  4. Commits new image tag to the config repository.

### ArgoCD (CD)
- ArgoCD monitors the config repository.
- Once Jenkins updates the image tag in `stockforge.yml`, ArgoCD automatically syncs and applies the state to k3s.
- Features automatic rollback if the new pods fail the `readinessProbe` healthchecks.

---

## 7. Phase 6: Monitoring & Logging

Enterprise applications require deep observability.

1. **Prometheus + Grafana**: 
   - Helm is used to install `kube-prometheus-stack`.
   - Grafana visualizes NestJS API request rates, Postgres DB connection pools, and Node CPU/Memory.
2. **Loki Logging**:
   - Replaces ELK for lower cost. Promtail ships all container `stdout` (JSON structured logs from Winston in NestJS) directly to Loki.
3. **Alertmanager**:
   - Connected to Prometheus.
   - **Rules**:
     - `PodCrashLoopBackOff`: If any pod crashes > 3 times in 10 mins.
     - `HighCPUUsage`: If instance CPU > 90% for 5 mins.
   - **Email Config**:
     Sends SMTP emails via Resend.
   - **Cronjob 12-Hour Reports**:
     A Kubernetes CronJob configured to query Prometheus every 12 hours and send a summary email of uptime, error rates, and peak usage.

```yaml
# Alertmanager Email Config snippet
receivers:
- name: 'devops-team-email'
  email_configs:
  - to: 'admin@stockforge.com'
    from: 'alerts@stockforge.com'
    smarthost: 'smtp.resend.com:465'
    auth_username: 'resend'
    auth_password: '<RESEND_API_KEY>'
```

## Conclusion
This complete lifecycle—from robust local Docker environments to secure, self-healing Kubernetes GitOps setups—ensures StockForge AI operates like an elite Tier-1 Fintech SaaS while maximizing the AWS Free Tier limitations.
