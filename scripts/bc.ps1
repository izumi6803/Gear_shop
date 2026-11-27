# Gửi 1 lệnh JSON cho browser-driver (tiện cho CI/script).
# Khuyến nghị dùng scripts/bc-lib.ps1 khi cần nhiều bước.
#
#   powershell -ExecutionPolicy Bypass -File scripts/bc.ps1 -Json '{"cmd":"goto","url":"http://localhost:4173/login"}'

param(
    [Parameter(Mandatory = $true)][string]$Json,
    [int]$Port = 4599
)

$bytes = [System.Text.Encoding]::UTF8.GetBytes($Json)

try {
    $result = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/cmd" -Body $bytes `
        -ContentType 'application/json; charset=utf-8' -TimeoutSec 180
}
catch {
    Write-Host "DRIVER LỖI: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($result.ok) {
    $result.data | ConvertTo-Json -Depth 8
}
else {
    Write-Host "LỆNH THẤT BẠI: $($result.error)" -ForegroundColor Red
    exit 1
}
