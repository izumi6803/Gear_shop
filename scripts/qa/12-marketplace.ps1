# Scenario 12 — Marketplace: storefront (khách) + back office (admin/sales/viewer)
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/12-marketplace.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

$stamp = Get-Date -Format 'HHmmss'
$newUser = "shopper$stamp"

function Sign-In([string]$user, [string]$pass, [string]$lang = 'en') {
    Bc-Click '[data-testid=logout]' -ErrorAction SilentlyContinue | Out-Null
    Start-Sleep -Milliseconds 900
    Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = $lang } | Out-Null
    Start-Sleep -Milliseconds 1100
    Bc-Fill '[data-testid=login-username]' $user
    Bc-Fill '[data-testid=login-password]' $pass
    Bc-Click '[data-testid=login-submit]'
    Start-Sleep -Milliseconds 2400
}

Write-Host "`n== 1. Storefront xem duoc khi CHUA dang nhap" -ForegroundColor Cyan
Bc-Open "$base/shop" -Storage @{ 'stockflow.lang' = 'en' } | Out-Null
Start-Sleep -Milliseconds 1800
$cards = Bc-Count '.shop-card'
Bc-Assert ($cards -ge 1) "khách chưa đăng nhập thấy sản phẩm (cards=$cards)" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=public-signin]') -eq 1) 'có nút đăng nhập trên storefront công khai' | Out-Null
Bc-Shot 'market-01-public-shop' | Out-Null

Write-Host "`n== 2. Tu dang ky tai khoan mua hang" -ForegroundColor Cyan
Bc-Goto "$base/register" | Out-Null
Start-Sleep -Milliseconds 1200
Bc-Fill '[data-testid=register-username]' $newUser
Bc-Fill '[data-testid=register-password]' 'Shopper@123'
Bc-Fill '[data-testid=register-confirm]' 'Shopper@123'
Bc-Fill '[data-testid=register-display-name]' 'Market Tester'
Bc-Click '[data-testid=register-submit]'
Start-Sleep -Milliseconds 3000
$role = (Bc-Text '.app-user-meta small').text.Trim()
Bc-Assert ($role -eq 'Customer') "tự đăng ký xong vào thẳng cửa hàng với role Customer (=$role)" | Out-Null

Write-Host "`n== 3. Them gio va thanh toan" -ForegroundColor Cyan
$addBtn = '[data-testid=add-P-3001]'
if ((Bc-Count $addBtn) -eq 0) { $addBtn = (Bc-Eval "(() => { const el = document.querySelector('[data-testid^="add-"]'); return el ? '[data-testid=' + el.getAttribute('data-testid') + ']' : ''; })()") }
Bc-Click $addBtn
Start-Sleep -Milliseconds 900
Bc-Click '[data-testid=go-cart]'
Start-Sleep -Milliseconds 1600
$cartTotal = (Bc-Text '[data-testid=cart-total]').text
Bc-Assert ($cartTotal -match '\d') "giỏ hàng có tổng tiền (=${cartTotal})" | Out-Null
Bc-Shot 'market-02-cart' | Out-Null

Bc-Click '[data-testid=cart-checkout]'
Start-Sleep -Milliseconds 1600
Bc-Fill '[data-testid=checkout-note]' '12 Nguyen Hue, Quan 1, HCMC'
Bc-Fill '[data-testid=pay-card-holder]' 'MARKET TESTER'
Bc-Click '[data-testid=pay-submit]'
Start-Sleep -Milliseconds 4200
Bc-WaitUrl '/my-orders' | Out-Null
Bc-Assert ((Bc-Url) -match '/my-orders') 'thanh toán xong chuyển tới Đơn của tôi' | Out-Null
$paid = (Bc-Text '[data-testid^="payment-"]' -All).texts
Bc-Assert (($paid -join ' ') -match 'Paid') "đơn hiển thị đã thanh toán (=${paid})" | Out-Null
Bc-Shot 'market-03-paid' | Out-Null

