<#
.SYNOPSIS
Enterprise-grade Windows Setup Automation for StockDevOps / Antigravity

.DESCRIPTION
Automatically installs and configures Chocolatey, Terraform, AWS CLI, Git, 
Docker Desktop, kubectl, Helm, VS Code, Node.js LTS, ArgoCD CLI, jq, curl.
Configures SSH keys, directories, and refreshes the environment variables.
#>

$ErrorActionPreference = "Stop"
$InformationPreference = "Continue"

Write-Information "===================================================="
Write-Information "   StockDevOps Windows Machine Setup Automation"
Write-Information "===================================================="
Write-Information ""

# ---------------------------------------------------------
# 1. Verify Administrator Privileges
# ---------------------------------------------------------
Write-Information "[1/7] Verifying administrative privileges..."
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script MUST be run as Administrator."
    exit 1
}
Write-Information "      OK: Running as Administrator."

# ---------------------------------------------------------
# 2. Setup Working Directories & SSH Keys
# ---------------------------------------------------------
Write-Information "[2/7] Setting up Workspace & SSH..."

$workspaceDir = "D:\stockdevops"
if (-not (Test-Path -Path $workspaceDir)) {
    New-Item -ItemType Directory -Force -Path $workspaceDir | Out-Null
    Write-Information "      Created DevOps workspace at $workspaceDir"
}

$sshDir = "$env:USERPROFILE\.ssh"
if (-not (Test-Path -Path $sshDir)) {
    New-Item -ItemType Directory -Force -Path $sshDir | Out-Null
    Write-Information "      Created SSH directory at $sshDir"
}

$sshKeyPath = "$sshDir\id_rsa"
if (-not (Test-Path -Path $sshKeyPath)) {
    Write-Information "      Generating standard RSA SSH key..."
    ssh-keygen -t rsa -b 4096 -N "" -f $sshKeyPath -q
    Write-Information "      SSH Key generated successfully."
} else {
    Write-Information "      SSH Key already exists at $sshKeyPath"
}

# ---------------------------------------------------------
# 3. Install Chocolatey Package Manager
# ---------------------------------------------------------
Write-Information "[3/7] Checking for Chocolatey package manager..."
if (-not (Get-Command "choco" -ErrorAction SilentlyContinue)) {
    Write-Information "      Chocolatey not found. Installing..."
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    Write-Information "      Chocolatey installed successfully."
    $env:Path += ";$env:ALLUSERSPROFILE\chocolatey\bin"
} else {
    Write-Information "      Chocolatey is already installed."
}

# ---------------------------------------------------------
# 4. Install Enterprise DevOps Tools via Chocolatey
# ---------------------------------------------------------
Write-Information "[4/7] Installing DevOps Toolchain..."

$chocoPackages = @(
    "terraform",
    "awscli",
    "git",
    "docker-desktop",
    "kubernetes-cli",
    "kubernetes-helm",
    "vscode",
    "nodejs-lts",
    "argocd-cli",
    "jq",
    "curl"
)

foreach ($pkg in $chocoPackages) {
    Write-Information "      -> Installing/Verifying $pkg..."
    choco install $pkg -y --no-progress
}

# ---------------------------------------------------------
# 5. Configure Git Defaults
# ---------------------------------------------------------
Write-Information "[5/7] Configuring Git defaults..."
if (Get-Command "git" -ErrorAction SilentlyContinue) {
    git config --global core.autocrlf true
    git config --global init.defaultBranch main
    git config --global pull.rebase false
    Write-Information "      Git defaults configured (autocrlf=true, defaultBranch=main)."
}

# ---------------------------------------------------------
# 6. Refresh Environment Variables
# ---------------------------------------------------------
Write-Information "[6/7] Refreshing Environment Variables..."

# A helper function to safely refresh PATH variables in the current session
function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $userPath    = [Environment]::GetEnvironmentVariable('PATH', 'User')
    $env:PATH = "$machinePath;$userPath"
}

Refresh-Path
Write-Information "      Environment Variables refreshed."

# ---------------------------------------------------------
# 7. Verification & Post-Install Checks
# ---------------------------------------------------------
Write-Information "[7/7] Post-Install Verification..."
Write-Information "===================================================="

function Verify-Command($cmd, $args) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        Write-Information "--- $cmd version ---"
        try {
            & $cmd $args | Out-Host
        } catch {
            Write-Warning "Could not run $cmd $args"
        }
    } else {
        Write-Error "FAILED: $cmd is not recognized. It may require a system restart."
    }
}

Verify-Command "terraform" "-version"
Verify-Command "aws" "--version"
Verify-Command "docker" "--version"
Verify-Command "kubectl" "version --client"
Verify-Command "helm" "version"
Verify-Command "git" "--version"
Verify-Command "node" "-v"
Verify-Command "argocd" "version --client"
Verify-Command "jq" "--version"
Verify-Command "curl" "--version"

Write-Information "===================================================="
Write-Information "SUCCESS: StockDevOps Enterprise Setup Complete."
Write-Information "NOTE: Docker Desktop may require a system reboot and WSL2 configuration."
Write-Information "===================================================="
