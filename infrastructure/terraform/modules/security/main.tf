resource "aws_security_group" "app_sg" {
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
  
  # Jenkins Web Dashboard (Container)
  ingress {
    description = "Jenkins Container Access"
    from_port   = 8080
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Kubernetes NodePorts Range (Required for Next.js Web, Jenkins NodePort, Grafana, Prometheus)
  ingress {
    description = "Kubernetes NodePorts"
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Open to public for portfolio testing, can be restricted to allowed_ssh_ip in hard prod
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
