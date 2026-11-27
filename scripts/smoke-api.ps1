# Smoke test API end-to-end: login -> tạo đơn -> confirm (giữ tồn) -> ship (xuất kho + hoá đơn)
# Dùng: pwsh scripts/smoke-api.ps1 -CatalogBase http://localhost:5080 -OrderingBase http://localhost:5081

param(
    [string]$CatalogBase = 'http://localhost:5080',
    [string]$OrderingBase = 'http://localhost:5081',
    [string]$Username = 'sales',
    [string]$Password = 'Sales@123'
)

$ErrorActionPreference = 'Stop'

function Step([string]$name) { Write-Host "`n== $name" -ForegroundColor Cyan }
function Ok([string]$msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Fail([string]$msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; exit 1 }

Step '1. Health check'
$catalogHealth = Invoke-RestMethod "$CatalogBase/health"
$orderingHealth = Invoke-RestMethod "$OrderingBase/health"
Ok "catalog-api: $($catalogHealth.status) — $($catalogHealth.provider)"
Ok "ordering-api: $($orderingHealth.status) — $($orderingHealth.provider)"

Step '2. Login (JWT)'
$login = Invoke-RestMethod -Method Post -Uri "$OrderingBase/api/auth/login" -ContentType 'application/json' `
    -Body (@{ username = $Username; password = $Password } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Ok "token cấp cho $($login.displayName) [$($login.role)], hết hạn $($login.expiresAt)"

Step '3. Đọc catalog (sản phẩm + tồn kho)'
$products = Invoke-RestMethod "$CatalogBase/api/products?pageSize=5"
$stocks = Invoke-RestMethod "$CatalogBase/api/stocks?pageSize=50"
$product = $products.items[0]
$stock = $stocks.items | Where-Object { $_.productId -eq $product.id } | Select-Object -First 1
Ok "sản phẩm $($product.code) $($product.name) — $($product.unitPrice) JPY"
Ok "tồn: onHand=$($stock.quantityOnHand) reserved=$($stock.quantityReserved) available=$($stock.available) @ $($stock.warehouseCode)"

Step '4. Tạo đơn hàng (Draft)'
$body = @{
    customerId = 1
    orderDate  = (Get-Date).ToString('yyyy-MM-dd')
    note       = 'smoke test'
    lines      = @(@{ productId = $product.id; warehouseId = $stock.warehouseId; quantity = 2 })
} | ConvertTo-Json -Depth 5

$order = Invoke-RestMethod -Method Post -Uri "$OrderingBase/api/orders" -Headers $headers `
    -ContentType 'application/json' -Body $body

if ($order.status -ne 'Draft') { Fail "status mong đợi Draft, nhận $($order.status)" }
$expectedSubTotal = [decimal]$product.unitPrice * 2
$expectedTax = [Math]::Round($expectedSubTotal * 0.10, 0, [MidpointRounding]::AwayFromZero)
if ($order.subTotal -ne $expectedSubTotal) { Fail "subTotal $($order.subTotal) != $expectedSubTotal" }
if ($order.taxAmount -ne $expectedTax) { Fail "taxAmount $($order.taxAmount) != $expectedTax" }
if ($order.totalAmount -ne ($expectedSubTotal + $expectedTax)) { Fail 'totalAmount sai' }
Ok "$($order.orderNo) — Draft, subtotal=$($order.subTotal) tax=$($order.taxAmount) total=$($order.totalAmount)"

Step '5. Confirm đơn (giữ tồn ở Catalog)'
$confirmed = Invoke-RestMethod -Method Post -Uri "$OrderingBase/api/orders/$($order.id)/confirm" -Headers $headers
if ($confirmed.status -ne 'Confirmed') { Fail "status mong đợi Confirmed, nhận $($confirmed.status)" }
$afterReserve = (Invoke-RestMethod "$CatalogBase/api/stocks?warehouseId=$($stock.warehouseId)").items |
    Where-Object { $_.productId -eq $product.id }
if ($afterReserve.quantityReserved -ne ($stock.quantityReserved + 2)) {
    Fail "quantityReserved mong đợi $($stock.quantityReserved + 2), nhận $($afterReserve.quantityReserved)"
}
Ok "Confirmed — reserved $($stock.quantityReserved) -> $($afterReserve.quantityReserved), onHand giữ nguyên $($afterReserve.quantityOnHand)"

Step '6. Ship đơn (xuất kho + sinh hoá đơn)'
$ship = Invoke-RestMethod -Method Post -Uri "$OrderingBase/api/orders/$($order.id)/ship" -Headers $headers
if ($ship.order.status -ne 'Shipped') { Fail "status mong đợi Shipped, nhận $($ship.order.status)" }
$afterShip = (Invoke-RestMethod "$CatalogBase/api/stocks?warehouseId=$($stock.warehouseId)").items |
    Where-Object { $_.productId -eq $product.id }
if ($afterShip.quantityOnHand -ne ($stock.quantityOnHand - 2)) {
    Fail "onHand mong đợi $($stock.quantityOnHand - 2), nhận $($afterShip.quantityOnHand)"
}
if ($ship.invoice.amount -ne $expectedSubTotal) { Fail 'hoá đơn sai số tiền' }
Ok "Shipped — onHand $($stock.quantityOnHand) -> $($afterShip.quantityOnHand), hoá đơn $($ship.invoice.invoiceNo) ($($ship.invoice.amount) + $($ship.invoice.taxAmount) JPY)"

Step '7. Trường hợp thiếu tồn -> phải trả 409 và đơn giữ nguyên Draft'
$hugeBody = @{
    customerId = 1
    orderDate  = (Get-Date).ToString('yyyy-MM-dd')
    lines      = @(@{ productId = $product.id; warehouseId = $stock.warehouseId; quantity = 999999 })
} | ConvertTo-Json -Depth 5

$huge = Invoke-RestMethod -Method Post -Uri "$OrderingBase/api/orders" -Headers $headers `
    -ContentType 'application/json' -Body $hugeBody

try {
    Invoke-RestMethod -Method Post -Uri "$OrderingBase/api/orders/$($huge.id)/confirm" -Headers $headers | Out-Null
    Fail 'mong đợi 409 nhưng confirm thành công'
}
catch {
    $status = [int]$_.Exception.Response.StatusCode
    if ($status -ne 409) { Fail "mong đợi 409, nhận $status" }

    # PowerShell 7 để body ở ErrorDetails; 5.1 phải đọc từ response stream
    $message = $_.ErrorDetails.Message
    if ([string]::IsNullOrWhiteSpace($message) -and $_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $message = $reader.ReadToEnd()
        $reader.Dispose()
    }

    Ok "409 đúng — $message"
}

$stillDraft = Invoke-RestMethod "$OrderingBase/api/orders/$($huge.id)" -Headers $headers
if ($stillDraft.status -ne 'Draft') { Fail "đơn phải giữ Draft, nhận $($stillDraft.status)" }
Ok "đơn $($stillDraft.orderNo) vẫn Draft (không half-commit)"
Invoke-RestMethod -Method Post -Uri "$OrderingBase/api/orders/$($huge.id)/cancel" -Headers $headers | Out-Null
Ok 'draft đã huỷ (cleanup)'

Step '8. Danh sách hoá đơn'
$invoices = Invoke-RestMethod "$OrderingBase/api/invoices" -Headers $headers
Ok "có $($invoices.Count) hoá đơn, mới nhất: $($invoices[0].invoiceNo)"

Write-Host "`nTẤT CẢ KIỂM TRA ĐỀU PASS" -ForegroundColor Green
