<#
.SYNOPSIS
    Manage the PolyForge self-hosted GitHub Actions runner.
.EXAMPLE
    .\runner-ctl.ps1 status
    .\runner-ctl.ps1 start
    .\runner-ctl.ps1 stop
    .\runner-ctl.ps1 restart
    .\runner-ctl.ps1 logs
    .\runner-ctl.ps1 cleanup   # Remove stale _work dirs older than 7 days
#>
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "cleanup")]
    [string]$Action,

    [string]$RunnerDir = "C:\actions-runner"
)

$ErrorActionPreference = "Stop"
$serviceName = "actions.runner.F4CTE-PolyForge.polyforge-local"

function Write-Status($msg, $color = "Cyan") {
    Write-Host "[runner-ctl] $msg" -ForegroundColor $color
}

switch ($Action) {
    "status" {
        $svc = Get-Service $serviceName -ErrorAction SilentlyContinue
        if ($svc) {
            Write-Status "Service: $($svc.Status)"
            # Show runner disk usage
            if (Test-Path "$RunnerDir\_work") {
                $size = (Get-ChildItem "$RunnerDir\_work" -Recurse -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum).Sum
                $sizeGB = [math]::Round($size / 1GB, 2)
                Write-Status "Work dir size: ${sizeGB} GB"
            }
            # Show Docker status
            $dockerRunning = docker info 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Status "Docker: Running" "Green"
            } else {
                Write-Status "Docker: Not running (E2E jobs will fail)" "Red"
            }
        } else {
            Write-Status "Runner service not found. Run setup-runner.ps1 first." "Red"
        }
    }

    "start" {
        Write-Status "Starting runner..."
        # Ensure Docker Desktop is running
        $dockerProc = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
        if (-not $dockerProc) {
            Write-Status "Starting Docker Desktop..." "Yellow"
            Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
            Start-Sleep -Seconds 10
        }
        Start-Service $serviceName
        Write-Status "Runner started" "Green"
    }

    "stop" {
        Write-Status "Stopping runner..."
        Stop-Service $serviceName -Force
        Write-Status "Runner stopped" "Green"
    }

    "restart" {
        Write-Status "Restarting runner..."
        Restart-Service $serviceName -Force
        Write-Status "Runner restarted" "Green"
    }

    "logs" {
        $logDir = "$RunnerDir\_diag"
        if (Test-Path $logDir) {
            $latestLog = Get-ChildItem $logDir -Filter "*.log" |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
            if ($latestLog) {
                Write-Status "Showing: $($latestLog.Name)"
                Get-Content $latestLog.FullName -Tail 50
            } else {
                Write-Status "No log files found" "Yellow"
            }
        } else {
            Write-Status "Log directory not found: $logDir" "Red"
        }
    }

    "cleanup" {
        $workDir = "$RunnerDir\_work"
        if (Test-Path $workDir) {
            $before = (Get-ChildItem $workDir -Recurse -ErrorAction SilentlyContinue |
                Measure-Object -Property Length -Sum).Sum
            $beforeGB = [math]::Round($before / 1GB, 2)

            Write-Status "Work dir before cleanup: ${beforeGB} GB"

            # Remove completed run directories older than 7 days
            Get-ChildItem $workDir -Directory |
                Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
                ForEach-Object {
                    Write-Status "Removing: $($_.Name)" "Yellow"
                    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
                }

            # Prune Docker resources
            Write-Status "Pruning Docker..." "Yellow"
            docker system prune -f --volumes 2>$null
            docker builder prune -f --keep-storage 10GB 2>$null

            $after = (Get-ChildItem $workDir -Recurse -ErrorAction SilentlyContinue |
                Measure-Object -Property Length -Sum).Sum
            $afterGB = [math]::Round($after / 1GB, 2)
            $saved = [math]::Round(($before - $after) / 1GB, 2)

            Write-Status "Work dir after cleanup: ${afterGB} GB (freed ${saved} GB)" "Green"
        } else {
            Write-Status "No work directory to clean" "Yellow"
        }
    }
}
