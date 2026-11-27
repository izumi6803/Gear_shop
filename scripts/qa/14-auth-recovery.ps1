# Scenario 14 — Logout phải reset trang + Đăng ký hoàn chỉnh + Quên/đặt lại mật khẩu
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/14-auth-recovery.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }
$stamp = Get-Date -Format 'HHmmss'
$newUser = "acc$stamp"

function Login([string]$user, [string]$pass, [string]$lang = 'en') {
    Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = $lang } | Out-Null
    Start-Sleep -Milliseconds 1200
    Bc-Fill '[data-testid=login-username]' $user
    Bc-Fill '[data-testid=login-password]' $pass
    Bc-Click '[data-testid=login-submit]'
    Start-Sleep -Milliseconds 2600
}

Write-Host "`n== 1. Dang xuat phai dua ve /login va KHONG nho trang cu" -ForegroundColor Cyan
Login 'customer' 'Customer@123'
Bc-Goto "$base/my-orders" | Out-Null
Start-Sleep -Milliseconds 2000
Bc-Assert ((Bc-Url) -match '/my-orders') "khách vào được /my-orders (url=$(Bc-Url))" | Out-Null
Bc-Shot 'auth-01-customer-page' | Out-Null

Bc-Click '[data-testid=logout]'
Start-Sleep -Milliseconds 1500
Bc-Assert ((Bc-Url) -match '/login') "logout quay về /login (url=$(Bc-Url))" | Out-Null
Bc-Shot 'auth-02-after-logout' | Out-Null

Bc-Fill '[data-testid=login-username]' 'admin'
Bc-Fill '[data-testid=login-password]' 'Admin@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2800
$adminUrl = Bc-Url
Bc-Assert ($adminUrl -notmatch '/my-orders') "admin KHÔNG bị đưa lại trang của customer (url=$adminUrl)" | Out-Null
Bc-Assert ($adminUrl -notmatch '/checkout') "admin không vào /checkout" | Out-Null
Bc-Assert ($adminUrl -match "$base/") "admin vào trang chủ của mình (url=$adminUrl)" | Out-Null
Bc-Shot 'auth-03-admin-after-customer' | Out-Null

Write-Host "`n== 2. Route cua customer bi chan voi role khac" -ForegroundColor Cyan
Bc-Goto "$base/my-orders" | Out-Null
Start-Sleep -Milliseconds 2000
Bc-Assert ((Bc-Url) -notmatch '/my-orders') "admin gõ /my-orders bị đá đi (url=$(Bc-Url))" | Out-Null
Bc-Goto "$base/checkout" | Out-Null
Start-Sleep -Milliseconds 2000
Bc-Assert ((Bc-Url) -notmatch '/checkout') "admin gõ /checkout bị đá đi (url=$(Bc-Url))" | Out-Null
Bc-Click '[data-testid=logout]'
Start-Sleep -Milliseconds 1200

Write-Host "`n== 3. Dang ky: validate phia client" -ForegroundColor Cyan
Bc-Goto "$base/register" | Out-Null
Start-Sleep -Milliseconds 1600
Bc-Fill '[data-testid=register-username]' 'ab'
Bc-Fill '[data-testid=register-password]' 'Shopper@123'
Bc-Fill '[data-testid=register-confirm]' 'Shopper@123'
Bc-Click '[data-testid=register-submit]'
Start-Sleep -Milliseconds 1200
$err1 = (Bc-Text '[data-testid=register-error]').text
Bc-Assert ($err1 -match '3') "báo lỗi tên đăng nhập quá ngắn (=$err1)" | Out-Null

Bc-Fill '[data-testid=register-username]' $newUser
Bc-Fill '[data-testid=register-password]' 'Shopper@123'
Bc-Fill '[data-testid=register-confirm]' 'Khac@123'
Bc-Click '[data-testid=register-submit]'
Start-Sleep -Milliseconds 1200
$err2 = (Bc-Text '[data-testid=register-error]').text
Bc-Assert ($err2 -match 'khớp|match') "báo lỗi nhập lại mật khẩu không khớp (=$err2)" | Out-Null

Bc-Fill '[data-testid=register-confirm]' 'Shopper@123'
Bc-Fill '[data-testid=register-email]' 'khong-phai-email'
Bc-Click '[data-testid=register-submit]'
Start-Sleep -Milliseconds 1200
$err3 = (Bc-Text '[data-testid=register-error]').text
Bc-Assert ($err3 -match 'Email|email') "báo lỗi email sai định dạng (=$err3)" | Out-Null
Bc-Shot 'auth-04-register-validation' | Out-Null

