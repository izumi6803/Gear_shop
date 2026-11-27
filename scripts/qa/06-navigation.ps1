# Scenario 06 — Điều hướng & độ bền: deep link, route lạ, back/forward, double-click, mất mạng API
# Chạy: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/06-navigation.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

Write-Host "`n== 0. Đăng nhập" -ForegroundColor Cyan
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

Write-Host "`n== 1. Deep link: mở thẳng /orders (reload trình duyệt)" -ForegroundColor Cyan
Bc-Goto "$base/orders" | Out-Null
Start-Sleep -Milliseconds 1500
Bc-Assert ((Bc-Url) -like '*/orders') "SPA fallback phục vụ /orders (url=$(Bc-Url))" | Out-Null
Bc-Assert ((Bc-Count '.app-table, .app-empty') -ge 1) 'trang đơn hàng render sau khi reload' | Out-Null

Write-Host "`n== 2. Deep link /products" -ForegroundColor Cyan
Bc-Goto "$base/products" | Out-Null
Start-Sleep -Milliseconds 1500
Bc-Assert ((Bc-Count '.panel') -ge 2) 'trang hàng hoá render 2 panel' | Out-Null

Write-Host "`n== 3. Route không tồn tại → về trang chủ" -ForegroundColor Cyan
Bc-Goto "$base/khong-ton-tai" | Out-Null
Start-Sleep -Milliseconds 1500
$urlAfter = Bc-Url
Write-Host "     url: $urlAfter" -ForegroundColor DarkGray
Bc-Assert ($urlAfter -match '/($|\?|#)|%2F$|4173/$|4173$') "route lạ được đưa về / (url=$urlAfter)" | Out-Null

Write-Host "`n== 4. Back / forward của trình duyệt" -ForegroundColor Cyan
Bc-Goto "$base/orders" | Out-Null
Start-Sleep -Milliseconds 1000
Bc-Goto "$base/products" | Out-Null
Start-Sleep -Milliseconds 1200
$backUrl = Bc-Back
Start-Sleep -Milliseconds 1200
$backUrl = Bc-Url
Write-Host "     sau Back: $backUrl" -ForegroundColor DarkGray
Bc-Assert ($backUrl -like '*/orders') "Back đưa về /orders (url=$backUrl)" | Out-Null
Bc-Forward | Out-Null
Start-Sleep -Milliseconds 1200
$fwdUrl = Bc-Url
Write-Host "     sau Forward: $fwdUrl" -ForegroundColor DarkGray
Bc-Assert ($fwdUrl -like '*/products') "Forward đưa lại /products (url=$fwdUrl)" | Out-Null

Write-Host "`n== 5. Double-click 'Xác nhận': chỉ 1 request thực thi" -ForegroundColor Cyan
# Tạo sẵn 1 đơn Draft qua API (trong context trang để dùng token), rồi test double-click.
$created = Bc-Eval "fetch('/ordering-api/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('stockflow.token') }, body: JSON.stringify({ customerId: 1, orderDate: new Date().toISOString().slice(0, 10), lines: [{ productId: 1, warehouseId: 1, quantity: 1 }] }) }).then(r => r.json()).then(d => String(d.id))"
Write-Host "     tạo draft id=$created" -ForegroundColor DarkGray
Bc-Goto "$base/orders" | Out-Null
Start-Sleep -Milliseconds 1500

$draftRow = ''
$rowCount = Bc-Count 'tbody tr'
for ($i = 1; $i -le $rowCount; $i++) {
    $status = (Bc-Text "tbody tr:nth-child($i) .status-pill").text
    if ($status -eq 'Draft') { $draftRow = "tbody tr:nth-child($i)"; break }
}

if ($draftRow -eq '') {
    Write-Host "     [FAIL] không tìm thấy đơn Draft để test double-click" -ForegroundColor Red
    $script:BcFailures++
}
else {
    Write-Host "     dùng dòng: $draftRow" -ForegroundColor DarkGray
    Bc-Eval "window.__origFetch = window.fetch; window.__confirmCalls = 0; window.fetch = function (u, o) { if (String(u).indexOf('/confirm') >= 0) { window.__confirmCalls += 1; } return window.__origFetch.call(this, u, o); };" | Out-Null
    Bc-Cmd 'click' @{ target = 'role=button[name="Xác nhận"]'; within = $draftRow } | Out-Null
    $secondClickBlocked = $false
    try {
        Bc-Cmd 'click' @{ target = 'role=button[name="Xác nhận"]'; within = $draftRow; timeout = 2500 } | Out-Null
    }
    catch {
        $secondClickBlocked = $true
    }
    Start-Sleep -Milliseconds 2500
    $calls = Bc-Eval 'window.__confirmCalls'
    Write-Host "     số request /confirm: $calls | click thứ 2 bị chặn: $secondClickBlocked" -ForegroundColor DarkGray
    Bc-Assert ([int]$calls -le 1) "double-click không tạo request trùng (calls=$calls)" | Out-Null
    Bc-Eval 'window.fetch = window.__origFetch;' | Out-Null
}

Write-Host "`n== 6. Log/network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
$badHttp = @($console.networkErrors | Where-Object { $_.status -ne 409 })
Bc-Assert ($pageErrors.Count -eq 0) "không có JS exception (count=$($pageErrors.Count))" | Out-Null
Bc-Assert ($badHttp.Count -eq 0) "không có HTTP lỗi ngoài 409 (count=$($badHttp.Count))" | Out-Null
if ($badHttp.Count -gt 0) { $badHttp | ForEach-Object { Write-Host "     $($_.status) $($_.url)" -ForegroundColor DarkGray } }
if ($pageErrors.Count -gt 0) { $pageErrors | ForEach-Object { Write-Host "     $($_.text)" -ForegroundColor DarkGray } }

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) kiểm tra THẤT BẠI" -ForegroundColor Red
    exit 1
}

Write-Host "`nNAVIGATION: TẤT CẢ PASS" -ForegroundColor Green
