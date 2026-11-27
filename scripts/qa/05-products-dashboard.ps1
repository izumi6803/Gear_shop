# Scenario 05 — Trang hàng hoá & tồn kho + Dashboard (số liệu KPI, cảnh báo tồn thấp)
# Chạy: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/05-products-dashboard.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

Write-Host "`n== 0. Đăng nhập sales" -ForegroundColor Cyan
Bc-Open "$base/login" | Out-Null
Bc-Eval "localStorage.setItem('stockflow.lang','vi')" | Out-Null
Bc-Goto "$base/login" | Out-Null
Start-Sleep -Milliseconds 700
Start-Sleep -Milliseconds 700
Bc-Fill '[data-testid=login-username]' 'sales'
Bc-Fill '[data-testid=login-password]' 'Sales@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 1600
Bc-Assert ((Bc-Url) -notlike '*/login') 'đăng nhập OK' | Out-Null
Bc-Console -Clear | Out-Null

Write-Host "`n== 1. Dashboard: KPI khớp với API" -ForegroundColor Cyan
Bc-Goto "$base/" | Out-Null
Start-Sleep -Milliseconds 1500
$kpis = (Bc-Text '.kpi-card' -All).texts
Write-Host "     KPI: $($kpis -join ' | ')" -ForegroundColor DarkGray
Bc-Assert ($kpis.Count -eq 4) "có 4 thẻ KPI (=$($kpis.Count))" | Out-Null

# Lấy số đơn thật từ API ngay trong context của trang (dùng token trong sessionStorage)
$apiOrders = Bc-Eval "fetch('/ordering-api/api/orders?page=1&pageSize=1',{headers:{Authorization:'Bearer '+sessionStorage.getItem('stockflow.token')}}).then(r=>r.json()).then(d=>String(d.totalCount))"
$kpiOrders = ($kpis[0] -replace '[^\d]', '')
Write-Host "     API totalCount=$apiOrders | KPI hiển thị=$kpiOrders" -ForegroundColor DarkGray
Bc-Assert ($kpiOrders -eq $apiOrders) "KPI 'Đơn hàng' khớp API ($kpiOrders = $apiOrders)" | Out-Null

Write-Host "`n== 2. Dashboard: danh sách tồn kho thấp (≤ 20) phải có nghĩa" -ForegroundColor Cyan
$alerts = Bc-Count '.alert-list li'
Write-Host "     số dòng cảnh báo tồn thấp: $alerts" -ForegroundColor DarkGray
if ($alerts -gt 0) {
    $firstAlert = (Bc-Text '.alert-list li:first-child').text
    Write-Host "     dòng đầu: $firstAlert" -ForegroundColor DarkGray
    Bc-Assert ($firstAlert -match 'P-\d+') 'cảnh báo hiển thị mã hàng' | Out-Null
}

Write-Host "`n== 3. Trang hàng hoá: tìm kiếm theo mã" -ForegroundColor Cyan
Bc-Goto "$base/products" | Out-Null
Start-Sleep -Milliseconds 1500
$allProducts = Bc-Count 'tbody tr' -Within '.panel:first-child'
Write-Host "     tổng dòng (products panel): $allProducts" -ForegroundColor DarkGray

Bc-Fill '[data-testid=product-search]' 'P-1001'
Start-Sleep -Milliseconds 700
$filtered = Bc-Count 'tbody tr' -Within '.panel:first-child'
Write-Host "     sau khi tìm 'P-1001': $filtered dòng" -ForegroundColor DarkGray
Bc-Assert ($filtered -lt $allProducts) 'tìm kiếm làm giảm số dòng' | Out-Null
Bc-Assert ($filtered -ge 1) 'tìm thấy ít nhất 1 kết quả' | Out-Null

Write-Host "`n== 4. Tìm chuỗi không tồn tại → empty state" -ForegroundColor Cyan
Bc-Fill '[data-testid=product-search]' 'ZZZ-KHONG-TON-TAI'
Start-Sleep -Milliseconds 700
$emptyState = Bc-Count '.app-empty'
Bc-Assert ($emptyState -ge 1) "hiện empty state khi không có kết quả (=$emptyState)" | Out-Null
Bc-Shot 'qa-11-products-empty-search' | Out-Null

