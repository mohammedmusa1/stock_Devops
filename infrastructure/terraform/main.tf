# ==============================================================================
# Pre-deployment environment checks resource block
# PLACE THIS IN: infrastructure/terraform/main.tf or terraform/main.tf
# ==============================================================================

# Why Heredoc is required:
# In Terraform, using multiline strings (<<-EOT) is the best practice for scripts.
# It prevents string escaping issues (like having to write \" or double up symbols)
# and maintains readability of code block indentation.

# Why direct terminal paste fails:
# If you try to run "<<EOT" directly in a Windows PowerShell terminal, it will fail.
# PowerShell treats the "<" character as a redirection operator (reserved for future use)
# and does not recognize HCL's heredoc syntax. Terraform parses this file, NOT the terminal.

resource "null_resource" "pre_deployment_checks" {
  # 1. Verify PEM file exists locally on the Windows machine
  provisioner "local-exec" {
    interpreter = ["PowerShell", "-Command"]
    command     = <<-EOT
      $keyPath = "${var.ssh_private_key_path}"
      Write-Host "Verifying PEM file existence at: $keyPath"
      if (-not (Test-Path -Path $keyPath)) {
          Write-Error "CRITICAL: Private key PEM file does not exist at: $keyPath"
          exit 1
      }
      Write-Host "Verification Success: PEM file verified."
    EOT
  }

  # 2. Check if SSH Port 22 is open on the EC2 instance
  provisioner "local-exec" {
    interpreter = ["PowerShell", "-Command"]
    command     = <<-EOT
      $ip = "${var.ec2_public_ip}"
      Write-Host "Checking target SSH Port 22 accessibility on: $ip..."
      $result = Test-NetConnection -ComputerName $ip -Port 22 -InformationLevel Quiet
      if ($result -eq $false) {
          Write-Error "CRITICAL: SSH Port 22 is not reachable on $ip! Check your AWS Security Groups."
          exit 1
      }
      Write-Host "Verification Success: SSH Port 22 is open."
    EOT
  }
}

resource "null_resource" "configure_server" {
  depends_on = [null_resource.pre_deployment_checks]

  # Re-run when the EC2 public IP or private key path changes
  triggers = {
    ec2_public_ip        = var.ec2_public_ip
    ssh_private_key_path = var.ssh_private_key_path
  }

  connection {
    type        = "ssh"
    host        = var.ec2_public_ip
    user        = var.ssh_user
    private_key = file(var.ssh_private_key_path)
    timeout     = "10m"
  }

  # Create directories on remote first to prevent file provisioner issues
  provisioner "remote-exec" {
    inline = [
      "mkdir -p /home/${var.ssh_user}/scripts",
      "mkdir -p /home/${var.ssh_user}/kubernetes",
      "mkdir -p /home/${var.ssh_user}/helm",
      "mkdir -p /home/${var.ssh_user}/monitoring",
      "mkdir -p /home/${var.ssh_user}/argocd",
      "mkdir -p /home/${var.ssh_user}/jenkins",
      "mkdir -p /home/${var.ssh_user}/gitops"
    ]
  }

  # Copy the folders
  provisioner "file" {
    source      = "${path.module}/../scripts/"
    destination = "/home/${var.ssh_user}/scripts"
  }

  provisioner "file" {
    source      = "${path.module}/../kubernetes/"
    destination = "/home/${var.ssh_user}/kubernetes"
  }

  provisioner "file" {
    source      = "${path.module}/../helm/"
    destination = "/home/${var.ssh_user}/helm"
  }

  provisioner "file" {
    source      = "${path.module}/../monitoring/"
    destination = "/home/${var.ssh_user}/monitoring"
  }

  provisioner "file" {
    source      = "${path.module}/../argocd/"
    destination = "/home/${var.ssh_user}/argocd"
  }

  provisioner "file" {
    source      = "${path.module}/../jenkins/"
    destination = "/home/${var.ssh_user}/jenkins"
  }

  provisioner "file" {
    source      = "${path.module}/../gitops/"
    destination = "/home/${var.ssh_user}/gitops"
  }

  # Run the bootstrap script
  provisioner "remote-exec" {
    inline = [
      "chmod +x /home/${var.ssh_user}/scripts/*.sh",
      "export GITHUB_REPO='${var.github_repo}'",
      "export GITHUB_BRANCH='${var.github_branch}'",
      "export DOCKERHUB_USERNAME='${var.dockerhub_username}'",
      "export DOCKERHUB_TOKEN='${var.dockerhub_token}'",
      "export EC2_PUBLIC_IP='${var.ec2_public_ip}'",
      "sudo -E /home/${var.ssh_user}/scripts/setup.sh"
    ]
  }
}
