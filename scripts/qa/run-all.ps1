# Chạy tất cả scenario QA qua browser driver.
#
# Điều kiện: 2 API (:5080/:5081) + SPA (:4173) đang chạy.
# Script tự bật driver (:4599) nếu chưa có, và thử lại 1 lần khi scenario fail
# (Chrome treo sau nhiều scenario là nguyên nhân fail oan phổ biến nhất).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/run-all.ps1
#
# LƯU Ý: chạy ở terminal thường (foreground), KHÔNG chạy trong background job —
# job nền của harness chặn stdio của process con, driver sẽ timeout hàng loạt.

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$driverDir = Join-Path $repoRoot 'tools\browser-driver'
$node = 'C:\Program Files\nodejs\node.exe'

$scenarios = @(
    '01-auth.ps1',
    '02-orders.ps1',
    '03-rbac-responsive.ps1',
    '04-order-form.ps1',
    '05-products-dashboard.ps1',
    '06-navigation.ps1',
    '07-edge-probe.ps1',
    '08-invoice-detail.ps1',
    '09-i18n.ps1',
    '10-role-switch.ps1',
    '11-role-dashboards.ps1',
    '12-marketplace.ps1',
    '13-payment-shipping.ps1',
    '14-auth-recovery.ps1',
    '15-role-admin.ps1'
)

function Test-Driver {
    try {
        return [bool](Invoke-RestMethod -Uri 'http://127.0.0.1:4599/health' -TimeoutSec 2).ok
    } catch {
        return $false
    }
}

if (-not (Test-Driver)) {
    Write-Host 'Đang bật browser driver...' -ForegroundColor DarkGray
    Start-Process -FilePath $node -ArgumentList 'driver.mjs' -WorkingDirectory $driverDir `
        -RedirectStandardOutput (Join-Path $driverDir 'driver.log') `
        -RedirectStandardError (Join-Path $driverDir 'driver.err.log') | Out-Null

    $up = $false
    for ($attempt = 1; $attempt -le 25; $attempt++) {
        Start-Sleep -Milliseconds 600
        if (Test-Driver) { $up = $true; break }
    }

    if (-not $up) {
        Write-Host 'Không khởi động được browser driver (:4599).' -ForegroundColor Red
        exit 1
    }
}

function Invoke-Scenario([string]$name) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot $name)
    return $LASTEXITCODE
}

$failed = @()

foreach ($scenario in $scenarios) {
    Write-Host "`n================ $scenario ================" -ForegroundColor Magenta

    $code = Invoke-Scenario $scenario

    if ($code -ne 0) {
        Write-Host "  → thử lại $scenario" -ForegroundColor Yellow
        Start-Sleep -Seconds 6
        $code = Invoke-Scenario $scenario
    }

    if ($code -ne 0) {
        $failed += $scenario
        Write-Host "  → THẤT BẠI: $scenario" -ForegroundColor Red
    }
}

Write-Host ''
if ($failed.Count -gt 0) {
    Write-Host "$($failed.Count)/$($scenarios.Count) scenario thất bại: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "TẤT CẢ $($scenarios.Count) SCENARIO PASS" -ForegroundColor Green
