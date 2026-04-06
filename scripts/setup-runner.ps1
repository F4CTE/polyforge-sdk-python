<#
.SYNOPSIS
    Sets up a GitHub Actions self-hosted runner for PolyForge.
.DESCRIPTION
    Downloads, configures, and installs the GitHub Actions runner as a Windows service.
    Requires a GitHub Personal Access Token with 'repo' scope (or fine-grained: administration:write).
.PARAMETER Token
    GitHub PAT for runner registration. Generate at: https://github.com/settings/tokens
    Required scope: repo (classic) or administration:write (fine-grained on F4CTE/PolyForge)
.EXAMPLE
    .\setup-runner.ps1 -Token ghp_xxxxxxxxxxxx
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$RunnerDir = "C:\actions-runner",
    [string]$RunnerName = "polyforge-local",
    [string]$Labels = "self-hosted,windows,x64,polyforge"
)

$ErrorActionPreference = "Stop"
$repo = "F4CTE/PolyForge"
$runnerVersion = "2.323.0"
$runnerArch = "win-x64"
$runnerZip = "actions-runner-${runnerArch}-${runnerVersion}.zip"
$downloadUrl = "https://github.com/actions/runner/releases/download/v${runnerVersion}/${runnerZip}"

Write-Host "=== PolyForge Self-Hosted Runner Setup ===" -ForegroundColor Cyan

# ── 1. Pre-flight checks ──────────────────────────────────────────────────
Write-Host "`n[1/6] Pre-flight checks..." -ForegroundColor Yellow

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker not found. Install Docker Desktop first."
}
$dockerVersion = docker version --format '{{.Server.Version}}' 2>$null
if (-not $dockerVersion) {
    throw "Docker daemon not running. Start Docker Desktop first."
}
Write-Host "  Docker: $dockerVersion" -ForegroundColor Green

# Check Node
$nodeVersion = node -v 2>$null
if (-not $nodeVersion) {
    throw "Node.js not found. Install Node.js 24+ first."
}
Write-Host "  Node: $nodeVersion" -ForegroundColor Green

# Check pnpm
$pnpmVersion = pnpm -v 2>$null
if (-not $pnpmVersion) {
    throw "pnpm not found. Install with: npm i -g pnpm"
}
Write-Host "  pnpm: $pnpmVersion" -ForegroundColor Green

# Check Git
$gitVersion = git --version 2>$null
if (-not $gitVersion) {
    throw "Git not found."
}
Write-Host "  Git: $gitVersion" -ForegroundColor Green

# ── 2. Create runner directory ─────────────────────────────────────────────
Write-Host "`n[2/6] Creating runner directory..." -ForegroundColor Yellow

if (Test-Path $RunnerDir) {
    Write-Host "  Directory exists, checking for existing runner..." -ForegroundColor DarkYellow
    if (Test-Path "$RunnerDir\.runner") {
        Write-Host "  Removing existing runner configuration..." -ForegroundColor DarkYellow
        Push-Location $RunnerDir
        .\config.cmd remove --token $Token 2>$null
        Pop-Location
    }
} else {
    New-Item -ItemType Directory -Path $RunnerDir -Force | Out-Null
}
Write-Host "  Runner dir: $RunnerDir" -ForegroundColor Green

# ── 3. Download runner ─────────────────────────────────────────────────────
Write-Host "`n[3/6] Downloading runner v${runnerVersion}..." -ForegroundColor Yellow

$zipPath = Join-Path $RunnerDir $runnerZip
if (-not (Test-Path $zipPath)) {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "  Downloaded: $runnerZip" -ForegroundColor Green
} else {
    Write-Host "  Already downloaded, skipping" -ForegroundColor Green
}

# Extract
Write-Host "  Extracting..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $RunnerDir -Force
Write-Host "  Extracted to $RunnerDir" -ForegroundColor Green

# ── 4. Get registration token ──────────────────────────────────────────────
Write-Host "`n[4/6] Getting registration token from GitHub..." -ForegroundColor Yellow

$regTokenResponse = Invoke-RestMethod `
    -Uri "https://api.github.com/repos/$repo/actions/runners/registration-token" `
    -Method Post `
    -Headers @{
        Authorization = "token $Token"
        Accept        = "application/vnd.github+json"
    }
$regToken = $regTokenResponse.token
Write-Host "  Registration token obtained (expires in 1 hour)" -ForegroundColor Green

# ── 5. Configure runner ────────────────────────────────────────────────────
Write-Host "`n[5/6] Configuring runner..." -ForegroundColor Yellow

Push-Location $RunnerDir
& .\config.cmd `
    --url "https://github.com/$repo" `
    --token $regToken `
    --name $RunnerName `
    --labels $Labels `
    --work "_work" `
    --replace `
    --unattended
Pop-Location

Write-Host "  Runner configured as 'polyforge-local'" -ForegroundColor Green

# ── 6. Install as Windows service ──────────────────────────────────────────
Write-Host "`n[6/6] Installing as Windows service..." -ForegroundColor Yellow

$svcName = "actions.runner.F4CTE-PolyForge.$RunnerName"
$svcExe  = Join-Path $RunnerDir "bin\RunnerService.exe"

$existingSvc = Get-Service $svcName -ErrorAction SilentlyContinue
if ($existingSvc) {
    Write-Host "  Service already exists (Status: $($existingSvc.Status))" -ForegroundColor DarkYellow
    if ($existingSvc.Status -ne "Running") {
        Start-Service $svcName
    }
} else {
    New-Service -Name $svcName `
        -BinaryPathName $svcExe `
        -DisplayName "GitHub Actions Runner ($RunnerName)" `
        -Description "Self-hosted GitHub Actions runner for F4CTE/PolyForge ($RunnerName)" `
        -StartupType Automatic
    Start-Service $svcName
}

Write-Host "`n=== Runner installed and running ===" -ForegroundColor Cyan
Write-Host "  Name:    $RunnerName" -ForegroundColor White
Write-Host "  Labels:  $Labels" -ForegroundColor White
Write-Host "  Dir:     $RunnerDir" -ForegroundColor White
Write-Host "  Service: $svcName" -ForegroundColor White
Write-Host ""
Write-Host "Management commands:" -ForegroundColor Yellow
Write-Host "  Start:   cd $RunnerDir && .\svc.cmd start" -ForegroundColor Gray
Write-Host "  Stop:    cd $RunnerDir && .\svc.cmd stop" -ForegroundColor Gray
Write-Host "  Status:  cd $RunnerDir && .\svc.cmd status" -ForegroundColor Gray
Write-Host "  Remove:  cd $RunnerDir && .\svc.cmd stop && .\svc.cmd uninstall" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: push the updated ci.yml to start using the local runner." -ForegroundColor Yellow
