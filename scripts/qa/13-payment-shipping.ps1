# Scenario 13 — Hai phương thức thanh toán (online / tiền mặt) + phí vận chuyển
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/13-payment-shipping.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }
$stamp = Get-Date -Format 'HHmmss'
$shopper = "pay$stamp"

function Sign-In([string]$user, [string]$pass) {
    Bc-Click '[data-testid=logout]' -ErrorAction SilentlyContinue | Out-Null
    Start-Sleep -Milliseconds 900
    Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'en' } | Out-Null
    Start-Sleep -Milliseconds 1100
    Bc-Fill '[data-testid=login-username]' $user
    Bc-Fill '[data-testid=login-password]' $pass
    Bc-Click '[data-testid=login-submit]'
    Start-Sleep -Milliseconds 2400
}

function Register-Shopper([string]$user) {
    Bc-Open "$base/register" -Storage @{ 'stockflow.lang' = 'en' } | Out-Null
    Start-Sleep -Milliseconds 1400
    Bc-Fill '[data-testid=register-username]' $user
    Bc-Fill '[data-testid=register-password]' 'Shopper@123'
    Bc-Fill '[data-testid=register-confirm]' 'Shopper@123'
    Bc-Fill '[data-testid=register-display-name]' 'Pay Tester'
    Bc-Click '[data-testid=register-submit]'
    Start-Sleep -Milliseconds 3000
}

function Add-ToCart([string]$code, [int]$qty = 1) {
    Bc-Goto "$base/shop" | Out-Null
    Start-Sleep -Milliseconds 1600
    Bc-Click "[data-testid=add-$code]"
    Start-Sleep -Milliseconds 900
    if ($qty -gt 1) {
        Bc-Goto "$base/cart" | Out-Null
        Start-Sleep -Milliseconds 1400
        Bc-Fill "[data-testid=cart-qty-$code]" "$qty"
        Start-Sleep -Milliseconds 700
    }
}

Write-Host "`n== 1. Phi van chuyen: don nho (< 500) phai thu 15" -ForegroundColor Cyan
Register-Shopper $shopper
Add-ToCart 'P-4001' 1
Bc-Goto "$base/cart" | Out-Null
Start-Sleep -Milliseconds 1600
$shipSmall = (Bc-Text '[data-testid=cart-shipping]').text
Bc-Assert ($shipSmall -match '15') "giỏ nhỏ: phí ship = 15 (=$shipSmall)" | Out-Null
Bc-Shot 'ship-01-cart-small' | Out-Null

Write-Host "`n== 2. Dat hang COD (tien mat)" -ForegroundColor Cyan
Bc-Click '[data-testid=cart-checkout]'
Start-Sleep -Milliseconds 1700
Bc-Fill '[data-testid=checkout-note]' '45 Le Loi, Quan 1, HCMC'
$method = (Bc-Count '[data-testid=pay-method-cash]')
Bc-Assert ($method -eq 1) 'có lựa chọn thanh toán tiền mặt' | Out-Null
Bc-Click '[data-testid=pay-method-cash]'
Start-Sleep -Milliseconds 700
$hasCardForm = (Bc-Count '[data-testid=pay-card-number]')
Bc-Assert ($hasCardForm -eq 0) "chọn tiền mặt thì ẩn form thẻ (=$hasCardForm)" | Out-Null
Bc-Shot 'ship-02-checkout-cash' | Out-Null
Bc-Click '[data-testid=place-order-cash]'
Start-Sleep -Milliseconds 4200
Bc-WaitUrl '/my-orders' | Out-Null
$codPill = (Bc-Text '[data-testid^=payment-]').text
Bc-Assert ($codPill -match 'Cash on delivery|Trả khi nhận') "đơn COD hiển thị trả khi nhận (=$codPill)" | Out-Null
$cashOrderNo = (Bc-Eval "(() => { const el = document.querySelector('[data-testid^=myorder-]'); return el ? el.getAttribute('data-testid').replace('myorder-','') : ''; })()")
Bc-Assert ([bool]$cashOrderNo) "lấy được mã đơn COD (=$cashOrderNo)" | Out-Null
Bc-Shot 'ship-03-cod-order' | Out-Null
Write-Host "     đơn COD: $cashOrderNo" -ForegroundColor DarkGray

