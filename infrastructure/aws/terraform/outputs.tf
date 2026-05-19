output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  description = "Use this IP for DNS A record and SSH"
  value       = var.allocate_eip ? aws_eip.app[0].public_ip : aws_instance.app.public_ip
}

output "ssh_command" {
  value = "ssh -i YOUR_KEY.pem ubuntu@${var.allocate_eip ? aws_eip.app[0].public_ip : aws_instance.app.public_ip}"
}

output "estimated_monthly_cost_usd" {
  value = <<-EOT
    t3.micro (750h/mo free tier year 1): ~$0 if within free tier
    t3.large 24/7: ~$60 compute + ~$3 storage (varies by region)
    Elastic IP attached to running instance: $0
    Data transfer out > 100GB: extra charges
    Destroy when not demoing: terraform destroy
  EOT
}
