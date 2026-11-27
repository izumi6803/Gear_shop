# Scenario 03 — Phân quyền route, responsive (mobile), hết phiên (401)
# Chạy: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/03-rbac-responsive.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

function Login([string]$user, [string]$pass) {
    Bc-Fill '[data-testid=login-username]' $user
    Bc-Fill '[data-testid=login-password]' $pass
    Bc-Click '[data-testid=login-submit]'
    Start-Sleep -Milliseconds 1500
}

Write-Host "`n== 1. Viewer: nút nghiệp vụ phải bị ẩn (đã có dữ liệu đơn)" -ForegroundColor Cyan
Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
Start-Sleep -Milliseconds 700
Start-Sleep -Milliseconds 600
Login 'viewer' 'Viewer@123'
Bc-Click '[data-testid=nav-orders]'
Start-Sleep -Milliseconds 1500
# Nếu DB sạch (0 đơn) thì tạo 1 đơn qua API để bước kiểm tra có dữ liệu.
$adminTok = (Invoke-RestMethod -Method Post -Uri 'http://localhost:5081/api/auth/login' -ContentType 'application/json' -Body '{"username":"admin","password":"Admin@123"}').accessToken
$adminH = @{ Authorization = "Bearer $adminTok" }
$existing = (Invoke-RestMethod 'http://localhost:5081/api/orders?page=1&pageSize=1' -Headers $adminH).totalCount
if ($existing -eq 0) {
    $cust = (Invoke-RestMethod 'http://localhost:5081/api/customers' -Headers $adminH)[0]
    $body = "{`"customerId`":$($cust.id),`"orderDate`":`"2026-11-27`",`"lines`":[{`"productId`":1,`"warehouseId`":1,`"quantity`":1}],`"note`":`"AutoSeedOrder`"}"
    $created = Invoke-RestMethod -Method Post -Uri 'http://localhost:5081/api/orders' -Headers $adminH -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json'
    Invoke-RestMethod -Method Post -Uri "http://localhost:5081/api/orders/$($created.id)/confirm" -Headers $adminH | Out-Null
    Write-Host "     (đã tạo đơn $($created.orderNo) để kiểm tra)" -ForegroundColor DarkGray
    Bc-Goto "$base/orders" | Out-Null
    Start-Sleep -Milliseconds 1800
}
$rows = Bc-Count 'tbody tr'
Bc-Assert ($rows -ge 1) "có dữ liệu đơn để kiểm tra (rows=$rows)" | Out-Null
$confirmButtons = Bc-Count 'role=button[name="Xác nhận"]'
$shipButtons = Bc-Count 'role=button[name="Xuất kho"]'
$cancelButtons = Bc-Count 'role=button[name="Huỷ"]'
$detailButtons = Bc-Count 'role=button[name="Xem chi tiết"]'
Bc-Assert ($confirmButtons -eq 0) "viewer không thấy nút Xác nhận (=$confirmButtons)" | Out-Null
Bc-Assert ($shipButtons -eq 0) "viewer không thấy nút Xuất kho (=$shipButtons)" | Out-Null
Bc-Assert ($cancelButtons -eq 0) "viewer không thấy nút Huỷ (=$cancelButtons)" | Out-Null
Bc-Assert ($detailButtons -eq $rows) "viewer vẫn xem được chi tiết ($detailButtons/$rows dòng)" | Out-Null
Bc-Shot 'qa-07-viewer-readonly' | Out-Null

Write-Host "`n== 2. Viewer mở thẳng /orders/new bằng URL → phải bị chặn" -ForegroundColor Cyan
Bc-Goto "$base/orders/new" | Out-Null
Start-Sleep -Milliseconds 1500
$url = Bc-Url
$formCount = Bc-Count '#customer'
Bc-Assert ($formCount -eq 0) "viewer KHÔNG thấy form tạo đơn (url=$url, form=$formCount)" | Out-Null

Write-Host "`n== 3. Hết phiên: token bị xoá → điều hướng về /login" -ForegroundColor Cyan
Bc-Eval 'sessionStorage.clear()' | Out-Null
Bc-Click '[data-testid=nav-dashboard]'
Start-Sleep -Milliseconds 1800
$afterExpiry = Bc-WaitUrl '*/login'
Bc-Assert ($afterExpiry -like '*/login') "không còn token → về /login (url=$afterExpiry)" | Out-Null

Write-Host "`n== 4. Responsive: mobile 390x844" -ForegroundColor Cyan
    # Context mới cho mobile: đổi viewport tại chỗ làm Playwright treo trang.
    Bc-Open "$base/login" -Width 390 -Height 844 -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
    Start-Sleep -Milliseconds 1600
Start-Sleep -Milliseconds 800
Login 'sales' 'Sales@123'
Bc-Assert ((Bc-Url) -notlike '*/login') 'đăng nhập trên mobile viewport' | Out-Null
Bc-Shot 'qa-08-mobile-dashboard' | Out-Null

$overflow = Bc-Eval 'document.documentElement.scrollWidth - document.documentElement.clientWidth'
Bc-Assert ([int]$overflow -le 1) "dashboard mobile không tràn ngang (overflow=${overflow}px)" | Out-Null

Bc-Click '[data-testid=nav-orders]'
Start-Sleep -Milliseconds 1500
Bc-Shot 'qa-09-mobile-orders' | Out-Null
$overflowOrders = Bc-Eval 'document.documentElement.scrollWidth - document.documentElement.clientWidth'
Write-Host "     overflow trang đơn hàng: ${overflowOrders}px (bảng rộng hơn màn hình là chấp nhận được nếu chỉ cuộn trong bảng)" -ForegroundColor DarkGray

$navToggle = Bc-Count '[data-testid=nav-dashboard]'
Bc-Assert ($navToggle -ge 1) 'nav vẫn dùng được trên mobile' | Out-Null

Write-Host "`n== 5. Về desktop viewport, kiểm tra log" -ForegroundColor Cyan
Bc-Viewport -Width 1440 -Height 900
Start-Sleep -Milliseconds 600
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
Bc-Assert ($pageErrors.Count -eq 0) "không có JS exception (count=$($pageErrors.Count))" | Out-Null
if ($pageErrors.Count -gt 0) {
    $pageErrors | ForEach-Object { Write-Host "     $($_.text)" -ForegroundColor DarkGray }
}

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) kiểm tra THẤT BẠI" -ForegroundColor Red
    exit 1
}

Write-Host "`nRBAC + RESPONSIVE: TẤT CẢ PASS" -ForegroundColor Green