Write-Host "`n== 4. Dang ky hop le" -ForegroundColor Cyan
Bc-Fill '[data-testid=register-email]' "$newUser@shop.local"
Bc-Click '[data-testid=register-submit]'
Start-Sleep -Milliseconds 3200
Bc-Assert ((Bc-Url) -match '/shop') "đăng ký xong vào cửa hàng (url=$(Bc-Url))" | Out-Null
$role = (Bc-Text '.app-user-meta small').text.Trim()
Bc-Assert ($role -eq 'Customer') "tài khoản mới có role Customer (=$role)" | Out-Null
Bc-Shot 'auth-05-registered' | Out-Null
Bc-Click '[data-testid=logout]'
Start-Sleep -Milliseconds 1300

Write-Host "`n== 5. Quen mat khau: lay ma dat lai" -ForegroundColor Cyan
Bc-Goto "$base/forgot-password" | Out-Null
Start-Sleep -Milliseconds 1600
Bc-Fill '[data-testid=forgot-identifier]' $newUser
Bc-Click '[data-testid=forgot-submit]'
Start-Sleep -Milliseconds 2600
$hasResult = (Bc-Count '[data-testid=forgot-result]')
Bc-Assert ($hasResult -eq 1) "hiện kết quả yêu cầu đặt lại (=$hasResult)" | Out-Null
$resetToken = (Bc-Eval "(() => { const el = document.querySelector('[data-testid=forgot-token]'); return el ? el.textContent.trim() : ''; })()")
Bc-Assert ([bool]$resetToken) "nhận được mã đặt lại (=$resetToken)" | Out-Null
Bc-Shot 'auth-06-forgot-token' | Out-Null

Write-Host "`n== 6. Dat lai mat khau bang ma" -ForegroundColor Cyan
Bc-Click '[data-testid=forgot-open-reset]'
Start-Sleep -Milliseconds 2200
Bc-Assert ((Bc-Url) -match '/reset-password') "mở được trang đặt lại (url=$(Bc-Url))" | Out-Null
Bc-Fill '[data-testid=reset-password]' 'NewPass@456'
Bc-Fill '[data-testid=reset-confirm]' 'NewPass@456'
Bc-Shot 'auth-07-reset-form' | Out-Null
Bc-Click '[data-testid=reset-submit]'
Start-Sleep -Milliseconds 3000
$done = (Bc-Count '[data-testid=reset-done]')
Bc-Assert ($done -eq 1) "đặt lại mật khẩu thành công (=$done)" | Out-Null
Bc-Shot 'auth-08-reset-done' | Out-Null

Write-Host "`n== 7. Mat khau cu khong con dung, mat khau moi dang nhap duoc" -ForegroundColor Cyan
Bc-Goto "$base/login" | Out-Null
Start-Sleep -Milliseconds 1500
Bc-Fill '[data-testid=login-username]' $newUser
Bc-Fill '[data-testid=login-password]' 'Shopper@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2600
$oldFails = (Bc-Count '[data-testid=login-error]')
Bc-Assert ($oldFails -eq 1) "mật khẩu cũ bị từ chối (=$oldFails)" | Out-Null

Bc-Fill '[data-testid=login-username]' $newUser
Bc-Fill '[data-testid=login-password]' 'NewPass@456'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 3000
Bc-Assert ((Bc-Url) -match '/shop') "mật khẩu mới đăng nhập được (url=$(Bc-Url))" | Out-Null
Bc-Shot 'auth-09-new-password-login' | Out-Null

Write-Host "`n== 8. Ma dat lai chi dung 1 lan" -ForegroundColor Cyan
$reuse = $false
try {
    $body = @{ token = $resetToken; newPassword = 'Another@789' } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri 'http://localhost:5081/api/auth/reset-password' -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
} catch {
    $reuse = $true
}
Bc-Assert $reuse 'dùng lại mã cũ bị từ chối' | Out-Null

Write-Host "`n== 9. Khong lo thong tin tai khoan ton tai" -ForegroundColor Cyan
$unknown = Invoke-RestMethod -Method Post -Uri 'http://localhost:5081/api/auth/forgot-password' -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes('{"usernameOrEmail":"khong-ton-tai-123"}'))
Bc-Assert ($null -eq $unknown.resetToken) "không trả mã cho tài khoản không tồn tại (=$($unknown.resetToken))" | Out-Null
Bc-Assert ([bool]$unknown.message) "vẫn trả thông báo chung (=$($unknown.message))" | Out-Null

Write-Host "`n== 10. Console / network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
$badHttp = @($console.networkErrors | Where-Object { $_.status -notin 400, 401, 409 })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null
Bc-Assert ($badHttp.Count -eq 0) "no unexpected HTTP error (count=$($badHttp.Count))" | Out-Null

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nAUTH RECOVERY: ALL PASS" -ForegroundColor Green