Write-Host "`n== 5. Lọc theo kho" -ForegroundColor Cyan
Bc-Fill '[data-testid=product-search]' ''
Start-Sleep -Milliseconds 500
$stockAll = Bc-Count 'tbody tr' -Within '.panel:last-child'
Bc-Select '[data-testid=warehouse-filter]' -Index 1
Start-Sleep -Milliseconds 700
$stockOne = Bc-Count 'tbody tr' -Within '.panel:last-child'
Write-Host "     tồn kho: tất cả=$stockAll, sau lọc 1 kho=$stockOne" -ForegroundColor DarkGray
Bc-Assert ($stockOne -lt $stockAll) 'lọc theo kho làm giảm số dòng' | Out-Null
Bc-Assert ($stockOne -gt 0) 'vẫn còn dòng sau khi lọc' | Out-Null

Write-Host "`n== 6. Bảng tồn kho: khả dụng = thực tế − đã giữ" -ForegroundColor Cyan
$rowText = (Bc-Text 'tbody tr:first-child' -Within '.panel:last-child').text
Write-Host "     dòng đầu: $($rowText -replace '\s+',' ')" -ForegroundColor DarkGray
$cells = (Bc-Text 'td' -All -Within 'tbody tr:first-child').texts
if ($cells.Count -ge 5) {
    $onHand = [int]($cells[$cells.Count - 3] -replace '[^\d]', '')
    $reserved = [int]($cells[$cells.Count - 2] -replace '[^\d]', '')
    $available = [int]($cells[$cells.Count - 1] -replace '[^\d]', '')
    Write-Host "     onHand=$onHand reserved=$reserved available=$available" -ForegroundColor DarkGray
    Bc-Assert ($available -eq ($onHand - $reserved)) "available = onHand − reserved ($available = $onHand − $reserved)" | Out-Null
}
Bc-Shot 'qa-12-products-filtered' | Out-Null

Write-Host "`n== 7. Toast tự tắt sau ~5s" -ForegroundColor Cyan
Bc-Goto "$base/orders" | Out-Null
Start-Sleep -Milliseconds 1400

# Tìm một dòng Draft bất kỳ (dữ liệu thay đổi sau mỗi lần chạy scenario khác)
$draftRow = ''
$rowCount = Bc-Count 'tbody tr'
for ($i = 1; $i -le $rowCount; $i++) {
    if ((Bc-Text "tbody tr:nth-child($i) .status-pill").text -eq 'Draft') {
        $draftRow = "tbody tr:nth-child($i)"
        break
    }
}

if ($draftRow -eq '') {
    Write-Host "     (không có đơn Draft — bỏ qua kiểm tra toast)" -ForegroundColor DarkGray
}
else {
    Bc-Click 'role=button[name="Xác nhận"]' -Within $draftRow
    Start-Sleep -Milliseconds 1500
    $toastNow = Bc-Count '.app-toast'
    Write-Host "     toast ngay sau thao tác: $toastNow" -ForegroundColor DarkGray
    Start-Sleep -Seconds 6
    $toastLater = Bc-Count '.app-toast'
    Write-Host "     toast sau 6s: $toastLater" -ForegroundColor DarkGray
    Bc-Assert ($toastLater -eq 0) "toast tự tắt (còn $toastLater)" | Out-Null
}

Write-Host "`n== 8. Log/network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
$badHttp = @($console.networkErrors | Where-Object { $_.status -ne 409 })
Bc-Assert ($pageErrors.Count -eq 0) "không có JS exception (count=$($pageErrors.Count))" | Out-Null
Bc-Assert ($badHttp.Count -eq 0) "không có HTTP lỗi ngoài 409 (count=$($badHttp.Count))" | Out-Null
if ($badHttp.Count -gt 0) { $badHttp | ForEach-Object { Write-Host "     $($_.status) $($_.url)" -ForegroundColor DarkGray } }

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) kiểm tra THẤT BẠI" -ForegroundColor Red
    exit 1
}

Write-Host "`nPRODUCTS + DASHBOARD: TẤT CẢ PASS" -ForegroundColor Green
