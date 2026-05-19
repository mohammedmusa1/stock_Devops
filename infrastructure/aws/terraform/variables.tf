variable "aws_region" {
  description = "AWS region (us-east-1 has the most free-tier services)"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "name-stock-ai"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "instance_type" {
  description = "t3.micro/t3.small = free-tier friendly; t3.large = more RAM for k3s + Docker"
  type        = string
  default     = "t3.large"
}

variable "key_name" {
  description = "Existing EC2 key pair name in AWS"
  type        = string
}

variable "ssh_cidr" {
  description = "Your public IP as CIDR, e.g. 203.0.113.10/32 — NEVER use 0.0.0.0/0 for SSH"
  type        = string
}

variable "root_volume_gb" {
  description = "Root disk size (30 GB free tier eligible for gp3 in some accounts)"
  type        = number
  default     = 30
}

variable "allocate_eip" {
  description = "Static public IP (recommended for DNS + SSL)"
  type        = bool
  default     = true
}
