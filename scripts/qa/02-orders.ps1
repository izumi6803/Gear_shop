# Scenario 02 — Vòng đời đơn hàng qua UI: tạo → confirm → ship, và nhánh thiếu tồn (409)
# Chạy: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/02-orders.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

function Login-AsSales {
    Bc-Fill '[data-testid=login-username]' 'sales'
    Bc-Fill '[data-testid=login-password]' 'Sales@123'
    Bc-Click '[data-testid=login-submit]'
    Start-Sleep -Milliseconds 1500
}

function New-Order {
    param([int]$Quantity)

    Bc-Goto "$base/orders/new" | Out-Null
    Start-Sleep -Milliseconds 1200
    Bc-Select '[data-testid=order-customer]' -Index 1
    Bc-Select '[data-testid=line-product-1]' -Index 1
    Bc-Select '[data-testid=line-warehouse-1]' -Index 1
    Bc-Fill '[data-testid=line-quantity-1]' "$Quantity"
    Start-Sleep -Milliseconds 300
    $total = (Bc-Text '.totals-grand strong').text
    Bc-Click '[data-testid=save-order]'
    Start-Sleep -Milliseconds 1800
    return $total
}

Write-Host "`n== 1. Đăng nhập sales" -ForegroundColor Cyan
Bc-Open "$base/login" | Out-Null
Bc-Eval "localStorage.setItem('stockflow.lang','vi')" | Out-Null
Bc-Goto "$base/login" | Out-Null
Start-Sleep -Milliseconds 700
Start-Sleep -Milliseconds 600
Login-AsSales
Bc-Assert ((Bc-Url) -notlike '*/login') 'đã đăng nhập' | Out-Null
Bc-Console -Clear | Out-Null

Write-Host "`n== 2. Tạo đơn số lượng vượt tồn (999999)" -ForegroundColor Cyan
$hugeTotal = New-Order -Quantity 999999
Bc-Assert ((Bc-Url) -like '*/orders') "quay về danh sách đơn (url=$(Bc-Url))" | Out-Null
$firstRowStatus = (Bc-Text 'tbody tr:first-child .status-pill').text
Bc-Assert ($firstRowStatus -eq 'Draft') "đơn mới ở trạng thái Draft (=$firstRowStatus)" | Out-Null
Write-Host "     tổng tiền client hiển thị: $hugeTotal" -ForegroundColor DarkGray
$orderNo = (Bc-Text 'tbody tr:first-child td:first-child').text
Write-Host "     đơn: $orderNo" -ForegroundColor DarkGray

Write-Host "`n== 3. Xác nhận đơn vượt tồn → phải bị chặn với message rõ ràng" -ForegroundColor Cyan
Bc-Click 'role=button[name="Xác nhận"]' -Within 'tbody tr:first-child'
Start-Sleep -Milliseconds 2200
$toastText = ''
if ((Bc-Count '.app-toast-error') -ge 1) {
    $toastText = (Bc-Text '.app-toast-error').text
}
Bc-Assert ($toastText -match 'Không đủ tồn kho') "toast báo thiếu tồn (=$toastText)" | Out-Null
$statusAfterFail = (Bc-Text 'tbody tr:first-child .status-pill').text
Bc-Assert ($statusAfterFail -eq 'Draft') "đơn vẫn Draft sau khi bị chặn (=$statusAfterFail)" | Out-Null
Bc-Shot 'qa-04-insufficient-stock' | Out-Null

Write-Host "`n== 4. Huỷ đơn vượt tồn (dọn dữ liệu)" -ForegroundColor Cyan
Bc-Eval 'window.confirm = () => true' | Out-Null
Bc-Click 'role=button[name="Huỷ"]' -Within 'tbody tr:first-child'
Start-Sleep -Milliseconds 2000
$statusAfterCancel = (Bc-Text 'tbody tr:first-child .status-pill').text
Bc-Assert ($statusAfterCancel -eq 'Cancelled') "đơn đã huỷ (=$statusAfterCancel)" | Out-Null

