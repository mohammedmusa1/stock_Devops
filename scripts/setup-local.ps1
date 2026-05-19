# Stock AI - Local Setup (Windows)
# Run: .\scripts\setup-local.ps1
# Optional: .\scripts\setup-local.ps1 -StartDocker

param(
  [switch]$StartDocker
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Test-DockerEngine {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  $null = docker version --format "{{.Server.Version}}" 2>&1
  $ok = $LASTEXITCODE -eq 0
  $ErrorActionPreference = $prev
  return $ok
}

function Start-DockerDesktopIfRequested {
  $paths = @(
    "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
      Start-Process $p
      return $true
    }
  }
  return $false
}

function Show-DockerHelp {
  Write-Host ""
  Write-Host "Docker Engine is NOT running." -ForegroundColor Red
  Write-Host ""
  Write-Host "Do this:" -ForegroundColor Cyan
  Write-Host "  1. Open 'Docker Desktop' from the Start menu"
  Write-Host "  2. Wait 1-3 minutes until the tray whale icon says 'Docker Desktop is running'"
  Write-Host "  3. In a NEW terminal, run:  docker info"
  Write-Host "  4. Then run:  .\scripts\setup-local.ps1"
  Write-Host ""
  Write-Host "Or auto-start Docker Desktop:" -ForegroundColor Cyan
  Write-Host "  .\scripts\setup-local.ps1 -StartDocker"
  Write-Host ""
  Write-Host "Diagnose problems:" -ForegroundColor Cyan
  Write-Host "  .\scripts\diagnose-docker.ps1"
  Write-Host ""
  Write-Host "Install Docker Desktop:" -ForegroundColor Cyan
  Write-Host "  https://www.docker.com/products/docker-desktop/"
  Write-Host ""
}

Write-Host "=== Stock AI Setup ===" -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker CLI not found." -ForegroundColor Red
  Show-DockerHelp
  exit 1
}

if (-not (Test-DockerEngine)) {
  if ($StartDocker) {
    if (Start-DockerDesktopIfRequested) {
      Write-Host "Waiting for Docker Engine (up to 120s)..." -ForegroundColor Yellow
      $deadline = (Get-Date).AddSeconds(120)
      while ((Get-Date) -lt $deadline) {
        if (Test-DockerEngine) { break }
        Start-Sleep -Seconds 5
        Write-Host "  still starting..." -ForegroundColor DarkGray
      }
    } else {
      Write-Host "Could not find Docker Desktop.exe" -ForegroundColor Red
    }
  }
}

if (-not (Test-DockerEngine)) {
  Show-DockerHelp
  exit 1
}

Write-Host "[OK] Docker Engine is running" -ForegroundColor Green

npm install

if (-not (Test-Path "apps\api\.env")) {
  Copy-Item "apps\api\.env.example" "apps\api\.env"
  Write-Host "Created apps\api\.env" -ForegroundColor Green
}

if (-not (Test-Path "apps\web\.env.local")) {
  Copy-Item "apps\web\.env.local.example" "apps\web\.env.local"
  Write-Host "Created apps\web\.env.local" -ForegroundColor Green
}

$envFile = Get-Content "apps\api\.env" -Raw
if ($envFile -match "CHANGE_ME") {
  $a = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  $r = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  $envFile = $envFile.Replace("CHANGE_ME_generate_random_hex_64_chars", $a, 1)
  $envFile = $envFile.Replace("CHANGE_ME_generate_random_hex_64_chars", $r, 1)
  Set-Content "apps\api\.env" $envFile
}

Write-Host "Starting PostgreSQL + Redis..." -ForegroundColor Yellow
$prev = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
docker compose up -d 2>&1 | ForEach-Object { Write-Host $_ }
$composeOk = $LASTEXITCODE -eq 0
$ErrorActionPreference = $prev

if (-not $composeOk) {
  Write-Host "docker compose failed. Run: .\scripts\diagnose-docker.ps1" -ForegroundColor Red
  exit 1
}

Write-Host "Waiting for PostgreSQL and Redis (up to 60s)..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  node scripts/check-deps.mjs 2>&1 | Out-Null
  $ErrorActionPreference = $prev
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  Write-Host "PostgreSQL/Redis not ready yet." -ForegroundColor Red
  Write-Host "Check:  docker compose ps" -ForegroundColor Yellow
  Write-Host "Logs:   docker compose logs postgres redis" -ForegroundColor Yellow
  exit 1
}

Write-Host "[OK] PostgreSQL and Redis are up" -ForegroundColor Green

Set-Location "apps\api"
npx prisma generate
npx prisma migrate deploy
npm run db:seed
Set-Location $Root

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host "  npm run dev"
Write-Host "  Web:   http://localhost:3000"
Write-Host "  API:   http://localhost:4000/api/v1/health"
Write-Host "  Login: trader@stockforge.local / Trader@12345"
