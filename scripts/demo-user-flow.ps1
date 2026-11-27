# demo-user-flow.ps1 — Chạy trọn luồng người dùng và chụp ảnh từng bước.
# Dùng: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo-user-flow.ps1
# Yêu cầu: SPA :4173, Catalog :5080, Ordering :5081, browser driver :4599 đang chạy.

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot 'bc-lib.ps1')

$base = 'http://localhost:4173'
$outDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\demo'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$script:BcFailures = 0
$stamp = Get-Date -Format 'HHmmss'
$shopper = "demo$stamp"
$shot = 0

function Step([string]$title) {
    $script:shot++
    Write-Host ("`n[{0:D2}] {1}" -f $script:shot, $title) -ForegroundColor Cyan
}

function Capture([string]$name) {
    # Driver chỉ nhận tên file (tự lưu vào docs/img) → chụp rồi chuyển sang docs/demo.
    $plain = ("demo-{0:D2}-{1}" -f $script:shot, $name)
    $src = (Bc-Shot $plain | Select-Object -Last 1)
    $src = "$src".Trim()
    $dest = Join-Path $outDir ("{0:D2}-{1}.png" -f $script:shot, $name)
    if ($src -and (Test-Path -LiteralPath $src)) {
        Move-Item -LiteralPath $src -Destination $dest -Force
    } else {
        $fallback = Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\img') "$plain.png"
        if (Test-Path -LiteralPath $fallback) { Move-Item -LiteralPath $fallback -Destination $dest -Force }
    }
}

Write-Host "=== DEMO LUONG NGUOI DUNG — StockFlow Marketplace ===" -ForegroundColor Magenta

# ---------- Phần 1: khách mua hàng ----------
Step 'Khách chưa đăng nhập mở cửa hàng'
Bc-Open "$base/shop" -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
Start-Sleep -Milliseconds 2200
$loaded = Bc-Eval "Array.from(document.querySelectorAll('.shop-card img')).filter(i => i.complete && i.naturalWidth > 0).length"
Bc-Assert ($loaded -ge 6) "8 ảnh sản phẩm hiển thị (=$loaded)" | Out-Null
Capture 'cua-hang-cong-khai' | Out-Null

Step 'Tìm kiếm sản phẩm'
Bc-Fill '[data-testid=shop-search]' 'monitor'
Start-Sleep -Milliseconds 900
$cards = Bc-Count '.shop-card'
Bc-Assert ($cards -eq 1) "lọc còn 1 sản phẩm khớp 'monitor' (=$cards)" | Out-Null
Capture 'tim-kiem' | Out-Null

Step 'Xem chi tiết và chọn số lượng'
Bc-Goto "$base/shop/6" | Out-Null
Start-Sleep -Milliseconds 1800
Bc-Fill '[data-testid=product-qty]' '2'
Capture 'chi-tiet-san-pham' | Out-Null
Bc-Click '[data-testid=product-add]'
Start-Sleep -Milliseconds 1600

Step 'Thêm sản phẩm thứ hai từ cửa hàng'
Bc-Goto "$base/shop" | Out-Null
Start-Sleep -Milliseconds 1800
Bc-Click '[data-testid=add-P-1003]'
Start-Sleep -Milliseconds 1200
Capture 'them-vao-gio' | Out-Null

Step 'Khách tạo tài khoản mua hàng'
Bc-Goto "$base/register" | Out-Null
Start-Sleep -Milliseconds 1600
Bc-Fill '[data-testid=register-email]' "$shopper@shop.local"
Bc-Fill '[data-testid=register-password]' 'Shopper@123'
Bc-Fill '[data-testid=register-confirm]' 'Shopper@123'
Capture 'dang-ky-buoc-1' | Out-Null
Bc-Click '[data-testid=register-next]'
Start-Sleep -Milliseconds 900
Bc-Fill '[data-testid=register-display-name]' 'Nguyen Van Demo'
Capture 'dang-ky-tai-khoan' | Out-Null
Bc-Click '[data-testid=register-submit]'
Start-Sleep -Milliseconds 3200
$roleNow = (Bc-Text '.app-user-meta small').text.Trim()
Bc-Assert ($roleNow -eq 'Customer') "đăng ký xong tự đăng nhập với role Customer (=$roleNow)" | Out-Null

Step 'Giỏ hàng: sửa số lượng, xem tổng tiền + thuế'
Bc-Click '[data-testid=go-cart]'
Start-Sleep -Milliseconds 1800
$beforeTotal = (Bc-Text '[data-testid=cart-total]').text
Bc-Fill '[data-testid=cart-qty-P-1003]' '2'
Start-Sleep -Milliseconds 700
$afterTotal = (Bc-Text '[data-testid=cart-total]').text
Bc-Assert ($beforeTotal -ne $afterTotal) "tổng tiền cập nhật khi đổi số lượng ($beforeTotal → $afterTotal)" | Out-Null
Capture 'gio-hang' | Out-Null

Step 'Thanh toán: địa chỉ + thẻ (sandbox)'
Bc-Click '[data-testid=cart-checkout]'
Start-Sleep -Milliseconds 1800
Bc-Fill '[data-testid=checkout-note]' '12 Nguyen Hue, Quan 1, TP.HCM — giao gio hanh chinh'
Bc-Fill '[data-testid=pay-card-holder]' 'DEMO SHOPPER'
Capture 'thanh-toan' | Out-Null
Bc-Click '[data-testid=pay-submit]'
Start-Sleep -Milliseconds 4500

