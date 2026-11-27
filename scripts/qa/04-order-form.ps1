# Scenario 04 — Form tạo đơn: validation, nhiều dòng, xoá dòng, cảnh báo tồn, gộp dòng trùng
# Đây là scenario "probe": in ra quan sát để phát hiện bug, chỉ assert những gì chắc chắn đúng.
#
# Chạy: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/04-order-form.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

Write-Host "`n== 0. Đăng nhập sales" -ForegroundColor Cyan
Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
Start-Sleep -Milliseconds 700
Start-Sleep -Milliseconds 700
Bc-Fill '[data-testid=login-username]' 'sales'
Bc-Fill '[data-testid=login-password]' 'Sales@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 1600
Bc-Assert ((Bc-Url) -notlike '*/login') 'đăng nhập OK' | Out-Null
Bc-Console -Clear | Out-Null

Write-Host "`n== 1. Submit khi CHƯA chọn khách hàng" -ForegroundColor Cyan
Bc-Goto "$base/orders/new" | Out-Null
Start-Sleep -Milliseconds 1200
Bc-Click '[data-testid=save-order]'
Start-Sleep -Milliseconds 900
$err = ''
if ((Bc-Count '.alert-danger') -ge 1) { $err = (Bc-Text '.alert-danger').text }
Write-Host "     alert: '$err' | url=$(Bc-Url)" -ForegroundColor DarkGray
Bc-Assert ($err -match 'khách hàng') 'chặn submit thiếu khách hàng + message rõ' | Out-Null
Bc-Assert ((Bc-Url) -like '*/orders/new') 'vẫn ở trang tạo đơn' | Out-Null

Write-Host "`n== 2. Chọn khách + 1 dòng hàng, kiểm tra tổng tiền client" -ForegroundColor Cyan
Bc-Select '[data-testid=order-customer]' -Index 2
Bc-Select '[data-testid=line-product-1]' -Index 1
Bc-Select '[data-testid=line-warehouse-1]' -Index 1
Bc-Fill '[data-testid=line-quantity-1]' '2'
Start-Sleep -Milliseconds 400
$total1 = (Bc-Text '.totals-grand strong').text
Write-Host "     1 dòng x2 → tổng: $total1" -ForegroundColor DarkGray

Write-Host "`n== 3. Thêm dòng 2 (hàng khác) → tổng phải cộng dồn" -ForegroundColor Cyan
Bc-Click '[data-testid=add-line]'
Start-Sleep -Milliseconds 400
Bc-Select '[data-testid=line-product-2]' -Index 2
Bc-Select '[data-testid=line-warehouse-2]' -Index 1
Bc-Fill '[data-testid=line-quantity-2]' '1'
Start-Sleep -Milliseconds 400
$total2 = (Bc-Text '.totals-grand strong').text
Write-Host "     2 dòng → tổng: $total2" -ForegroundColor DarkGray
Bc-Assert ($total1 -ne $total2) 'thêm dòng làm tổng tiền thay đổi' | Out-Null

Write-Host "`n== 4. Xoá dòng 2 → tổng phải quay lại như cũ" -ForegroundColor Cyan
Bc-Click '[data-testid=remove-line-2]'
Start-Sleep -Milliseconds 400
$total3 = (Bc-Text '.totals-grand strong').text
Write-Host "     sau khi xoá → tổng: $total3" -ForegroundColor DarkGray
Bc-Assert ($total3 -eq $total1) "xoá dòng → tổng trở lại $total1 (nhận $total3)" | Out-Null

Write-Host "`n== 5. Số lượng vượt tồn → phải hiện cảnh báo tại dòng" -ForegroundColor Cyan
Bc-Fill '[data-testid=line-quantity-1]' '99999'
Start-Sleep -Milliseconds 500
$warn = ''
if ((Bc-Count 'text=/vượt tồn/') -ge 1) { $warn = 'có' }
$lineHint = (Bc-Text 'tbody tr:first-child td:first-child').text
Write-Host "     hint dòng 1: $lineHint" -ForegroundColor DarkGray
Bc-Assert ($warn -eq 'có') 'có cảnh báo "vượt tồn" khi số lượng lớn hơn khả dụng' | Out-Null

