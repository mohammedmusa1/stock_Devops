# Stock AI — Docker diagnostics (Windows)
# Run: .\scripts\diagnose-docker.ps1

$ErrorActionPreference = "SilentlyContinue"

Write-Host "`n=== Stock AI — Docker Diagnostics ===`n" -ForegroundColor Cyan

# 1. Docker CLI
if (Get-Command docker -ErrorAction SilentlyContinue) {
  Write-Host "[OK]   docker CLI found: $(Get-Command docker | Select-Object -ExpandProperty Source)" -ForegroundColor Green
} else {
  Write-Host "[FAIL] docker CLI not in PATH" -ForegroundColor Red
  Write-Host "       Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
}

# 2. Docker Desktop install path
$desktop = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
if (Test-Path $desktop) {
  Write-Host "[OK]   Docker Desktop installed: $desktop" -ForegroundColor Green
} else {
  Write-Host "[WARN] Docker Desktop.exe not at default path" -ForegroundColor Yellow
}

# 3. Engine / pipe
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "[OK]   Docker Engine is RUNNING" -ForegroundColor Green
  $ver = docker version --format "Client: {{.Client.Version}}  Server: {{.Server.Version}}" 2>&1
  Write-Host "       $ver"
} else {
  Write-Host "[FAIL] Docker Engine is NOT running" -ForegroundColor Red
  Write-Host ""
  Write-Host "       Typical error: npipe:////./pipe/dockerDesktopLinuxEngine" -ForegroundColor Yellow
  Write-Host "       Meaning: Docker Desktop app is closed or still starting."
  Write-Host ""
  Write-Host "       Fix:" -ForegroundColor Cyan
  Write-Host "         1. Start menu -> Docker Desktop"
  Write-Host "         2. Wait until tray icon is steady (not 'Starting...')"
  Write-Host "         3. Settings -> General -> ensure 'Use WSL 2 based engine' is ON (recommended)"
  Write-Host "         4. If stuck: Docker Desktop -> Troubleshoot -> Restart Docker Desktop"
  Write-Host ""
  Write-Host "       Then run:  .\scripts\setup-local.ps1 -StartDocker"
  exit 1
}

# 4. Compose
$compose = docker compose version 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "[OK]   $compose" -ForegroundColor Green
} else {
  Write-Host "[FAIL] docker compose not available" -ForegroundColor Red
  exit 1
}

# 5. WSL (optional)
if (Get-Command wsl -ErrorAction SilentlyContinue) {
  $wslStatus = wsl --status 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[INFO] WSL:" -ForegroundColor Gray
    $wslStatus | ForEach-Object { Write-Host "       $_" }
  }
}

# 6. Project containers
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
Write-Host ""
Write-Host "--- docker compose ps ---" -ForegroundColor Cyan
docker compose ps

# 7. Ports
function Test-Port($port) {
  $tcp = New-Object System.Net.Sockets.TcpClient
  try {
    $tcp.Connect("127.0.0.1", $port)
    $tcp.Close()
    return $true
  } catch {
    return $false
  }
}

Write-Host ""
Write-Host "--- Ports ---" -ForegroundColor Cyan
foreach ($p in @(5432, 6379)) {
  if (Test-Port $p) {
    Write-Host "[OK]   Port $p is open" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] Port $p is closed — run: docker compose up -d" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "If Engine is OK but ports closed:" -ForegroundColor Cyan
Write-Host "  cd $Root"
Write-Host "  docker compose up -d"
Write-Host "  npm run dev"
Write-Host ""
