output "ec2_public_ip" {
  description = "Public IP address of the configured EC2 instance"
  value       = var.ec2_public_ip
}

output "jenkins_url" {
  description = "URL to access Jenkins Dashboard (NodePort)"
  value       = "http://${var.ec2_public_ip}:30080"
}

output "argocd_url" {
  description = "URL to access ArgoCD Web Console (NodePort - HTTPS)"
  value       = "https://${var.ec2_public_ip}:30085"
}

output "grafana_url" {
  description = "URL to access Grafana Console (NodePort)"
  value       = "http://${var.ec2_public_ip}:30030"
}

output "prometheus_url" {
  description = "URL to access Prometheus Console (NodePort)"
  value       = "http://${var.ec2_public_ip}:30090"
}