Write-Host "`n== 3. API: don COD phai co shippingFee=15 va chua thanh toan" -ForegroundColor Cyan
$tok = (Invoke-RestMethod -Method Post -Uri 'http://localhost:5081/api/auth/login' -ContentType 'application/json' -Body '{"username":"admin","password":"Admin@123"}').accessToken
$h = @{ Authorization = "Bearer $tok" }
$orders = (Invoke-RestMethod 'http://localhost:5081/api/orders?page=1&pageSize=50' -Headers $h).items
$cod = $orders | Where-Object { $_.orderNo -eq $cashOrderNo } | Select-Object -First 1
Bc-Assert ($null -ne $cod) "tìm thấy đơn COD qua API" | Out-Null
Bc-Assert ($cod.shippingFee -eq 15) "shippingFee đơn nhỏ = 15 (=$($cod.shippingFee))" | Out-Null
Bc-Assert ($cod.paymentMethod -eq 'cash') "paymentMethod = cash (=$($cod.paymentMethod))" | Out-Null
Bc-Assert ($cod.paymentStatus -eq 'Unpaid') "COD chưa thanh toán (=$($cod.paymentStatus))" | Out-Null
$expected = $cod.subTotal + $cod.taxAmount + 15
Bc-Assert ($cod.totalAmount -eq $expected) "tổng = subtotal + thuế + ship ($($cod.totalAmount) vs $expected)" | Out-Null

Write-Host "`n== 4. Admin xuat kho duoc don COD chua thanh toan" -ForegroundColor Cyan
Sign-In 'admin' 'Admin@123'
Bc-Goto "$base/orders" | Out-Null
Start-Sleep -Milliseconds 2200
Bc-Click "[data-testid=ship-$cashOrderNo]"
Start-Sleep -Milliseconds 3200
Bc-Shot 'ship-04-cod-shipped' | Out-Null
$afterShip = (Invoke-RestMethod "http://localhost:5081/api/orders/$($cod.id)" -Headers $h)
Bc-Assert ($afterShip.status -eq 'Shipped') "đơn COD đã xuất kho (=$($afterShip.status))" | Out-Null
Bc-Assert ($afterShip.paymentStatus -eq 'Unpaid') "vẫn chưa thu tiền sau khi giao (=$($afterShip.paymentStatus))" | Out-Null
# Hoá đơn phải tính cả phí vận chuyển (bug từng gặp: hoá đơn thiếu phí ship)
$invList = Invoke-RestMethod 'http://localhost:5081/api/invoices' -Headers $h
$invOfOrder = $invList | Where-Object { $_.orderNo -eq $cashOrderNo } | Select-Object -First 1
if ($invOfOrder) {
    $invDetail = Invoke-RestMethod "http://localhost:5081/api/invoices/$($invOfOrder.id)" -Headers $h
    $invTotal = $invDetail.subTotal + $invDetail.taxAmount + $invDetail.shippingFee
    Bc-Assert ($invDetail.shippingFee -eq 15) "hoá đơn có phí ship = 15 (=$($invDetail.shippingFee))" | Out-Null
    Bc-Assert ($invTotal -eq $afterShip.totalAmount) "tổng hoá đơn khớp tổng đơn ($invTotal vs $($afterShip.totalAmount))" | Out-Null
} else {
    Bc-Assert $false 'không tìm thấy hoá đơn của đơn COD' | Out-Null
}