Step 'Đơn của tôi: đã thanh toán'
Bc-WaitUrl '/my-orders' | Out-Null
$paid = (Bc-Text '[data-testid^="payment-"]' -All).texts -join ' '
Bc-Assert ($paid -match 'Đã thanh toán|Paid') "đơn hiển thị đã thanh toán (=$paid)" | Out-Null
  $orderNo = (Bc-Eval "(() => { const el = document.querySelector('[data-testid^=myorder-]'); return el ? el.getAttribute('data-testid').replace('myorder-','') : ''; })()")
Bc-Assert ([bool]$orderNo) "lấy được mã đơn (=$orderNo)" | Out-Null
Capture 'don-cua-toi' | Out-Null
Write-Host "     Mã đơn: $orderNo" -ForegroundColor DarkGray

# ---------- Phần 2: back office xử lý đơn ----------
Step 'Admin đăng nhập, xem đơn khách vừa đặt'
Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
Start-Sleep -Milliseconds 1300
Bc-Fill '[data-testid=login-username]' 'admin'
Bc-Fill '[data-testid=login-password]' 'Admin@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2600
Bc-Goto "$base/orders"
Start-Sleep -Milliseconds 2200
Bc-Assert ((Bc-Count '[data-testid^="ship-"]') -ge 1) 'đơn đã thanh toán đang chờ xuất kho' | Out-Null
Capture 'admin-danh-sach-don' | Out-Null

Step "Admin xuất kho đơn $orderNo (sinh hoá đơn)"
Bc-Click "[data-testid=ship-$orderNo]"
Start-Sleep -Milliseconds 3200
Capture 'admin-xuat-kho' | Out-Null

Step 'Hoá đơn được sinh tự động'
Bc-Goto "$base/invoices"
Start-Sleep -Milliseconds 2200
$invoiceRows = Bc-Count '[data-testid^="print-"]'
Bc-Assert ($invoiceRows -ge 1) "có hoá đơn vừa sinh (=$invoiceRows)" | Out-Null
Capture 'danh-sach-hoa-don' | Out-Null

Step 'In hoá đơn (bản PDF)'
$invoiceNo = (Bc-Eval "(() => { const el = document.querySelector('[data-testid^=""print-""]'); return el ? el.getAttribute('data-testid').replace('print-','') : ''; })()")
if ($invoiceNo) {
    Bc-Click "[data-testid=print-$invoiceNo]"
    Start-Sleep -Milliseconds 2400
    Capture 'hoa-don-in' | Out-Null
    try {
        $pdfDest = Join-Path $outDir "hoa-don-$invoiceNo.pdf"
        $pdfSrc = (Bc-Pdf "demo-invoice-$invoiceNo" | Select-Object -Last 1)
        $pdfSrc = "$pdfSrc".Trim()
        if ($pdfSrc -and (Test-Path -LiteralPath $pdfSrc)) { Move-Item -LiteralPath $pdfSrc -Destination $pdfDest -Force; Write-Host "     PDF: $pdfDest" -ForegroundColor DarkGray }
    } catch {
        Write-Host "     (bỏ qua PDF: $($_.Exception.Message))" -ForegroundColor DarkYellow
    }
}

Step 'Admin xem số liệu sau giao dịch'
Bc-Goto "$base/admin/status"
Start-Sleep -Milliseconds 2200
Capture 'admin-trang-thai' | Out-Null

# ---------- Phần 3: các vai trò khác ----------
Step 'Sales: cập nhật giá và tồn kho'
Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
Start-Sleep -Milliseconds 1300
Bc-Fill '[data-testid=login-username]' 'sales'
Bc-Fill '[data-testid=login-password]' 'Sales@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2600
Bc-Goto "$base/staff/products"
Start-Sleep -Milliseconds 2400
Capture 'sales-quan-ly-san-pham' | Out-Null

Step 'Viewer: chỉ đọc, không thấy khu quản trị'
Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
Start-Sleep -Milliseconds 1300
Bc-Fill '[data-testid=login-username]' 'viewer'
Bc-Fill '[data-testid=login-password]' 'Viewer@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2600
$nav = (Bc-Text '.app-nav' -All).texts -join '|'
Bc-Assert ($nav -notmatch 'Tài khoản' -and $nav -notmatch 'Quản lý sản phẩm') 'viewer không có menu quản trị' | Out-Null
Capture 'viewer-chi-doc' | Out-Null

Step 'Kiểm tra lỗi console'
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
Bc-Assert ($pageErrors.Count -eq 0) "không có JS exception (=$($pageErrors.Count))" | Out-Null

Write-Host ''
if ($script:BcFailures -gt 0) {
    Write-Host "$($script:BcFailures) buoc FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "=== DEMO HOAN TAT ===" -ForegroundColor Green
Write-Host "Ảnh: $outDir" -ForegroundColor DarkGray
Write-Host "Đơn demo: $orderNo | Hoá đơn: $invoiceNo | Tài khoản khách: $shopper" -ForegroundColor DarkGray
