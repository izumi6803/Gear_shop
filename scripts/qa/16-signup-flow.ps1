# Scenario 16 — Đăng ký 2 bước (chia đôi màn) cho khách mới
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/16-signup-flow.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }
$stamp = Get-Date -Format 'HHmmss'
$mail = "signup$stamp@shop.local"
$pass = 'Shopper@123'

function FieldError([string]$key) {
    $json = Bc-Eval "(() => { const e = document.querySelector('[data-testid=register-error-$key]'); return e ? e.textContent.trim() : ''; })()"
    return $json
}

Write-Host "`n== 1. Trang dang ky: buoc 1 + panel loi ich" -ForegroundColor Cyan
Bc-Open "$base/register" -Storage @{ 'stockflow.lang' = 'vi' } -Width 1280 -Height 900 | Out-Null
Start-Sleep -Milliseconds 1800
Bc-Assert ((Bc-Count '[data-testid=register-email]') -eq 1) 'có ô email ở bước 1' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=register-next]') -eq 1) 'có nút Tiếp' | Out-Null
Bc-Assert ((Bc-Count '[data-testid=register-submit]') -eq 0) 'chưa hiện bước 2' | Out-Null
$panelShown = (Bc-Eval "getComputedStyle(document.querySelector('.reg-benefits')).display !== 'none'")
Bc-Assert ($panelShown) 'desktop 1280 hiện panel lợi ích bên trái' | Out-Null
Bc-Shot 'signup-16-01-step1' | Out-Null

Write-Host "`n== 2. Bam Tiep khi trong: loi tung o, van o buoc 1" -ForegroundColor Cyan
Bc-Click '[data-testid=register-next]'
Start-Sleep -Milliseconds 1100
$e1 = FieldError 'email'
$e2 = FieldError 'password'
Bc-Assert ($e1 -match 'mail') "báo lỗi thiếu email (=$e1)" | Out-Null
Bc-Assert ($e2 -match '6') "báo lỗi mật khẩu ngắn (=$e2)" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=register-email]') -eq 1) 'vẫn ở bước 1' | Out-Null
Bc-Shot 'signup-16-02-errors' | Out-Null

Write-Host "`n== 3. Email sai dinh dang + nhap lai khong khop" -ForegroundColor Cyan
Bc-Fill '[data-testid=register-email]' 'khong-phai-email'
Bc-Fill '[data-testid=register-password]' $pass
Bc-Fill '[data-testid=register-confirm]' 'Khac@123'
Bc-Click '[data-testid=register-next]'
Start-Sleep -Milliseconds 1100
$e3 = FieldError 'email'
$e4 = FieldError 'confirm'
Bc-Assert ($e3 -match 'Email|email') "báo lỗi email sai định dạng (=$e3)" | Out-Null
Bc-Assert ($e4 -match 'khớp|match') "báo lỗi nhập lại mật khẩu không khớp (=$e4)" | Out-Null

Write-Host "`n== 4. Du lieu hop le: sang buoc 2, khong goi API" -ForegroundColor Cyan
Bc-Fill '[data-testid=register-email]' $mail
Bc-Fill '[data-testid=register-confirm]' $pass
Bc-Click '[data-testid=register-next]'
Start-Sleep -Milliseconds 1300
Bc-Assert ((Bc-Count '[data-testid=register-submit]') -eq 1) 'hiện bước 2 (nút Hoàn tất)' | Out-Null
$title = (Bc-Text '.reg-title').text
Bc-Assert ($title -match 'Giao hàng|deliver') "tiêu đề bước 2 đổi (=$title)" | Out-Null
$stepNow = (Bc-Eval "document.querySelectorAll('.reg-step.is-current').length")
Bc-Assert ($stepNow -eq 1) 'thanh tiến trình đánh dấu đúng bước (1 mục đang chọn)' | Out-Null
Bc-Shot 'signup-16-03-step2' | Out-Null

Write-Host "`n== 5. So dien thoai sai: chan lai o buoc 2" -ForegroundColor Cyan
Bc-Fill '[data-testid=register-phone]' 'abc'
Bc-Click '[data-testid=register-submit]'
Start-Sleep -Milliseconds 1200
$e5 = FieldError 'phone'
Bc-Assert ($e5 -match 'điện thoại|phone|đúng') "báo lỗi số điện thoại (=$e5)" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=register-submit]') -eq 1) 'vẫn ở bước 2, chưa tạo tài khoản' | Out-Null

Write-Host "`n== 6. Bo qua: tao tai khoan voi du lieu toi thieu" -ForegroundColor Cyan
Bc-Fill '[data-testid=register-phone]' ''
Bc-Click '[data-testid=register-skip]'
Start-Sleep -Milliseconds 3600
Bc-Assert ((Bc-Url) -match '/shop') "bỏ qua xong vào cửa hàng (url=$(Bc-Url))" | Out-Null
$role = (Bc-Text '.app-user-meta small').text.Trim()
Bc-Assert ($role -eq 'Customer') "tài khoản mới có role Customer (=$role)" | Out-Null
Bc-Shot 'signup-16-04-skipped' | Out-Null

Write-Host "`n== 7. Dang xuat roi dang nhap lai bang email" -ForegroundColor Cyan
Bc-Click '[data-testid=logout]'
Start-Sleep -Milliseconds 1400
Bc-Goto "$base/login" | Out-Null
Start-Sleep -Milliseconds 1400
Bc-Fill '[data-testid=login-username]' $mail
Bc-Fill '[data-testid=login-password]' $pass
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 3000
Bc-Assert ((Bc-Url) -match '/shop') "đăng nhập lại bằng email vừa đăng ký (url=$(Bc-Url))" | Out-Null

Write-Host "`n== 8. Email da dung: bao ro, quay ve buoc 1" -ForegroundColor Cyan
Bc-Click '[data-testid=logout]'
Start-Sleep -Milliseconds 1300
Bc-Goto "$base/register" | Out-Null
Start-Sleep -Milliseconds 1500
Bc-Fill '[data-testid=register-email]' $mail
Bc-Fill '[data-testid=register-password]' $pass
Bc-Fill '[data-testid=register-confirm]' $pass
Bc-Click '[data-testid=register-next]'
Start-Sleep -Milliseconds 1100
Bc-Click '[data-testid=register-submit]'
Start-Sleep -Milliseconds 3000
$dup = (Bc-Eval "(() => { const a = document.querySelector('[data-testid=register-error]'); return a ? a.textContent.trim() : ''; })()")
Bc-Assert ([bool]$dup) "email trùng thì báo lỗi (=$dup)" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=register-email]') -eq 1) 'quay về bước 1 để sửa email' | Out-Null
Bc-Shot 'signup-16-05-duplicate' | Out-Null

Write-Host "`n== 9. Mobile 390: khong tran ngang, an panel trai" -ForegroundColor Cyan
Bc-Open "$base/register" -Width 390 -Height 844 | Out-Null
Start-Sleep -Milliseconds 1800
$overflow = (Bc-Eval "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
Bc-Assert (-not $overflow) 'không tràn ngang ở 390px' | Out-Null
$panelHidden = (Bc-Eval "getComputedStyle(document.querySelector('.reg-benefits')).display === 'none'")
Bc-Assert ($panelHidden) 'mobile ẩn panel lợi ích' | Out-Null
Bc-Shot 'signup-16-06-mobile' | Out-Null

Write-Host "`n== 10. Console" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nSIGNUP FLOW: ALL PASS" -ForegroundColor Green