Write-Host "`n== 4. Admin: tao tai khoan + khoa/mo" -ForegroundColor Cyan
Sign-In 'admin' 'Admin@123'
Bc-Goto "$base/admin/accounts" | Out-Null
Start-Sleep -Milliseconds 2200
Bc-Assert ((Bc-Count '[data-testid^="account-status-"]') -ge 4) 'admin thấy danh sách tài khoản' | Out-Null
Bc-Click '[data-testid=new-account]'
Start-Sleep -Milliseconds 800
$newStaff = "staff$stamp"
Bc-Fill '[data-testid=account-username]' $newStaff
Bc-Fill '[data-testid=account-password]' 'Staff@12345'
Bc-Fill '[data-testid=account-display-name]' 'Staff Tester'
Bc-Click '[data-testid=account-submit]'
Start-Sleep -Milliseconds 2600
$newRowSel = '[data-testid="account-status-' + $newStaff + '"]'
Start-Sleep -Milliseconds 2600
Bc-Assert ((Bc-Count $newRowSel) -eq 1) "tạo được tài khoản $newStaff" | Out-Null
Bc-Click '[data-testid=account-toggle-viewer]'
Start-Sleep -Milliseconds 2400
$viewerStatus = (Bc-Text '[data-testid=account-status-viewer]').text.Trim()
Bc-Assert ($viewerStatus -match 'Disabled') "khoá được tài khoản viewer (=${viewerStatus})" | Out-Null
Bc-Click '[data-testid=account-toggle-viewer]'
Start-Sleep -Milliseconds 2400
$viewerBack = (Bc-Text '[data-testid=account-status-viewer]').text.Trim()
Bc-Assert ($viewerBack -match 'Active') "mở lại được tài khoản viewer (=${viewerBack})" | Out-Null
Bc-Shot 'market-04-admin-accounts' | Out-Null

Write-Host "`n== 5. Admin: so lieu trang thai" -ForegroundColor Cyan
Bc-Goto "$base/admin/status" | Out-Null
Start-Sleep -Milliseconds 2200
$orders = (Bc-Text '[data-testid=stat-orders]').text
$revenue = (Bc-Text '[data-testid=stat-revenue]').text
Bc-Assert ($orders -match '\d') "có số đơn (=$($orders -replace '\s+',' '))" | Out-Null
Bc-Assert ($revenue -match '\$' -or $revenue -match 'US') "có doanh thu đã thu (=$($revenue -replace '\s+',' '))" | Out-Null
Bc-Shot 'market-05-admin-status' | Out-Null

Write-Host "`n== 6. Sales: sua san pham + dieu chinh ton" -ForegroundColor Cyan
Sign-In 'sales' 'Sales@123'
Bc-Goto "$base/staff/products" | Out-Null
Start-Sleep -Milliseconds 2400
Bc-Assert ((Bc-Count '[data-testid^="staff-row-"]') -ge 8) 'sales thấy danh sách sản phẩm' | Out-Null
$before = (Bc-Text '[data-testid="staff-available-P-3002"]').text.Trim()
Bc-Click '[data-testid=staff-adjust-P-3002]'
Start-Sleep -Milliseconds 900
Bc-Fill '[data-testid=adjust-delta]' '3'
Bc-Click '[data-testid=adjust-submit]'
Start-Sleep -Milliseconds 2600
$after = (Bc-Text '[data-testid="staff-available-P-3002"]').text.Trim()
Bc-Assert ($after -eq ([string]([int]$before + 3))) "tồn P-3002 tăng đúng $before → $after" | Out-Null
Bc-Shot 'market-06-sales-products' | Out-Null

Write-Host "`n== 7. Viewer: khong vao duoc khu quan tri" -ForegroundColor Cyan
Sign-In 'viewer' 'Viewer@123'
$nav = (Bc-Text '.app-nav' -All).texts -join '|'
Bc-Assert ($nav -notmatch 'Accounts') 'viewer không thấy mục Tài khoản' | Out-Null
Bc-Assert ($nav -notmatch 'Manage products') 'viewer không thấy mục Quản lý sản phẩm' | Out-Null
Bc-Goto "$base/admin/accounts" | Out-Null
Start-Sleep -Milliseconds 2000
Bc-Assert ((Bc-Url) -notmatch '/admin/accounts') "viewer bị đá khỏi /admin/accounts (url=$(Bc-Url))" | Out-Null
Bc-Goto "$base/staff/products" | Out-Null
Start-Sleep -Milliseconds 2000
Bc-Assert ((Bc-Url) -notmatch '/staff/products') "viewer bị đá khỏi /staff/products (url=$(Bc-Url))" | Out-Null

Write-Host "`n== 8. Console / network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
$badHttp = @($console.networkErrors | Where-Object { $_.status -ne 409 -and $_.status -ne 401 })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null
Bc-Assert ($badHttp.Count -eq 0) "no unexpected HTTP error (count=$($badHttp.Count))" | Out-Null

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nMARKETPLACE: ALL PASS" -ForegroundColor Green
