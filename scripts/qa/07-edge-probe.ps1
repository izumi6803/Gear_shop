# Scenario 07 — Probe edge case form tạo đơn (dữ liệu thiếu/sai) để tìm bug
# Chạy: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/07-edge-probe.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

function Reset-Form {
    Bc-Goto "$base/orders/new" | Out-Null
    Start-Sleep -Milliseconds 1200
    Bc-Console -Clear | Out-Null
}

function Show-Alert {
    param([string]$Label)
    $count = Bc-Count '.alert-danger'
    if ($count -ge 1) {
        $text = (Bc-Text '.alert-danger').text
        Write-Host "     $Label → alert: '$text'" -ForegroundColor DarkGray
        return $text
    }
    Write-Host "     $Label → KHÔNG có alert" -ForegroundColor DarkGray
    return ''
}

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

Write-Host "`n== A. Xoá ngày đặt rồi lưu (client có chặn? server báo gì?)" -ForegroundColor Cyan
Reset-Form
Bc-Select '[data-testid=order-customer]' -Index 1
Bc-Select '[data-testid=line-product-1]' -Index 1
Bc-Select '[data-testid=line-warehouse-1]' -Index 1
Bc-Fill '[data-testid=line-quantity-1]' '1'
Bc-Fill '[data-testid=order-date]' ''
Start-Sleep -Milliseconds 300
$dateValue = Bc-Eval "document.querySelector('#orderDate') ? document.querySelector('#orderDate').value : 'NO_INPUT'"
Write-Host "     giá trị ô ngày sau khi xoá: '$dateValue'" -ForegroundColor DarkGray
Bc-Click '[data-testid=save-order]'
Start-Sleep -Milliseconds 1800
$alertA = Show-Alert 'lưu với ngày rỗng'
Write-Host "     url: $(Bc-Url)" -ForegroundColor DarkGray
$netA = Bc-Console -Clear
if ($netA.networkErrors.Count -gt 0) {
    $netA.networkErrors | ForEach-Object { Write-Host "     HTTP $($_.status) $($_.url)" -ForegroundColor DarkGray }
}
Bc-Assert ($alertA -ne '' -or (Bc-Url) -notlike '*/orders/new') 'có phản hồi rõ ràng khi ngày rỗng (không im lặng)' | Out-Null

Write-Host "`n== B. Không chọn hàng hoá nhưng có số lượng" -ForegroundColor Cyan
Reset-Form
Bc-Select '[data-testid=order-customer]' -Index 1
Bc-Select '[data-testid=line-product-1]' -Index 0
Bc-Fill '[data-testid=line-quantity-1]' '5'
Bc-Click '[data-testid=save-order]'
Start-Sleep -Milliseconds 1200
$alertB = Show-Alert 'thiếu hàng hoá'
Bc-Assert ($alertB -ne '') 'báo lỗi khi chưa chọn hàng hoá' | Out-Null

Write-Host "`n== C. Số lượng = 0" -ForegroundColor Cyan
Reset-Form
Bc-Select '[data-testid=order-customer]' -Index 1
Bc-Select '[data-testid=line-product-1]' -Index 1
Bc-Select '[data-testid=line-warehouse-1]' -Index 1
Bc-Fill '[data-testid=line-quantity-1]' '0'
Bc-Click '[data-testid=save-order]'
Start-Sleep -Milliseconds 1200
$alertC = Show-Alert 'số lượng 0'
Bc-Assert ($alertC -ne '') 'báo lỗi khi số lượng = 0 (không tạo đơn rỗng)' | Out-Null

Write-Host "`n== D. Số lượng âm (nhập tay -5)" -ForegroundColor Cyan
Reset-Form
Bc-Select '[data-testid=order-customer]' -Index 1
Bc-Select '[data-testid=line-product-1]' -Index 1
Bc-Select '[data-testid=line-warehouse-1]' -Index 1
Bc-Fill '[data-testid=line-quantity-1]' '-5'
Start-Sleep -Milliseconds 300
$qtyValue = Bc-Eval "document.querySelectorAll('input[type=number]')[0].value"
Write-Host "     ô số lượng giữ giá trị: '$qtyValue'" -ForegroundColor DarkGray
Bc-Click '[data-testid=save-order]'
Start-Sleep -Milliseconds 1200
$alertD = Show-Alert 'số lượng âm'
Bc-Assert ($alertD -ne '') 'báo lỗi khi số lượng âm' | Out-Null

Write-Host "`n== E. Trang hàng hoá: tìm hàng có lọc luôn bảng tồn kho?" -ForegroundColor Cyan
Bc-Goto "$base/products" | Out-Null
Start-Sleep -Milliseconds 1500
$stocksAll = Bc-Count 'tbody tr' -Within '.panel:last-child'
Bc-Fill '[data-testid=product-search]' 'P-1001'
Start-Sleep -Milliseconds 800
$stocksFiltered = Bc-Count 'tbody tr' -Within '.panel:last-child'
Write-Host "     bảng tồn kho: trước=$stocksAll sau khi tìm P-1001=$stocksFiltered" -ForegroundColor DarkGray
$stockTexts = (Bc-Text 'tbody tr' -All -Within '.panel:last-child').texts
$hasOtherProduct = @($stockTexts | Where-Object { $_ -notmatch 'P-1001' -and $_ -ne '' }).Count
Write-Host "     số dòng tồn kho KHÔNG phải P-1001: $hasOtherProduct" -ForegroundColor DarkGray
Bc-Assert ($stocksFiltered -lt $stocksAll) 'bảng tồn kho cũng được lọc theo từ khoá' | Out-Null

Write-Host "`n== F. Modal chi tiết: tên hàng tiếng Nhật (snapshot) hiển thị đúng" -ForegroundColor Cyan
Bc-Goto "$base/orders" | Out-Null
Start-Sleep -Milliseconds 1500
$rows = Bc-Count 'tbody tr'
if ($rows -ge 1) {
    Bc-Click 'role=button[name="Xem chi tiết"]' -Within 'tbody tr:first-child'
    Start-Sleep -Milliseconds 900
    $modal = (Bc-Text '.app-modal-body').text
    $hasJapanese = $modal -match '[\u3040-\u30ff]' -or $modal -match '[\u4e00-\u9faf]'
    Write-Host "     modal có chữ Nhật: $hasJapanese" -ForegroundColor DarkGray
    Bc-Assert ($modal -match '\$') 'modal hiển thị tiền tệ' | Out-Null
    Bc-Press 'Escape'
}

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) kiểm tra THẤT BẠI" -ForegroundColor Red
    exit 1
}

Write-Host "`nEDGE PROBE: TẤT CẢ PASS" -ForegroundColor Green
