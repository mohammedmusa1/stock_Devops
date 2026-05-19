# CloudCart Pro — Terraform Guide

## What Is Terraform?

**Infrastructure as Code (IaC)** — you define AWS resources in `.tf` files, Terraform creates/updates/destroys them predictably.

**Why not click in console?**
- Reproducible environments (dev = staging = prod structure)
- Version controlled in Git
- Drift detection in CI
- Team collaboration with code review

---

## Project Structure (Planned)

```
infrastructure/terraform/
├── main.tf              # Provider, backend config
├── variables.tf         # Input variables
├── outputs.tf           # Values exported (RDS endpoint, etc.)
├── vpc.tf               # VPC, subnets, IGW, NAT
├── eks.tf               # EKS cluster + node group
├── rds.tf               # PostgreSQL RDS
├── ecr.tf               # Container registries
├── iam.tf               # Roles and policies
└── terraform.tfvars     # Environment-specific values (NOT in Git)
```

---

## Essential Commands

```powershell
cd d:\stockdevops\infrastructure\terraform

# Initialize — downloads AWS provider plugins
terraform init

# Preview changes
terraform plan -var-file=terraform.tfvars

# Apply — creates resources (costs money!)
terraform apply -var-file=terraform.tfvars

# Destroy — removes everything (careful!)
terraform destroy -var-file=terraform.tfvars
```

---

## Remote State (Production Requirement)

Store state in S3 with DynamoDB locking — prevents two people applying at once.

```hcl
terraform {
  backend "s3" {
    bucket         = "cloudcart-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "cloudcart-terraform-locks"
  }
}
```

---

## Key Resources Explained

### `aws_vpc`
Private network. All resources live inside a VPC.

### `aws_subnet`
Subdivision of VPC per Availability Zone. Public subnets have route to Internet Gateway.

### `aws_eks_cluster`
Managed Kubernetes control plane.

### `aws_db_instance`
RDS PostgreSQL — set `publicly_accessible = false`.

### `aws_security_group`
Virtual firewall — only allow required ports between specific groups.

### `aws_iam_role`
Permissions without hardcoded keys — EKS nodes assume roles for ECR pull, CloudWatch logs.

---

## Variable Example

```hcl
# terraform.tfvars (create from terraform.tfvars.example)
aws_region   = "us-east-1"
environment  = "dev"
project_name = "cloudcart-pro"
```

---

## Drift Detection

```bash
terraform plan -detailed-exitcode
# Exit 0 = no changes
# Exit 2 = drift detected (someone changed AWS manually)
```

Use in Jenkins/ArgoCD pipeline to alert when infrastructure doesn't match code.

---

## Cost Warning

Running `terraform apply` for EKS + RDS can cost **$150–300+/month**. Use `terraform destroy` when not actively learning, or use local/minimal dev configs.

---

## Next

After Terraform provisions EKS → [KUBERNETES_GUIDE.md](./KUBERNETES_GUIDE.md)
