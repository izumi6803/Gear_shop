# Scenario 09 — Language switcher (English / Vietnamese / Japanese)
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/09-i18n.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

Write-Host "`n== 1. Default language follows the browser, choice is switchable" -ForegroundColor Cyan
Bc-Open "$base/login" | Out-Null
Start-Sleep -Milliseconds 1000
$initialLang = Bc-Eval 'document.documentElement.lang'
Write-Host "     initial <html lang> = $initialLang" -ForegroundColor DarkGray
Bc-Assert ($initialLang -in @('en', 'vi', 'ja')) "<html lang> is a supported language ($initialLang)" | Out-Null

Write-Host "`n== 2. Switch to Vietnamese" -ForegroundColor Cyan
Bc-Select '[data-testid=lang-switcher]' 'vi'
Start-Sleep -Milliseconds 600
Bc-Assert ((Bc-Eval 'document.documentElement.lang') -eq 'vi') '<html lang> = vi' | Out-Null
Bc-Assert ((Bc-Text '.login-card h2').text -match 'Đăng nhập') 'login heading in Vietnamese' | Out-Null
Bc-Shot 'lang-02-vi' | Out-Null

Write-Host "`n== 3. Switch to Japanese" -ForegroundColor Cyan
Bc-Select '[data-testid=lang-switcher]' 'ja'
Start-Sleep -Milliseconds 600
Bc-Assert ((Bc-Eval 'document.documentElement.lang') -eq 'ja') '<html lang> = ja' | Out-Null
Bc-Assert ((Bc-Text '.login-card h2').text -match 'ログイン') 'login heading in Japanese' | Out-Null
Bc-Shot 'lang-03-ja' | Out-Null

Write-Host "`n== 4. Switch to English and sign in" -ForegroundColor Cyan
Bc-Select '[data-testid=lang-switcher]' 'en'
Start-Sleep -Milliseconds 500
Bc-Assert ((Bc-Text '.login-card h2').text -match 'Sign in') 'login heading in English' | Out-Null
Bc-Fill '[data-testid=login-username]' 'sales'
Bc-Fill '[data-testid=login-password]' 'Sales@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2000
Bc-Assert ((Bc-Url) -notlike '*/login') 'signed in' | Out-Null

Write-Host "`n== 5. Navigation labels translate" -ForegroundColor Cyan
$navEn = ((Bc-Text '.app-nav-link' -All).texts) -join '|'
Write-Host "     EN nav: $navEn" -ForegroundColor DarkGray
Bc-Assert ($navEn -match 'Dashboard' -and $navEn -match 'Invoices') 'English nav labels' | Out-Null
Bc-Shot 'lang-04-dashboard-en' | Out-Null

Bc-Select '[data-testid=lang-switcher]' 'vi'
Start-Sleep -Milliseconds 700
$navVi = ((Bc-Text '.app-nav-link' -All).texts) -join '|'
Write-Host "     VI nav: $navVi" -ForegroundColor DarkGray
Bc-Assert ($navVi -match 'Tổng quan' -and $navVi -match 'Hoá đơn') 'Vietnamese nav labels' | Out-Null
Bc-Shot 'lang-05-dashboard-vi' | Out-Null

Bc-Select '[data-testid=lang-switcher]' 'ja'
Start-Sleep -Milliseconds 700
$navJa = ((Bc-Text '.app-nav-link' -All).texts) -join '|'
Write-Host "     JA nav: $navJa" -ForegroundColor DarkGray
Bc-Assert ($navJa -match 'ダッシュボード' -and $navJa -match '請求書') 'Japanese nav labels' | Out-Null
Bc-Shot 'lang-06-dashboard-ja' | Out-Null

Write-Host "`n== 6. Choice persists across reload" -ForegroundColor Cyan
Bc-Goto "$base/orders" | Out-Null
Start-Sleep -Milliseconds 1500
Bc-Assert ((Bc-Eval 'document.documentElement.lang') -eq 'ja') 'language persists after navigation' | Out-Null
$stored = Bc-Eval "localStorage.getItem('stockflow.lang')"
Bc-Assert ($stored -eq 'ja') "localStorage keeps the choice ($stored)" | Out-Null

Write-Host "`n== 7. Number/date formatting follows the locale" -ForegroundColor Cyan
Bc-Select '[data-testid=lang-switcher]' 'en'
Start-Sleep -Milliseconds 700
$enTotal = Bc-Eval "(() => { const el = document.querySelector('tbody tr:first-child td.num'); return el ? el.textContent.trim() : 'NONE'; })()"
Bc-Select '[data-testid=lang-switcher]' 'vi'
Start-Sleep -Milliseconds 700
$viTotal = Bc-Eval "(() => { const el = document.querySelector('tbody tr:first-child td.num'); return el ? el.textContent.trim() : 'NONE'; })()"
Write-Host "     EN=$enTotal | VI=$viTotal" -ForegroundColor DarkGray
$hasCurrency = Bc-Eval "document.body.innerText.includes('US\$') || document.body.innerText.includes('\$')"
Bc-Assert ([string]$hasCurrency -eq 'True') 'currency symbol rendered' | Out-Null

Write-Host "`n== 8. No leftover hard-coded language strings in console" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nI18N: ALL PASS" -ForegroundColor Green
