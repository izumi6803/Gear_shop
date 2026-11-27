# Scenario 11 — Mỗi role phải có dashboard KHÁC NHAU (không "cùng một dashboard")
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/11-role-dashboards.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

function Sign-In([string]$user, [string]$pass) {
    Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
    Start-Sleep -Milliseconds 1100
    Bc-Fill '[data-testid=login-username]' $user
    Bc-Fill '[data-testid=login-password]' $pass
    Bc-Click '[data-testid=login-submit]'
    Start-Sleep -Milliseconds 2400
}

Write-Host "`n== 1. Admin: 4 KPI + panel quan tri" -ForegroundColor Cyan
Sign-In 'admin' 'Admin@123'
$titleAdmin = (Bc-Text '.page-title').text
$kpiAdmin = Bc-Count '.kpi-card'
Write-Host "     title='$($titleAdmin -replace '\s+',' ')' | kpis=$kpiAdmin" -ForegroundColor DarkGray
Bc-Assert ($kpiAdmin -eq 4) "admin có 4 KPI (=$kpiAdmin)" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=kpi-pending]') -eq 1) 'admin thấy KPI "Chờ xác nhận"' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=role-panel-admin]') -eq 1) 'admin có panel công cụ quản trị' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=role-panel-sales]') -eq 0) 'admin không có panel Sales' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=role-panel-viewer]') -eq 0) 'admin không có panel Viewer' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=new-order]') -ge 1) 'admin có nút tạo đơn' | Out-Null
Bc-Shot 'dash-role-admin' | Out-Null

Write-Host "`n== 2. Sales: 4 KPI + panel bat dau nhanh" -ForegroundColor Cyan
Sign-In 'sales' 'Sales@123'
$titleSales = (Bc-Text '.page-title').text
$kpiSales = Bc-Count '.kpi-card'
Write-Host "     title='$($titleSales -replace '\s+',' ')' | kpis=$kpiSales" -ForegroundColor DarkGray
Bc-Assert ($kpiSales -eq 4) "sales có 4 KPI (=$kpiSales)" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=role-panel-sales]') -eq 1) 'sales có panel bắt đầu nhanh' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=role-panel-admin]') -eq 0) 'sales không có panel admin' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=new-order]') -ge 1) 'sales có nút tạo đơn' | Out-Null
Bc-Assert ($titleSales -ne $titleAdmin) "tiêu đề sales KHÁC admin ('$titleSales' vs '$titleAdmin')" | Out-Null
Bc-Shot 'dash-role-sales' | Out-Null

Write-Host "`n== 3. Viewer: 3 KPI (khong co 'Cho xac nhan') + panel chi doc" -ForegroundColor Cyan
Sign-In 'viewer' 'Viewer@123'
$titleViewer = (Bc-Text '.page-title').text
$kpiViewer = Bc-Count '.kpi-card'
Write-Host "     title='$($titleViewer -replace '\s+',' ')' | kpis=$kpiViewer" -ForegroundColor DarkGray
Bc-Assert ($kpiViewer -eq 3) "viewer có 3 KPI (=$kpiViewer)" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=kpi-pending]') -eq 0) 'viewer KHÔNG thấy KPI "Chờ xác nhận"' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=role-panel-viewer]') -eq 1) 'viewer có panel chỉ đọc' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=new-order]') -eq 0) 'viewer KHÔNG có nút tạo đơn' | Out-Null
Bc-Assert ($titleViewer -ne $titleAdmin -and $titleViewer -ne $titleSales) 'tiêu đề viewer khác 2 role kia' | Out-Null
Bc-Shot 'dash-role-viewer' | Out-Null

Write-Host "`n== 4. Ba dashboard phai khac nhau (so sanh cau truc)" -ForegroundColor Cyan
$sigAdmin = "kpi=$kpiAdmin;panel=admin"
$sigSales = "kpi=$kpiSales;panel=sales"
$sigViewer = "kpi=$kpiViewer;panel=viewer"
Write-Host "     admin=$sigAdmin | sales=$sigSales | viewer=$sigViewer" -ForegroundColor DarkGray
Bc-Assert ($sigAdmin -ne $sigSales -and $sigSales -ne $sigViewer -and $sigAdmin -ne $sigViewer) 'ba dashboard khác nhau thật sự' | Out-Null

Write-Host "`n== 5. Console / network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
$badHttp = @($console.networkErrors | Where-Object { $_.status -ne 409 })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null
Bc-Assert ($badHttp.Count -eq 0) "no HTTP error other than 409 (count=$($badHttp.Count))" | Out-Null

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nROLE DASHBOARDS: ALL PASS" -ForegroundColor Green
