# CloudCart Pro — AWS Setup Guide

Beginner-friendly guide to every AWS service used in this project.

---

## Before You Start

1. Create an [AWS account](https://aws.amazon.com/)
2. Enable **MFA** on root account — never use root for daily work
3. Create an **IAM admin user** for console/CLI access
4. Install [AWS CLI v2](https://aws.amazon.com/cli/) and run `aws configure`

---

## Core Services

### IAM (Identity and Access Management)

**What:** Users, roles, policies — who can do what in AWS.

**Why:** Never put access keys on EC2; use IAM roles. Least-privilege policies per service.

**CloudCart usage:**
- EKS node role (worker permissions)
- EKS cluster role
- CI/CD user for ECR push
- Cognito authenticated role for S3 uploads

### VPC (Virtual Private Cloud)

**What:** Your private network in AWS — subnets, route tables, internet gateway.

**Why:** Isolate databases from the public internet.

**Typical layout:**
```
VPC 10.0.0.0/16
├── Public subnet 10.0.1.0/24  (ALB, NAT Gateway)
├── Public subnet 10.0.2.0/24  (AZ redundancy)
├── Private subnet 10.0.10.0/24 (EKS nodes)
├── Private subnet 10.0.20.0/24 (RDS, Redis)
```

### EC2 (Elastic Compute Cloud)

**What:** Virtual servers in the cloud.

**Instance types for learning:**
| Type | vCPU | RAM | Use |
|------|------|-----|-----|
| t3.micro | 2 | 1 GB | Free tier test (tight) |
| t3.small | 2 | 2 GB | Step 4 single-server deploy |
| t3.medium | 2 | 4 GB | Comfortable demo |

**Pricing:** ~$15–30/month for t3.small running 24/7 (varies by region).

### EKS (Elastic Kubernetes Service)

**What:** Managed Kubernetes control plane.

**Why:** Auto-healing pods, rolling deploys, HPA — production standard.

**Cost note:** Control plane ~$0.10/hour per cluster + worker EC2 nodes.

### RDS (Relational Database Service)

**What:** Managed PostgreSQL — backups, patches, Multi-AZ.

**Why:** Don't run Postgres on EC2 in production — RDS handles failover.

**Settings for CloudCart:**
- Engine: PostgreSQL 16
- Instance: `db.t3.micro` (dev), `db.t3.medium` (prod)
- Storage: 20GB gp3, autoscaling enabled
- **Public access: NO**

### ECR (Elastic Container Registry)

**What:** Private Docker image registry.

**Why:** EKS pulls images from ECR; Jenkins pushes after build.

```bash
aws ecr create-repository --repository-name cloudcart/backend
docker tag cloudcart-backend:local <account>.dkr.ecr.us-east-1.amazonaws.com/cloudcart/backend:latest
aws ecr get-login-password | docker login ...
docker push ...
```

### S3 (Simple Storage Service)

**What:** Object storage for product images, static exports.

**Buckets:**
- `cloudcart-assets-prod` — product images (CloudFront origin)
- `cloudcart-terraform-state` — Terraform remote state

### CloudFront + ACM + Route53

| Service | Role |
|---------|------|
| **Route53** | DNS — `shop.yourdomain.com` → CloudFront |
| **ACM** | Free SSL certificates |
| **CloudFront** | CDN — caches static assets globally |

### Cognito

**What:** Managed user pools — signup, MFA, Google OAuth, JWT tokens.

**Setup (high level):**
1. Cognito → Create user pool
2. Enable email verification, password policy
3. Add Google as identity provider
4. Create app client (with secret for backend)
5. Copy Pool ID + Client ID to `.env`

### Secrets Manager

**What:** Store API keys, DB passwords — rotated automatically.

**Why:** Never commit secrets to Git; inject into K8s via External Secrets Operator.

### CloudWatch

**What:** Logs, metrics, alarms.

**Alarms to create:**
- EKS pod restart count > 5 in 5 min
- RDS CPU > 80%
- ALB 5xx error rate > 1%

---

## Security Groups (Firewall Rules)

| SG Name | Inbound | Purpose |
|---------|---------|---------|
| alb-sg | 80, 443 from 0.0.0.0/0 | Load balancer |
| eks-node-sg | 443 from control plane | Worker nodes |
| rds-sg | 5432 from eks-node-sg only | Database |

---

## Cost Optimization Tips

1. Stop EC2/RDS when not learning (evenings/weekends)
2. Use `t3` burstable instances for dev
3. Single NAT Gateway in dev (not per-AZ)
4. S3 lifecycle rules for old logs
5. Set billing alarms at $10, $50, $100

---

## Next Steps

After AWS account is ready → [TERRAFORM_GUIDE.md](./TERRAFORM_GUIDE.md) for automated provisioning.
