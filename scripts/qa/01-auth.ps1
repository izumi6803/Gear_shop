# Scenario 01 — Xác thực & phân quyền
# Chạy: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/01-auth.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

Write-Host "`n== 1. Chưa đăng nhập → phải về /login" -ForegroundColor Cyan
Bc-Open $base | Out-Null
Bc-Eval "localStorage.setItem('stockflow.lang','vi')" | Out-Null
Bc-Goto "$base/login" | Out-Null
Start-Sleep -Milliseconds 700
Start-Sleep -Milliseconds 800
Bc-Assert ((Bc-Url) -like '*/login') "redirect /login (url=$(Bc-Url))" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=login-submit]') -eq 1) 'có nút Đăng nhập' | Out-Null

Write-Host "`n== 2. Sai mật khẩu → hiện lỗi, không vào được app" -ForegroundColor Cyan
Bc-Fill '[data-testid=login-username]' 'sales'
Bc-Fill '[data-testid=login-password]' 'sai-mat-khau'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 1200
$alertCount = Bc-Count '.alert-danger'
Bc-Assert ($alertCount -eq 1) "có alert lỗi (count=$alertCount)" | Out-Null
if ($alertCount -ge 1) {
    $message = (Bc-Text '.alert-danger').text
    Write-Host "     message: $message" -ForegroundColor DarkGray
    Bc-Assert ($message -match 'Sai tài khoản|mật khẩu') 'message nói rõ sai tài khoản/mật khẩu' | Out-Null
}
Bc-Assert ((Bc-Url) -like '*/login') 'vẫn ở /login' | Out-Null
Bc-Shot 'qa-02-login-error' | Out-Null

# Lần đăng nhập sai chủ động sinh 401 → xoá buffer để phần kiểm tra cuối chỉ tính lỗi thật.
Bc-Console -Clear | Out-Null

Write-Host "`n== 3. Đăng nhập viewer → chỉ đọc" -ForegroundColor Cyan
Bc-Fill '[data-testid=login-username]' 'viewer'
Bc-Fill '[data-testid=login-password]' 'Viewer@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 1500
Bc-Assert ((Bc-Url) -notlike '*/login') "đăng nhập thành công (url=$(Bc-Url))" | Out-Null
Bc-Assert ((Bc-Count 'role=heading[name=/Tổng quan/]') -ge 1) 'thấy dashboard' | Out-Null
$createLinks = Bc-Count 'role=link[name=/Tạo đơn/]'
Bc-Assert ($createLinks -eq 0) "viewer KHÔNG thấy link Tạo đơn (count=$createLinks)" | Out-Null

Write-Host "`n== 4. Viewer vào trang đơn hàng" -ForegroundColor Cyan
Bc-Click '[data-testid=nav-orders]'
Start-Sleep -Milliseconds 1200
Bc-Assert ((Bc-Url) -like '*/orders') "ở /orders (url=$(Bc-Url))" | Out-Null
$actionButtons = Bc-Count 'role=button[name="Xác nhận"]'
Write-Host "     nút 'Xác nhận' hiển thị với viewer: $actionButtons" -ForegroundColor DarkGray
Bc-Shot 'qa-03-viewer-orders' | Out-Null

Write-Host "`n== 5. Đăng xuất → về /login" -ForegroundColor Cyan
Bc-Click '[data-testid=logout]'
Start-Sleep -Milliseconds 1000
Bc-Assert ((Bc-Url) -like '*/login') "đăng xuất quay về /login (url=$(Bc-Url))" | Out-Null

Write-Host "`n== 6. Đăng nhập sales → có quyền nghiệp vụ" -ForegroundColor Cyan
Bc-Fill '[data-testid=login-username]' 'sales'
Bc-Fill '[data-testid=login-password]' 'Sales@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 1500
Bc-Assert ((Bc-Count 'role=link[name=/Tạo đơn/]') -ge 1) 'sales thấy link Tạo đơn' | Out-Null

$console = Bc-Console -Clear
Bc-Assert ($console.console.Count -eq 0) "không có console error (count=$($console.console.Count))" | Out-Null
Bc-Assert ($console.networkErrors.Count -eq 0) "không có HTTP >= 400 (count=$($console.networkErrors.Count))" | Out-Null
if ($console.networkErrors.Count -gt 0) {
    $console.networkErrors | ForEach-Object { Write-Host "     $($_.status) $($_.url)" -ForegroundColor DarkGray }
}

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) kiểm tra THẤT BẠI" -ForegroundColor Red
    exit 1
}

Write-Host "`nAUTH FLOW: TẤT CẢ PASS" -ForegroundColor Green
