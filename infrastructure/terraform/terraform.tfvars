aws_region       = "us-east-1"
project_name     = "stockdevops"
vpc_cidr         = "10.0.0.0/16"
public_subnets   = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnets  = ["10.0.10.0/24", "10.0.20.0/24"]
allowed_ssh_ip   = "0.0.0.0/0" # WARNING: Change this to your actual IP address like "203.0.113.1/32" for production
instance_type    = "t3.micro"
