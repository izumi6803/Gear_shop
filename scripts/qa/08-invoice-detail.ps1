# Scenario 08 — Order detail (timeline), invoice list and the printable invoice
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/08-invoice-detail.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

Write-Host "`n== 0. Sign in (English UI)" -ForegroundColor Cyan
Bc-Open "$base/login" | Out-Null
Bc-Eval "localStorage.setItem('stockflow.lang','en')" | Out-Null
Bc-Goto "$base/login" | Out-Null
Start-Sleep -Milliseconds 900
Bc-Fill '[data-testid=login-username]' 'sales'
Bc-Fill '[data-testid=login-password]' 'Sales@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 1800
Bc-Assert ((Bc-Url) -notlike '*/login') 'signed in' | Out-Null
Bc-Console -Clear | Out-Null

Write-Host "`n== 1. Order list → open a detail page" -ForegroundColor Cyan
Bc-Goto "$base/orders" | Out-Null
Start-Sleep -Milliseconds 1500
Bc-Click 'tbody tr:first-child a'
Start-Sleep -Milliseconds 1500
$detailUrl = Bc-Url
Bc-Assert ($detailUrl -match '/orders/\d+$') "detail route opened (url=$detailUrl)" | Out-Null

Write-Host "`n== 2. Detail page: lines, totals and timeline" -ForegroundColor Cyan
Bc-Assert ((Bc-Count '.timeline-item') -ge 3) "timeline has 3+ milestones (=$((Bc-Count '.timeline-item')))" | Out-Null
$doneSteps = Bc-Count '.timeline-item.done'
Write-Host "     completed milestones: $doneSteps" -ForegroundColor DarkGray
Bc-Assert ($doneSteps -ge 1) 'at least one milestone completed' | Out-Null
$lines = Bc-Count 'tbody tr'
Bc-Assert ($lines -ge 1) "order lines rendered (=$lines)" | Out-Null
Bc-Assert ((Bc-Count '[data-testid=detail-total]') -eq 1) 'grand total block present' | Out-Null
Bc-Shot 'feat-01-order-detail' | Out-Null

Write-Host "`n== 3. Invoice list" -ForegroundColor Cyan
Bc-Goto "$base/invoices" | Out-Null
Start-Sleep -Milliseconds 1500
Bc-Assert ((Bc-Url) -like '*/invoices') "on /invoices (url=$(Bc-Url))" | Out-Null
$invoiceRows = Bc-Count 'tbody tr'
Bc-Assert ($invoiceRows -ge 1) "at least one invoice (=$invoiceRows)" | Out-Null
Bc-Shot 'feat-02-invoice-list' | Out-Null

Write-Host "`n== 4. Printable invoice content" -ForegroundColor Cyan
Bc-Click '[data-testid^=print-]' -Within 'tbody tr:first-child'
Start-Sleep -Milliseconds 1800
Bc-Assert ((Bc-Url) -match '/invoices/\d+$') "print page opened (url=$(Bc-Url))" | Out-Null
$sheet = (Bc-Text '.invoice-sheet').text
Bc-Assert ($sheet -match 'INVOICE') 'document title' | Out-Null
Bc-Assert ($sheet -match 'Bill to') 'buyer block' | Out-Null
Bc-Assert ($sheet -match 'Invoice no') 'invoice number' | Out-Null
Bc-Assert ($sheet -match 'Issue date') 'issue date' | Out-Null
Bc-Assert ($sheet -match 'Due date') 'due date' | Out-Null
Bc-Assert ($sheet -match 'Tax \(10%\)') 'tax line' | Out-Null
Bc-Assert ($sheet -match 'Total') 'grand total' | Out-Null
Bc-Assert ($sheet -match 'Payment details') 'payment details' | Out-Null
Bc-Assert ($sheet -match 'GST-\d') 'seller tax id rendered' | Out-Null
Bc-Assert ($sheet -match '\$') 'amounts formatted as currency' | Out-Null
Bc-Shot 'feat-03-invoice-print' | Out-Null

Write-Host "`n== 5. Print stylesheet (A4)" -ForegroundColor Cyan
Bc-Media -Type 'print'
Start-Sleep -Milliseconds 500
$sidebar = Bc-Eval "(() => { const el = document.querySelector('.app-sidebar'); return el ? (getComputedStyle(el).display === 'none' ? 'HIDDEN' : 'VISIBLE') : 'NO_EL'; })()"
$toolbar = Bc-Eval "(() => { const el = document.querySelector('.invoice-toolbar'); return el ? (getComputedStyle(el).display === 'none' ? 'HIDDEN' : 'VISIBLE') : 'NO_EL'; })()"
Write-Host "     sidebar=$sidebar toolbar=$toolbar" -ForegroundColor DarkGray
Bc-Assert ($sidebar -eq 'HIDDEN') 'sidebar hidden when printing' | Out-Null
Bc-Assert ($toolbar -eq 'HIDDEN') 'toolbar hidden when printing' | Out-Null
Bc-Shot 'feat-04-invoice-print-media' | Out-Null
Bc-Pdf -Name 'invoice-sample' | Out-Null
Bc-Media -Type 'screen'

Write-Host "`n== 6. Invoice total matches the API" -ForegroundColor Cyan
$apiTotal = Bc-Eval "(() => { const id = location.pathname.split('/').pop(); return fetch('/ordering-api/api/invoices/' + id, { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('stockflow.token') } }).then(r => r.json()).then(d => (d.amount + d.taxAmount + (d.shippingFee || 0)).toFixed(2)); })()"
Start-Sleep -Milliseconds 600
$sheetTotal = (Bc-Eval "(() => { const el = document.querySelector('[data-testid=invoice-total]'); return el ? el.textContent.replace(/[^0-9.]/g, '') : 'NONE'; })()")
Write-Host "     API=$apiTotal | document=$sheetTotal" -ForegroundColor DarkGray
Bc-Assert ([string]$apiTotal -like "*$sheetTotal*" -or [string]$sheetTotal -like "*$apiTotal*") "totals match ($apiTotal vs $sheetTotal)" | Out-Null

Write-Host "`n== 7. Console / network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
$badHttp = @($console.networkErrors | Where-Object { $_.status -ne 409 })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null
Bc-Assert ($badHttp.Count -eq 0) "no HTTP error other than 409 (count=$($badHttp.Count))" | Out-Null
if ($badHttp.Count -gt 0) { $badHttp | ForEach-Object { Write-Host "     $($_.status) $($_.url)" -ForegroundColor DarkGray } }

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nINVOICE + ORDER DETAIL: ALL PASS" -ForegroundColor Green