Write-Host "`n== 6. Quay lại số lượng hợp lệ, thêm dòng trùng (cùng hàng + cùng kho)" -ForegroundColor Cyan
Bc-Fill '[data-testid=line-quantity-1]' '1'
Bc-Click '[data-testid=add-line]'
Start-Sleep -Milliseconds 400
Bc-Select '[data-testid=line-product-2]' -Index 1
Bc-Select '[data-testid=line-warehouse-2]' -Index 1
Bc-Fill '[data-testid=line-quantity-2]' '2'
Start-Sleep -Milliseconds 400
$mergedTotal = (Bc-Text '.totals-grand strong').text
Write-Host "     tổng khi có 2 dòng trùng hàng: $mergedTotal" -ForegroundColor DarkGray

Bc-Fill '[data-testid=order-note]' 'Đơn kiểm thử tự động — ghi chú dài để kiểm tra hiển thị: PO-2026-11-25-ABCDEFGHIJKLMNOPQRSTUVWXYZ'
Bc-Click '[data-testid=save-order]'
Start-Sleep -Milliseconds 2000
Bc-Assert ((Bc-Url) -like '*/orders') "lưu thành công, về danh sách (url=$(Bc-Url))" | Out-Null

Write-Host "`n== 7. Đơn vừa tạo: server gộp 2 dòng trùng → còn 1 dòng?" -ForegroundColor Cyan
Bc-Click 'role=button[name="Xem chi tiết"]' -Within 'tbody tr:first-child'
Start-Sleep -Milliseconds 900
$modal = (Bc-Text '.app-modal-body').text
$lineRows = Bc-Count 'tbody tr' -Within '.app-modal-body'
Write-Host "     số dòng hàng trong modal: $lineRows" -ForegroundColor DarkGray
Write-Host "     tổng trong modal: $((Bc-Text '.totals-grand strong' -Within '.app-modal-body').text)" -ForegroundColor DarkGray
Bc-Assert ($modal -match 'Đơn kiểm thử tự động') 'ghi chú dài được lưu và hiển thị' | Out-Null
Bc-Shot 'qa-10-order-merged-lines' | Out-Null
Bc-Press 'Escape'
Start-Sleep -Milliseconds 400

Write-Host "`n== 8. Click backdrop (góc ngoài dialog) để đóng modal" -ForegroundColor Cyan
Bc-Click 'role=button[name="Xem chi tiết"]' -Within 'tbody tr:first-child'
Start-Sleep -Milliseconds 800
Bc-Assert ((Bc-Count '.app-modal') -eq 1) 'modal mở' | Out-Null
# Click giữa backdrop sẽ trúng dialog (dialog canh giữa) → phải click ở góc.
Bc-Click '.app-modal-backdrop' -X 8 -Y 8
Start-Sleep -Milliseconds 600
Bc-Assert ((Bc-Count '.app-modal') -eq 0) 'click ngoài dialog đóng được modal' | Out-Null

Write-Host "`n== 9. Log/network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
$badHttp = @($console.networkErrors | Where-Object { $_.status -ne 409 -and $_.status -ne 400 })
Bc-Assert ($pageErrors.Count -eq 0) "không có JS exception (count=$($pageErrors.Count))" | Out-Null
Bc-Assert ($badHttp.Count -eq 0) "không có HTTP lỗi ngoài 400/409 (count=$($badHttp.Count))" | Out-Null
if ($badHttp.Count -gt 0) { $badHttp | ForEach-Object { Write-Host "     $($_.status) $($_.url)" -ForegroundColor DarkGray } }
$clientErrors = @($console.console | Where-Object { $_.type -eq 'error' -and $_.text -notmatch 'Failed to load resource' })
Bc-Assert ($clientErrors.Count -eq 0) "không có console error lạ (count=$($clientErrors.Count))" | Out-Null
if ($clientErrors.Count -gt 0) { $clientErrors | ForEach-Object { Write-Host "     $($_.text)" -ForegroundColor DarkGray } }

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) kiểm tra THẤT BẠI" -ForegroundColor Red
    exit 1
}

Write-Host "`nORDER FORM: TẤT CẢ PASS" -ForegroundColor Green
