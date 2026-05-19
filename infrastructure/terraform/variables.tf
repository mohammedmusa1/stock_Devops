variable "ec2_public_ip" {
  description = "The public IP address of the manually created EC2 instance"
  type        = string

  validation {
    condition     = can(regex("^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$", var.ec2_public_ip))
    error_message = "The ec2_public_ip variable must be a valid IPv4 address (e.g., 54.210.12.34)."
  }
}

variable "ssh_private_key_path" {
  description = "The local absolute path to the SSH private key (.pem file)"
  type        = string

  validation {
    condition     = can(regex("^.*\\.pem$", var.ssh_private_key_path))
    error_message = "The ssh_private_key_path must point to a file ending in .pem (e.g., C:/Users/YourName/.ssh/key.pem)."
  }
}

variable "github_repo" {
  description = "The URL of the GitHub repository containing the DevOps codebase"
  type        = string

  validation {
    condition     = can(regex("^https://github\\.com/.+/.+$", var.github_repo))
    error_message = "The github_repo must be a valid HTTPS GitHub repository URL (e.g., https://github.com/username/repo)."
  }
}

variable "github_branch" {
  description = "The branch of the GitHub repository to track"
  type        = string
  default     = "main"
}

variable "dockerhub_username" {
  description = "Docker Hub Username"
  type        = string

  validation {
    condition     = length(var.dockerhub_username) > 0 && var.dockerhub_username != "yes"
    error_message = "The dockerhub_username must not be empty or set to 'yes'."
  }
}

variable "dockerhub_token" {
  description = "Docker Hub Personal Access Token or password"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.dockerhub_token) > 0 && var.dockerhub_token != "yes"
    error_message = "The dockerhub_token must not be empty or set to 'yes'."
  }
}

variable "ssh_user" {
  description = "The SSH username for the EC2 instance (usually ubuntu)"
  type        = string
  default     = "ubuntu"
}
