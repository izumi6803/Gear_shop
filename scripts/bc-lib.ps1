# Thư viện gọi browser-driver từ PowerShell. Dot-source để dùng:
#   . .\scripts\bc-lib.ps1
#   Bc-Open 'http://localhost:4173/'
#   Bc-Fill 'label=Tài khoản' 'sales'
#   Bc-Click 'role=button[name="Đăng nhập"]'
#   Bc-Shot 'qa-01-login'
#
# Driver phải đang chạy: node tools/browser-driver/driver.mjs  (http://127.0.0.1:4599)

$script:BcPort = 4599

function Bc-Cmd {
    param(
        [Parameter(Mandatory = $true)][string]$Cmd,
        [hashtable]$Arg = @{}
    )

    $payload = @{ cmd = $Cmd } + $Arg | ConvertTo-Json -Depth 8 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)

    try {
        $response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$($script:BcPort)/cmd" `
            -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 180
    }
    catch {
        throw "Không gọi được browser-driver ($($script:BcPort)). Đã chạy driver chưa? $($_.Exception.Message)"
    }

    if (-not $response.ok) {
        throw "Lệnh '$Cmd' thất bại: $($response.error)"
    }

    return $response.data
}

function Bc-Open {
    param([string]$Url = 'http://localhost:4173/', [int]$Width = 1440, [int]$Height = 900, [hashtable]$Storage)
    $arg = @{ url = $Url; width = $Width; height = $Height }
    if ($Storage) { $arg['storage'] = $Storage }
    $data = Bc-Cmd 'open' $arg
    Write-Host "  → $($data.url) [$($data.viewport.width)x$($data.viewport.height)]" -ForegroundColor DarkGray
    $data
}

function Bc-Goto {
    param([Parameter(Mandatory = $true)][string]$Url)
    $data = Bc-Cmd 'goto' @{ url = $Url }
    Write-Host "  → $($data.url)" -ForegroundColor DarkGray
    $data
}

function Bc-Click {
    param([Parameter(Mandatory = $true)][string]$Target, [string]$Within, [int]$Timeout = 10000, [int]$X = -1, [int]$Y = -1)
    $arg = @{ target = $Target; timeout = $Timeout }
    if ($Within) { $arg['within'] = $Within }
    if ($X -ge 0 -and $Y -ge 0) { $arg['position'] = @{ x = $X; y = $Y } }
    Bc-Cmd 'click' $arg | Out-Null
    $where = ''
    if ($Within) { $where = " (trong $Within)" }
    if ($X -ge 0 -and $Y -ge 0) { $where += " @($X,$Y)" }
    Write-Host "  ✓ click $Target$where" -ForegroundColor DarkGray
}

function Bc-Fill {
    param([Parameter(Mandatory = $true)][string]$Target, [string]$Value = '', [string]$Within)
    $arg = @{ target = $Target; value = $Value }
    if ($Within) { $arg['within'] = $Within }
    Bc-Cmd 'fill' $arg | Out-Null
    Write-Host "  ✓ fill $Target = '$Value'" -ForegroundColor DarkGray
}

function Bc-Select {
    param([Parameter(Mandatory = $true)][string]$Target, [string]$Value, [int]$Index = -1, [string]$Within)
    $arg = @{ target = $Target }
    if ($Index -ge 0) { $arg['index'] = $Index } else { $arg['value'] = $Value }
    if ($Within) { $arg['within'] = $Within }
    Bc-Cmd 'select' $arg | Out-Null
    Write-Host "  ✓ select $Target" -ForegroundColor DarkGray
}

function Bc-Press {
    param([Parameter(Mandatory = $true)][string]$Key)
    Bc-Cmd 'press' @{ key = $Key } | Out-Null
}

function Bc-Wait {
    param([int]$Ms = 500)
    Bc-Cmd 'wait' @{ ms = $Ms } | Out-Null
}

function Bc-WaitFor {
    param([Parameter(Mandatory = $true)][string]$Target, [string]$Within, [string]$State = 'visible', [int]$Timeout = 15000)
    $arg = @{ target = $Target; state = $State; timeout = $Timeout }
    if ($Within) { $arg['within'] = $Within }
    Bc-Cmd 'waitFor' $arg | Out-Null
    Write-Host "  ✓ thấy $Target" -ForegroundColor DarkGray
}

function Bc-Text {
    param([string]$Target, [switch]$All, [string]$Within)
    if ($Target) {
        $arg = @{ target = $Target; all = [bool]$All }
        if ($Within) { $arg['within'] = $Within }
        return Bc-Cmd 'text' $arg
    }
    return Bc-Cmd 'text' @{}
}

function Bc-Count {
    param([Parameter(Mandatory = $true)][string]$Target, [string]$Within)
    $arg = @{ target = $Target }
    if ($Within) { $arg['within'] = $Within }
    return (Bc-Cmd 'count' $arg).count
}

function Bc-Shot {
    param([Parameter(Mandatory = $true)][string]$Name, [switch]$FullPage)
    $data = Bc-Cmd 'screenshot' @{ name = $Name; fullPage = [bool]$FullPage }
    Write-Host "  ✓ ảnh: $($data.path)" -ForegroundColor DarkGray
    $data.path
}

function Bc-Viewport {
    param([int]$Width = 390, [int]$Height = 844)
    Bc-Cmd 'viewport' @{ width = $Width; height = $Height } | Out-Null
}

function Bc-Url {
    return (Bc-Cmd 'url' @{}).url
}

function Bc-Back {
    $data = Bc-Cmd 'back' @{}
    Write-Host "  ← back: $($data.url)" -ForegroundColor DarkGray
    $data.url
}

function Bc-Forward {
    $data = Bc-Cmd 'forward' @{}
    Write-Host "  → forward: $($data.url)" -ForegroundColor DarkGray
    $data.url
}

# Chờ URL khớp pattern (redirect là async nên cần poll thay vì assert ngay).
function Bc-WaitUrl {
    param([Parameter(Mandatory = $true)][string]$Pattern, [int]$TimeoutMs = 8000)

    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    do {
        $url = Bc-Url
        if ($url -like $Pattern) { return $url }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)

    return (Bc-Url)
}

function Bc-Console {
    param([switch]$Clear)
    return Bc-Cmd 'console' @{ clear = [bool]$Clear }
}

function Bc-Eval {
    param([Parameter(Mandatory = $true)][string]$Expression)
    return (Bc-Cmd 'eval' @{ expression = $Expression }).value
}

# Giả lập media print để kiểm tra CSS in ấn / xuất PDF.
function Bc-Media {
    param([string]$Type = 'print')
    Bc-Cmd 'media' @{ type = $Type } | Out-Null
    Write-Host "  ✓ media = $Type" -ForegroundColor DarkGray
}

function Bc-Pdf {
    param([Parameter(Mandatory = $true)][string]$Name)
    $data = Bc-Cmd 'pdf' @{ name = $Name; format = 'A4' }
    Write-Host "  ✓ PDF: $($data.path)" -ForegroundColor DarkGray
    $data.path
}

function Bc-Assert {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )
    if ($Condition) {
        Write-Host "  [PASS] $Message" -ForegroundColor Green
        return $true
    }
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
    $script:BcFailures++
    return $false
}
