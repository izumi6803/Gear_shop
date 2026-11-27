# Scenario 15 — Admin đổi role / khoá tài khoản (quyền phải có hiệu lực ngay)
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/15-role-admin.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
$api = 'http://localhost:5081'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }
$stamp = Get-Date -Format 'HHmmss'
$user = "role$stamp"
$pass = 'Pass@1234'

function Call([string]$method, [string]$url, [string]$body, [string]$token) {
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($token) { $headers.Authorization = "Bearer $token" }
    try {
        $result = if ($body) {
            Invoke-RestMethod -Method $method -Uri $url -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
        } else {
            Invoke-RestMethod -Method $method -Uri $url -Headers $headers
        }
        return @{ code = 200; data = $result }
    } catch {
        return @{ code = $_.Exception.Response.StatusCode.value__; data = $null }
    }
}

$admin = (Call 'POST' "$api/api/auth/login" '{"username":"admin","password":"Admin@123"}' $null).data.accessToken
Bc-Assert ([bool]$admin) 'đăng nhập admin qua API' | Out-Null

Write-Host "`n== 1. Tạo tài khoản Sales, token cũ dùng được ===" -ForegroundColor Cyan
$account = (Call 'POST' "$api/api/accounts" ("{`"username`":`"$user`",`"password`":`"$pass`",`"displayName`":`"Role Test`",`"role`":`"Sales`"}") $admin).data
Bc-Assert ($account.role -eq 'Sales') "tạo được tài khoản Sales (=$($account.role))" | Out-Null
Bc-Assert ($null -eq $account.customerId) "Sales chưa có hồ sơ khách (=$($account.customerId))" | Out-Null

$salesToken = (Call 'POST' "$api/api/auth/login" ("{`"username`":`"$user`",`"password`":`"$pass`"}") $null).data.accessToken
$staffAccess = (Call 'GET' "$api/api/orders?page=1&pageSize=1" $null $salesToken)
Bc-Assert ($staffAccess.code -eq 200) "token Sales gọi được API đơn hàng (=$($staffAccess.code))" | Out-Null

Write-Host "`n== 2. Đổi Sales → Customer phải tự tạo hồ sơ khách ===" -ForegroundColor Cyan
$updated = (Call 'PATCH' "$api/api/accounts/$($account.id)" '{"role":"Customer"}' $admin).data
Bc-Assert ($updated.role -eq 'Customer') "role đã đổi thành Customer (=$($updated.role))" | Out-Null
Bc-Assert ($null -ne $updated.customerId) "hồ sơ khách được tạo và gắn (customerId=$($updated.customerId))" | Out-Null

$customerToken = (Call 'POST' "$api/api/auth/login" ("{`"username`":`"$user`",`"password`":`"$pass`"}") $null).data.accessToken
$checkout = (Call 'POST' "$api/api/shop/checkout" '{"lines":[{"productId":1,"warehouseId":1,"quantity":1}],"note":"role test","paymentMethod":"cash"}' $customerToken)
Bc-Assert ($checkout.code -eq 200) "tài khoản vừa đổi sang Customer mua được hàng (=$($checkout.code))" | Out-Null

Write-Host "`n== 3. Token phát hành trước khi đổi quyền phải chết ===" -ForegroundColor Cyan
$stale = (Call 'GET' "$api/api/orders?page=1&pageSize=1" $null $salesToken)
Bc-Assert ($stale.code -eq 401) "token Sales cũ bị từ chối (=$($stale.code))" | Out-Null

Write-Host "`n== 4. Đổi Customer → Sales: quyền mới có hiệu lực, không tạo hồ sơ trùng ===" -ForegroundColor Cyan
$back = (Call 'PATCH' "$api/api/accounts/$($account.id)" '{"role":"Sales"}' $admin).data
Bc-Assert ($back.role -eq 'Sales') "role quay lại Sales (=$($back.role))" | Out-Null
Bc-Assert ($back.customerId -eq $updated.customerId) "giữ nguyên hồ sơ khách, không tạo trùng (=$($back.customerId))" | Out-Null
$newToken = (Call 'POST' "$api/api/auth/login" ("{`"username`":`"$user`",`"password`":`"$pass`"}") $null).data.accessToken
$staffAgain = (Call 'GET' "$api/api/orders?page=1&pageSize=1" $null $newToken)
Bc-Assert ($staffAgain.code -eq 200) "token mới dùng được quyền Sales (=$($staffAgain.code))" | Out-Null
$shopBlocked = (Call 'POST' "$api/api/shop/checkout" '{"lines":[{"productId":1,"warehouseId":1,"quantity":1}],"note":"x","paymentMethod":"cash"}' $newToken)
Bc-Assert ($shopBlocked.code -eq 200 -or $shopBlocked.code -eq 400) "không lỗi 500 khi role không còn là Customer (=$($shopBlocked.code))" | Out-Null

Write-Host "`n== 5. Khoá tài khoản: token đang dùng mất hiệu lực ===" -ForegroundColor Cyan
Call 'PATCH' "$api/api/accounts/$($account.id)" '{"isActive":false}' $admin | Out-Null
$blocked = (Call 'GET' "$api/api/orders?page=1&pageSize=1" $null $newToken)
Bc-Assert ($blocked.code -eq 401) "tài khoản bị khoá thì token cũng bị từ chối (=$($blocked.code))" | Out-Null
$relogin = (Call 'POST' "$api/api/auth/login" ("{`"username`":`"$user`",`"password`":`"$pass`"}") $null)
Bc-Assert ($relogin.code -eq 401) "không đăng nhập được khi đã khoá (=$($relogin.code))" | Out-Null

Write-Host "`n== 6. Không cho hạ quyền admin cuối cùng ==" -ForegroundColor Cyan
$demoteLast = (Call 'PATCH' "$api/api/accounts/1" '{"role":"Viewer"}' $admin)
Bc-Assert ($demoteLast.code -eq 400) "server chặn hạ quyền admin cuối cùng (=$($demoteLast.code))" | Out-Null
$adminStill = (Call 'GET' "$api/api/accounts" $null $admin)
Bc-Assert ($adminStill.code -eq 200) "admin vẫn còn quyền sau khi bị chặn (=$($adminStill.code))" | Out-Null

Write-Host "`n== 7. UI: đổi role trên trang quản lý tài khoản ==" -ForegroundColor Cyan
Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'vi' } | Out-Null
Start-Sleep -Milliseconds 1300
Bc-Fill '[data-testid=login-username]' 'admin'
Bc-Fill '[data-testid=login-password]' 'Admin@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2600
Bc-Goto "$base/admin/accounts" | Out-Null
Start-Sleep -Milliseconds 2400
Bc-Assert ((Bc-Count '[data-testid^=account-role-]') -ge 4) 'thấy danh sách tài khoản với ô chọn quyền' | Out-Null
Bc-Select '[data-testid="account-role-viewer"]' 'Sales'
Start-Sleep -Milliseconds 2600
$viewerRole = (Bc-Eval "(() => { const el = document.querySelector('[data-testid=\""account-role-viewer\""]'); return el ? el.value : ''; })()")
Bc-Assert ($viewerRole -eq 'Sales') "UI lưu được quyền mới cho viewer (=$viewerRole)" | Out-Null
Bc-Shot 'role-01-changed-viewer' | Out-Null
# trả lại Viewer để không phá các scenario khác
Bc-Select '[data-testid="account-role-viewer"]' 'Viewer'
Start-Sleep -Milliseconds 2400
$restored = (Bc-Eval "(() => { const el = document.querySelector('[data-testid=\""account-role-viewer\""]'); return el ? el.value : ''; })()")
Bc-Assert ($restored -eq 'Viewer') "trả lại quyền Viewer (=$restored)" | Out-Null

Write-Host "`n== 8. Console / network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nROLE ADMIN: ALL PASS" -ForegroundColor Green
