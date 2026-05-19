<#
.SYNOPSIS
  StockDevOps Platform Windows Deployment Wrapper
.DESCRIPTION
  Automates input verification, validation of PEM keys, connection checks,
  dynamic creation of terraform.tfvars, and non-interactive Terraform execution.
#>

$ErrorActionPreference = "Stop"

# ANSI-like coloring for Windows Console
function Write-Header ($text) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "   $text" -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Cyan
}

function Write-Step ($text) {
    Write-Host "`n[+] $text" -ForegroundColor Yellow
}

function Write-Success ($text) {
    Write-Host "    $text" -ForegroundColor Green
}

function Write-Fail ($text) {
    Write-Host "    $text" -ForegroundColor Red
}

Write-Header "STOCKDEVOPS - WINDOWS DEPLOYMENT AUTOMATION PIPELINE"

$tfDir = "D:\stockdevops\infrastructure\terraform"
$tfvarsPath = "$tfDir\terraform.tfvars"

# --- 1. Gather & Validate Inputs if terraform.tfvars does not exist ---
if (-not (Test-Path $tfvarsPath)) {
    Write-Step "No existing terraform.tfvars found. Let's configure your deployment parameters."
    
    # Validate EC2 IP Address
    $ec2Ip = ""
    while ($true) {
        $inputIp = Read-Host "Enter your EC2 Public IP address (IPv4)"
        if ($inputIp -match "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$") {
            $ec2Ip = $inputIp
            break
        } else {
            Write-Fail "Invalid IPv4 format. Please try again (e.g. 54.210.12.34)."
        }
    }

    # Validate SSH Key Path
    $sshKeyPath = ""
    while ($true) {
        $inputPath = Read-Host "Enter the path to your SSH private key (.pem file)"
        # Normalize Windows path separators to forward slashes for Terraform
        $normalizedPath = $inputPath.Replace("\", "/")
        
        if ($normalizedPath -like "*.pem" -and (Test-Path -Path $normalizedPath)) {
            $sshKeyPath = $normalizedPath
            break
        } else {
            Write-Fail "File not found or not a .pem file at: $normalizedPath. Please check the path and try again."
        }
    }

    # Validate GitHub Repository
    $githubRepo = ""
    while ($true) {
        $inputRepo = Read-Host "Enter your GitHub repository HTTPS URL (e.g. https://github.com/username/stock_Devops)"
        if ($inputRepo -match "^https://github\.com/.+/.+$") {
            $githubRepo = $inputRepo
            break
        } else {
            Write-Fail "Must be a valid HTTPS GitHub repository URL."
        }
    }

    # Gather branch
    $githubBranch = Read-Host "Enter GitHub branch to track [default: main]"
    if ([string]::IsNullOrWhiteSpace($githubBranch)) { $githubBranch = "main" }

    # Gather Docker Hub Credentials
    $dockerUser = ""
    while ($true) {
        $inputUser = Read-Host "Enter your Docker Hub username"
        if (-not [string]::IsNullOrWhiteSpace($inputUser) -and $inputUser -ne "yes") {
            $dockerUser = $inputUser
            break
        } else {
            Write-Fail "Username cannot be empty or 'yes'."
        }
    }

    $dockerToken = ""
    while ($true) {
        $inputToken = Read-Host -AsSecureString "Enter your Docker Hub password or token (input is hidden)"
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($inputToken)
        $plainToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        
        if (-not [string]::IsNullOrWhiteSpace($plainToken) -and $plainToken -ne "yes") {
            $dockerToken = $plainToken
            break
        } else {
            Write-Fail "Password/Token cannot be empty or 'yes'."
        }
    }

    # Create the terraform.tfvars file
    Write-Step "Creating terraform.tfvars file..."
    $tfvarsContent = @"
ec2_public_ip        = "$ec2Ip"
ssh_private_key_path = "$sshKeyPath"
github_repo          = "$githubRepo"
github_branch        = "$githubBranch"
dockerhub_username   = "$dockerUser"
dockerhub_token      = "$dockerToken"
ssh_user             = "ubuntu"
"@
    Set-Content -Path $tfvarsPath -Value $tfvarsContent
    Write-Success "Created $tfvarsPath successfully."
} else {
    Write-Step "Found existing terraform.tfvars. Parsing values..."
    # Read variables from the file
    $content = Get-Content $tfvarsPath
    $ec2Ip = ($content | Select-String "ec2_public_ip\s*=\s*`"(.*)`"").Matches.Groups[1].Value
    $sshKeyPath = ($content | Select-String "ssh_private_key_path\s*=\s*`"(.*)`"").Matches.Groups[1].Value
}

# --- 2. Pre-flight Checks (Verify target connectivity & local key existence) ---
Write-Step "Executing Pre-flight connectivity checks..."

# Verify SSH key file exists
if (-not (Test-Path $sshKeyPath)) {
    Write-Fail "CRITICAL: SSH Key file not found at: $sshKeyPath"
    exit 1
}
Write-Success "SSH Private Key file verified at: $sshKeyPath"

# Verify port 22 is reachable
Write-Host "Checking target SSH Port 22 connectivity on $ec2Ip..." -ForegroundColor DarkYellow
$portCheck = Test-NetConnection -ComputerName $ec2Ip -Port 22 -InformationLevel Quiet
if (-not $portCheck) {
    Write-Fail "CRITICAL: SSH Port 22 is NOT reachable on target IP $ec2Ip!"
    Write-Host "`n--- TROUBLESHOOTING SSH CONNECTION ---" -ForegroundColor Yellow
    Write-Host "1. Check your AWS EC2 console to verify the instance is running." -ForegroundColor Cyan
    Write-Host "2. Verify the AWS Security Group permits inbound traffic on Port 22 from your IP." -ForegroundColor Cyan
    Write-Host "3. Double-check the target Public IP is correct: $ec2Ip" -ForegroundColor Cyan
    Write-Host "4. Try connecting manually in a separate window to confirm host key configuration:" -ForegroundColor Cyan
    Write-Host "   ssh -i `"$sshKeyPath`" ubuntu@$ec2Ip" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
Write-Success "SSH Port 22 is open on target instance."

# --- 3. Execute Terraform Pipeline ---
Write-Step "Step 3.1: Running 'terraform init'..."
Set-Location -Path $tfDir
terraform init

Write-Step "Step 3.2: Running 'terraform validate'..."
terraform validate

Write-Step "Step 3.3: Running 'terraform plan'..."
terraform plan -out=tfplan

Write-Step "Step 3.4: Running 'terraform apply'..."
terraform apply -auto-approve tfplan

Write-Header "PLATFORM PROVISIONING COMPLETE"
Write-Host "Your DevOps Platform has been successfully bootstrapped!" -ForegroundColor Green
Write-Host ""
terraform output
Write-Host "======================================================================" -ForegroundColor Cyan