Write-Host "`n== 5. Tạo đơn hợp lệ (số lượng 2)" -ForegroundColor Cyan
$validTotal = New-Order -Quantity 2
Bc-Assert ($validTotal -match '\$') "client hiển thị tổng tiền (=$validTotal)" | Out-Null
$validStatus = (Bc-Text 'tbody tr:first-child .status-pill').text
Bc-Assert ($validStatus -eq 'Draft') "đơn hợp lệ ở Draft (=$validStatus)" | Out-Null
$validOrderNo = (Bc-Text 'tbody tr:first-child td:first-child').text
Write-Host "     đơn: $validOrderNo — tổng: $validTotal" -ForegroundColor DarkGray

Write-Host "`n== 6. Confirm đơn hợp lệ → Confirmed (đã giữ tồn)" -ForegroundColor Cyan
Bc-Click 'role=button[name="Xác nhận"]' -Within 'tbody tr:first-child'
Start-Sleep -Milliseconds 2500
$confirmedStatus = (Bc-Text 'tbody tr:first-child .status-pill').text
Bc-Assert ($confirmedStatus -eq 'Confirmed') "trạng thái Confirmed (=$confirmedStatus)" | Out-Null

Write-Host "`n== 7. Ship đơn → Shipped + sinh hoá đơn" -ForegroundColor Cyan
Bc-Click 'role=button[name="Xuất kho"]' -Within 'tbody tr:first-child'
Start-Sleep -Milliseconds 2500
$shippedStatus = (Bc-Text 'tbody tr:first-child .status-pill').text
Bc-Assert ($shippedStatus -eq 'Shipped') "trạng thái Shipped (=$shippedStatus)" | Out-Null
$shipToast = ''
if ((Bc-Count '.app-toast') -ge 1) {
    $toasts = (Bc-Text '.app-toast' -All).texts
    $shipToast = ($toasts | Where-Object { $_ -match 'hoá đơn' } | Select-Object -First 1)
}
Bc-Assert ($shipToast -match 'INV-') "toast có số hoá đơn (=$shipToast)" | Out-Null
Bc-Shot 'qa-05-order-shipped' | Out-Null

Write-Host "`n== 8. Chi tiết đơn: dòng hàng + tổng tiền khớp" -ForegroundColor Cyan
Bc-Click 'role=button[name="Xem chi tiết"]' -Within 'tbody tr:first-child'
Start-Sleep -Milliseconds 900
Bc-Assert ((Bc-Count '.app-modal') -eq 1) 'mở được modal chi tiết' | Out-Null
$modalText = (Bc-Text '.app-modal-body').text
Bc-Assert ($modalText -match 'Tổng cộng') 'modal có tổng cộng' | Out-Null
Bc-Assert ($modalText -match 'P-1001') 'modal có mã hàng snapshot' | Out-Null
Bc-Shot 'qa-06-order-detail' | Out-Null
Bc-Press 'Escape'
Start-Sleep -Milliseconds 500
Bc-Assert ((Bc-Count '.app-modal') -eq 0) 'Escape đóng được modal' | Out-Null

Write-Host "`n== 9. Kiểm tra log/network (chỉ chấp nhận 409 chủ động)" -ForegroundColor Cyan
$console = Bc-Console -Clear
$unexpectedConsole = @($console.console | Where-Object { $_.type -eq 'pageerror' })
Bc-Assert ($unexpectedConsole.Count -eq 0) "không có JS exception (count=$($unexpectedConsole.Count))" | Out-Null
$unexpectedHttp = @($console.networkErrors | Where-Object { $_.status -ne 409 })
Bc-Assert ($unexpectedHttp.Count -eq 0) "không có HTTP lỗi ngoài 409 (count=$($unexpectedHttp.Count))" | Out-Null
if ($unexpectedHttp.Count -gt 0) {
    $unexpectedHttp | ForEach-Object { Write-Host "     $($_.status) $($_.url)" -ForegroundColor DarkGray }
}
$badLogins = @($console.networkErrors | Where-Object { $_.status -eq 401 })
Write-Host "     (401 không mong đợi: $($badLogins.Count))" -ForegroundColor DarkGray

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) kiểm tra THẤT BẠI" -ForegroundColor Red
    exit 1
}

Write-Host "`nORDER LIFECYCLE: TẤT CẢ PASS" -ForegroundColor Green
