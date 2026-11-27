# Build SPA (React + TypeScript + Vite).
#
# Vite/Rollup không xử lý được đường dẫn có ký tự '#'. Nếu repo nằm trong path như
# "E:\C# Project", script này build trong một thư mục tạm (không có '#') rồi copy dist về.
# Trên máy có path bình thường, script chỉ gọi `npm run build` như thường.

param(
    [string]$SpaPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'src\Web.Spa')
)

$ErrorActionPreference = 'Stop'

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $npm) {
    $npm = (Get-Command npm -ErrorAction SilentlyContinue | Select-Object -First 1).Source
}
if (-not $npm) {
    throw 'Không tìm thấy npm. Cài Node.js 20+ trước khi build SPA.'
}

$spa = (Resolve-Path $SpaPath).Path
$distOut = Join-Path $spa 'dist'

if ($spa -notmatch '#') {
    Write-Host "Build tại chỗ: $spa" -ForegroundColor Cyan
    Push-Location $spa
    try {
        & $npm run build
        exit $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}

Write-Host "Đường dẫn có ký tự '#' → build trong thư mục tạm (Vite/Rollup không hỗ trợ '#')" -ForegroundColor Yellow

$temp = Join-Path $env:TEMP ('stockflow-spa-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $temp -Force | Out-Null
Write-Host "  temp: $temp"

foreach ($item in 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'src', 'public') {
    $source = Join-Path $spa $item
    if (Test-Path $source) {
        Copy-Item -Path $source -Destination $temp -Recurse -Force
    }
}

# node_modules rất lớn → dùng junction thay vì copy (chỉ tạo ở temp, KHÔNG đụng vào bản gốc).
$modules = Join-Path $spa 'node_modules'
if (-not (Test-Path $modules)) {
    throw "Chưa có node_modules. Chạy: npm install (trong $spa)"
}
cmd /c mklink /J "$temp\node_modules" "$modules" | Out-Null

$exitCode = 0
Push-Location $temp
try {
    & $npm run build
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
    # Gỡ junction trước khi xoá, tránh xoá nhầm node_modules thật.
    cmd /c rmdir "$temp\node_modules" | Out-Null
}

if ($exitCode -ne 0) {
    Write-Host 'Build thất bại.' -ForegroundColor Red
    exit $exitCode
}

Remove-Item $distOut -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $temp 'dist') -Destination $distOut -Recurse -Force
Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Xong: $distOut" -ForegroundColor Green
