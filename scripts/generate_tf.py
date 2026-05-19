import os

base_dir = r"d:\stockdevops\infrastructure\terraform"

files = {
    "versions.tf": """terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}
""",
    "provider.tf": """provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = terraform.workspace
      ManagedBy   = "Terraform"
      Owner       = "DevOpsTeam"
    }
  }
}
""",
    "backend.tf": """terraform {
  backend "s3" {
    # NOTE: You must create the S3 bucket and DynamoDB table first.
    # To do that, comment out this backend block, run init/apply, 
    # then uncomment and run terraform init -migrate-state
    bucket         = "stockforge-terraform-state-prod"
    key            = "stockforge/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "stockforge-terraform-locks"
  }
}
""",
    "variables.tf": """variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "stockdevops"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  description = "List of public subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnets" {
  description = "List of private subnet CIDRs"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "allowed_ssh_ip" {
  description = "IP address allowed to SSH into the instances (Format: x.x.x.x/32)"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}
""",
    "terraform.tfvars": """aws_region       = "us-east-1"
project_name     = "stockdevops"
vpc_cidr         = "10.0.0.0/16"
public_subnets   = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnets  = ["10.0.10.0/24", "10.0.20.0/24"]
allowed_ssh_ip   = "0.0.0.0/0" # WARNING: Change this to your actual IP address like "203.0.113.1/32" for production
instance_type    = "t3.medium"
""",
    "locals.tf": """locals {
  name_prefix = "${var.project_name}-${terraform.workspace}"
  common_tags = {
    Project     = var.project_name
    Environment = terraform.workspace
  }
}
""",
    "data.tf": """data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}
""",
    "networking.tf": """module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  vpc_cidr           = var.vpc_cidr
  public_subnets     = var.public_subnets
  private_subnets    = var.private_subnets
  availability_zones = data.aws_availability_zones.available.names
}
""",
    "security.tf": """module "security" {
  source = "./modules/security"

  project_name   = var.project_name
  vpc_id         = module.vpc.vpc_id
  allowed_ssh_ip = var.allowed_ssh_ip
}
""",
    "iam.tf": """resource "aws_iam_role" "ec2_role" {
  name = "${local.name_prefix}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${local.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}
""",
    "ec2.tf": """# SSH Key Pair
resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "app" {
  key_name   = "${local.name_prefix}-key"
  public_key = tls_private_key.ssh.public_key_openssh
}

resource "local_sensitive_file" "private_key" {
  content         = tls_private_key.ssh.private_key_pem
  filename        = "${path.module}/${local.name_prefix}-key.pem"
  file_permission = "0400"
}

module "ec2" {
  source = "./modules/ec2"

  project_name        = var.project_name
  instance_type       = var.instance_type
  ami_id              = data.aws_ami.ubuntu.id
  subnet_id           = module.vpc.public_subnet_ids[0]
  security_group_id   = module.security.app_sg_id
  key_name            = aws_key_pair.app.key_name
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name
  user_data           = file("${path.module}/userdata.sh")
}
""",
    "outputs.tf": """output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_ip" {
  description = "The public IP of the EC2 instance"
  value       = module.ec2.public_ip
}

output "ssh_command" {
  description = "Command to SSH into the EC2 instance"
  value       = "ssh -i ${local.name_prefix}-key.pem ubuntu@${module.ec2.public_ip}"
}
""",
    "main.tf": """# S3 Bucket and DynamoDB table for Terraform Backend (Bootstrap)
# NOTE: These resources must be created BEFORE the backend can be used.
# You can run `terraform apply -target=aws_s3_bucket.terraform_state -target=aws_s3_bucket_versioning.terraform_state_versioning -target=aws_s3_bucket_server_side_encryption_configuration.terraform_state_encryption -target=aws_dynamodb_table.terraform_locks`
# without the backend configured first, and then configure the backend.

resource "aws_s3_bucket" "terraform_state" {
  bucket        = "stockforge-terraform-state-prod" # Ensure this is globally unique
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "terraform_state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_encryption" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "stockforge-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
""",
    "userdata.sh": """#!/bin/bash
set -e

# Logging all outputs to userdata.log
exec > >(tee /var/log/userdata.log|logger -t userdata -s 2>/dev/console) 2>&1

echo "Starting bootstrapping for StockDevOps..."

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

# Install k3s (Lightweight Kubernetes)
echo "Installing k3s..."
curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644
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

# Install ArgoCD CLI
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64

# Install Jenkins (via Docker)
echo "Installing Jenkins..."
mkdir -p /home/ubuntu/jenkins_home
chown -R 1000:1000 /home/ubuntu/jenkins_home
docker run -d --name jenkins -p 8080:8080 -p 50000:50000 -v /home/ubuntu/jenkins_home:/var/jenkins_home --restart always jenkins/jenkins:lts

# Install AWS CLI
echo "Installing AWS CLI..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Setup Monitoring (Prometheus & Grafana) using Helm
echo "Setting up Monitoring stack..."
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl create namespace monitoring || true
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack --namespace monitoring

echo "Bootstrapping complete!"
""",
    "modules/vpc/variables.tf": """variable "project_name" { type = string }
variable "vpc_cidr" { type = string }
variable "public_subnets" { type = list(string) }
variable "private_subnets" { type = list(string) }
variable "availability_zones" { type = list(string) }
""",
    "modules/vpc/main.tf": """resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${var.project_name}-igw"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnets)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.project_name}-public-subnet-${count.index + 1}"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnets)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = var.availability_zones[count.index]
  tags = {
    Name = "${var.project_name}-private-subnet-${count.index + 1}"
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags = {
    Name = "${var.project_name}-nat-eip"
  }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.igw]
  tags = {
    Name = "${var.project_name}-nat"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnets)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
  tags = {
    Name = "${var.project_name}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnets)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
""",
    "modules/vpc/outputs.tf": """output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
""",
    "modules/security/variables.tf": """variable "project_name" { type = string }
variable "vpc_id" { type = string }
variable "allowed_ssh_ip" { type = string }
""",
    "modules/security/main.tf": """resource "aws_security_group" "app_sg" {
  name        = "${var.project_name}-app-sg"
  description = "Enterprise Security Group for Application"
  vpc_id      = var.vpc_id

  # SSH ingress (Restricted)
  ingress {
    description = "SSH Access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_ip]
  }

  # HTTP
  ingress {
    description = "HTTP Access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS Access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Kubernetes API (Restricted)
  ingress {
    description = "Kubernetes API Access"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_ip]
  }
  
  # Jenkins
  ingress {
    description = "Jenkins Access"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_ip]
  }

  # Egress (All Outbound)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-app-sg"
  }
}
""",
    "modules/security/outputs.tf": """output "app_sg_id" {
  value = aws_security_group.app_sg.id
}
""",
    "modules/ec2/variables.tf": """variable "project_name" { type = string }
variable "instance_type" { type = string }
variable "ami_id" { type = string }
variable "subnet_id" { type = string }
variable "security_group_id" { type = string }
variable "key_name" { type = string }
variable "iam_instance_profile" { type = string }
variable "user_data" { type = string }
""",
    "modules/ec2/main.tf": """resource "aws_instance" "app" {
  ami                  = var.ami_id
  instance_type        = var.instance_type
  subnet_id            = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  key_name             = var.key_name
  iam_instance_profile = var.iam_instance_profile
  user_data            = var.user_data

  root_block_device {
    volume_size           = 50
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${var.project_name}-instance"
  }
}

resource "aws_eip" "app_eip" {
  instance = aws_instance.app.id
  domain   = "vpc"
  
  tags = {
    Name = "${var.project_name}-eip"
  }
}
""",
    "modules/ec2/outputs.tf": """output "public_ip" {
  value = aws_eip.app_eip.public_ip
}

output "instance_id" {
  value = aws_instance.app.id
}
""",
    "environments/dev/terraform.tfvars": """environment = "dev"
instance_type = "t3.medium"
""",
    "environments/staging/terraform.tfvars": """environment = "staging"
instance_type = "t3.large"
""",
    "environments/prod/terraform.tfvars": """environment = "prod"
instance_type = "t3.xlarge"
"""
}

for filepath, content in files.items():
    full_path = os.path.join(base_dir, filepath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", newline='\n') as f:
        f.write(content)

print("All Terraform files generated successfully.")