Write-Host "`n== 5. Admin thu tien mat" -ForegroundColor Cyan
Bc-Goto "$base/orders/$($cod.id)" | Out-Null
Start-Sleep -Milliseconds 2200
Bc-Shot 'ship-05-order-detail-cod' | Out-Null
$collectBtn = (Bc-Count '[data-testid=collect-cash]')
Bc-Assert ($collectBtn -eq 1) "có nút thu tiền mặt (=$collectBtn)" | Out-Null
if ($collectBtn -eq 1) {
    Bc-Click '[data-testid=collect-cash]'
    Start-Sleep -Milliseconds 2800
    $afterCollect = (Invoke-RestMethod "http://localhost:5081/api/orders/$($cod.id)" -Headers $h)
    Bc-Assert ($afterCollect.paymentStatus -eq 'Paid') "thu tiền mặt xong → Paid (=$($afterCollect.paymentStatus))" | Out-Null
    Bc-Assert ($afterCollect.paymentReference -like 'CASH-*') "mã tham chiếu CASH-... (=$($afterCollect.paymentReference))" | Out-Null
    Bc-Shot 'ship-06-cash-collected' | Out-Null
}

Write-Host "`n== 6. Mien phi ship tu 500" -ForegroundColor Cyan
Bc-Click '[data-testid=logout]'
Start-Sleep -Milliseconds 1200
Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'en' } | Out-Null
Start-Sleep -Milliseconds 1200
Bc-Fill '[data-testid=login-username]' $shopper
Bc-Fill '[data-testid=login-password]' 'Shopper@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2600
Add-ToCart 'P-3001' 3
Bc-Goto "$base/cart" | Out-Null
Start-Sleep -Milliseconds 1700
$shipBig = (Bc-Text '[data-testid=cart-shipping]').text
Bc-Assert ($shipBig -match 'Free|Miễn phí|無料') "giỏ >= 500: miễn phí ship (=$shipBig)" | Out-Null
Bc-Shot 'ship-07-free-shipping' | Out-Null

Write-Host "`n== 7. Thanh toan online van hoat dong" -ForegroundColor Cyan
Bc-Click '[data-testid=cart-checkout]'
Start-Sleep -Milliseconds 1700
Bc-Fill '[data-testid=checkout-note]' '45 Le Loi, Quan 1, HCMC'
Bc-Click '[data-testid=pay-method-online]'
Start-Sleep -Milliseconds 600
Bc-Fill '[data-testid=pay-card-holder]' 'PAY TESTER'
$onlineCards = (Bc-Count '[data-testid=pay-card-number]')
Bc-Assert ($onlineCards -eq 1) "chọn online thì hiện form thẻ (=$onlineCards)" | Out-Null
Bc-Click '[data-testid=pay-submit]'
Start-Sleep -Milliseconds 4500
Bc-WaitUrl '/my-orders' | Out-Null
$onlinePill = (Bc-Text '[data-testid^=payment-]').text
Bc-Assert ($onlinePill -match 'Paid|Đã thanh toán') "đơn online thanh toán ngay (=$onlinePill)" | Out-Null
Bc-Shot 'ship-08-online-paid' | Out-Null

Write-Host "`n== 8. API: don online shipFee=0 va Paid" -ForegroundColor Cyan
$orders2 = (Invoke-RestMethod 'http://localhost:5081/api/orders?page=1&pageSize=50' -Headers $h).items
$online = $orders2 | Where-Object { $_.paymentMethod -eq 'online' -and $_.paymentStatus -eq 'Paid' } | Select-Object -First 1
if ($online) {
    Bc-Assert ($online.shippingFee -eq 0) "đơn >= 500 miễn phí ship (=$($online.shippingFee))" | Out-Null
} else {
    Bc-Assert $false 'không tìm thấy đơn online đã thanh toán' | Out-Null
}

Write-Host "`n== 9. Khong the thu tien mat cho don online (server chan)" -ForegroundColor Cyan
if ($online) {
    $blocked = $false
    try {
        Invoke-RestMethod -Method Post -Uri "http://localhost:5081/api/shop/orders/$($online.id)/collect-cash" -Headers $h | Out-Null
    } catch {
        $blocked = $true
    }
    Bc-Assert $blocked 'server từ chối thu tiền mặt cho đơn online' | Out-Null
}

Write-Host "`n== 10. Console / network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nPAYMENT & SHIPPING: ALL PASS" -ForegroundColor Green
